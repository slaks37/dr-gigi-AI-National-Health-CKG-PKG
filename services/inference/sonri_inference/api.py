import asyncio
import hmac
import json
import logging
import time
import uuid
from collections import deque
from typing import Literal

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request

from .adapters import InvalidModelOutput, create_adapter
from .config import Settings
from .quality import InvalidImage, decode_image
from .registry import Registry

logger = logging.getLogger("sonri.inference.audit")
logger.setLevel(logging.INFO)
if not logger.handlers:
    audit_handler = logging.StreamHandler()
    audit_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(audit_handler)


def failure(code: str, status_code: int, request_id: str, *, model_id=None, modality=None, status="rejected"):
    return JSONResponse(status_code=status_code, content={"request_id": request_id, "status": status,
        "reason": code, "model_id": model_id, "modality": modality, "findings": [],
        "clinical_use": "PROHIBITED", "label_verification": "UNVERIFIED"})


class Boundary:
    """Authenticate and cap bytes BEFORE multipart parser or any model work."""
    def __init__(self, app, settings):
        self.app, self.settings = app, settings
        self.requests = deque()
        self.active_uploads = 0

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        headers = dict(scope["headers"])
        path = scope.get("path", "")
        started = time.monotonic()
        status_code = 500
        upload_slot = False

        async def audited_send(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                message["headers"] += [(b"cache-control", b"no-store"), (b"x-content-type-options", b"nosniff"), (b"x-request-id", request_id.encode())]
            await send(message)

        try:
            if path.startswith("/v1/"):
                token = self.settings.api_token
                if len(token) < 32:
                    return await failure("SERVICE_AUTH_NOT_CONFIGURED", 503, request_id)(scope, receive, audited_send)
                auth = headers.get(b"authorization", b"").decode("latin-1")
                if not hmac.compare_digest(auth.encode("utf-8"), f"Bearer {token}".encode("utf-8")):
                    return await failure("UNAUTHORIZED", 401, request_id)(scope, receive, audited_send)
                now = time.monotonic()
                while self.requests and self.requests[0] < now - 60:
                    self.requests.popleft()
                if len(self.requests) >= self.settings.requests_per_minute:
                    return await failure("RATE_LIMITED", 429, request_id)(scope, receive, audited_send)
                self.requests.append(now)
                if path == "/v1/infer":
                    if self.active_uploads >= self.settings.max_concurrent:
                        return await failure("INFERENCE_CAPACITY_BUSY", 429, request_id)(scope, receive, audited_send)
                    self.active_uploads += 1
                    upload_slot = True
                    # Authentication precedes even transient upload buffering.
                    # CBCT execution is unavailable pending a verified bundle,
                    # so requests are bounded to the photographic byte ceiling.
                    maximum = self.settings.max_upload_bytes + 64 * 1024
                    length = headers.get(b"content-length")
                    if length and (not length.isdigit() or int(length) > maximum):
                        return await failure("UPLOAD_TOO_LARGE", 413, request_id)(scope, receive, audited_send)
                    chunks, total = [], 0
                    while True:
                        message = await receive()
                        if message["type"] == "http.disconnect":
                            return
                        chunk = message.get("body", b"")
                        total += len(chunk)
                        if total > maximum:
                            return await failure("UPLOAD_TOO_LARGE", 413, request_id)(scope, receive, audited_send)
                        chunks.append(chunk)
                        if not message.get("more_body", False):
                            break
                    body = b"".join(chunks)
                    delivered = False
                    original_receive = receive
                    async def replay():
                        nonlocal delivered
                        if not delivered:
                            delivered = True
                            return {"type": "http.request", "body": body, "more_body": False}
                        return await original_receive()
                    receive = replay
            return await self.app(scope, receive, audited_send)
        finally:
            if upload_slot:
                self.active_uploads -= 1
            # Deliberate allowlist: never log auth, file names, bytes, IP, raw
            # model text, symptoms, source paths, patient ids or EXIF.
            logger.info(json.dumps({"event": "inference_http", "request_id": request_id,
                "route": path if path in {"/healthz", "/v1/models", "/v1/infer"} else "other",
                "status_code": status_code, "latency_ms": round((time.monotonic() - started) * 1000, 2)}))


def create_app(settings: Settings | None = None):
    settings = settings or Settings.from_env()
    app = FastAPI(title="SONRI research inference", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)
    registry = Registry(settings)
    app.state.registry = registry
    app.state.adapters = {}
    app.state.runtime_failures = {}
    app.state.jobs = set()
    app.state.semaphore = asyncio.Semaphore(settings.max_concurrent)
    app.add_middleware(Boundary, settings=settings)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, _error):
        return failure("INVALID_REQUEST", 422, request.state.request_id)

    @app.get("/healthz")
    async def health():
        return {"status": "ok", "service": "sonri-inference", "research_only": True, "clinical_use": "PROHIBITED"}

    @app.get("/v1/models")
    async def models():
        result = []
        for spec in registry.models.values():
            model = registry.public(spec)
            model["runtime_status"] = "FAILED" if spec.id in app.state.runtime_failures else ("EXECUTED" if spec.id in app.state.adapters else "NOT_PROBED")
            if spec.id in app.state.runtime_failures:
                model.update(available=False, reason=app.state.runtime_failures[spec.id])
            result.append(model)
        return {"schema_version": "1", "models": result, "clinical_use": "PROHIBITED"}

    @app.post("/v1/infer")
    async def infer(request: Request, model_id: str = Form(...), modality: Literal["intraoral", "panoramic", "cbct"] = Form(...),
                    research_opt_in: bool = Form(False), file: UploadFile = File(...)):
        request_id = request.state.request_id
        started = time.monotonic()
        base = {"model_id": model_id, "modality": modality}
        try:
            if not research_opt_in:
                return failure("RESEARCH_OPT_IN_REQUIRED", 422, request_id, **base)
            spec = registry.models.get(model_id)
            if not spec:
                # Do not echo arbitrary user input to responses or logs.
                return failure("UNKNOWN_MODEL", 404, request_id, modality=modality)
            if spec.modality != modality:
                return failure("MODEL_MODALITY_MISMATCH", 422, request_id, **base)
            available, reason = registry.availability(spec)
            if not available:
                return failure(reason, 503, request_id, status="unavailable", **base)
            data = await file.read(settings.max_upload_bytes + 1)
            if not data or len(data) > settings.max_upload_bytes:
                return failure("UPLOAD_TOO_LARGE_OR_EMPTY", 413, request_id, **base)
            if modality == "cbct":
                return failure("TOOTHSEG_BUNDLE_CONTRACT_NOT_VERIFIED", 503, request_id, status="unavailable", **base)
            try:
                image, quality = decode_image(data, file.content_type, modality, settings.max_pixels)
            except InvalidImage as error:
                return failure(str(error), 422, request_id, **base)
            if not quality["accepted"]:
                image.close()
                response = failure("IMAGE_QUALITY_REJECTED", 422, request_id, **base)
                body = json.loads(response.body)
                body["quality"] = quality
                return JSONResponse(status_code=422, content=body)
            try:
                await asyncio.wait_for(app.state.semaphore.acquire(), timeout=0.1)
            except TimeoutError:
                image.close()
                return failure("INFERENCE_CAPACITY_BUSY", 429, request_id, **base)

            def run():
                # Recheck integrity immediately before every execution/cache use.
                okay, why = registry.availability(spec)
                if not okay:
                    raise InvalidModelOutput(why)
                if model_id not in app.state.adapters:
                    app.state.adapters[model_id] = create_adapter(spec)
                return app.state.adapters[model_id].infer(image)

            async def guarded_run():
                try:
                    return await asyncio.to_thread(run)
                finally:
                    image.close()
                    app.state.semaphore.release()

            job = asyncio.create_task(guarded_run())
            app.state.jobs.add(job)
            def finished(task):
                app.state.jobs.discard(task)
                # Retrieve errors even when the HTTP request timed out.
                if not task.cancelled():
                    task.exception()
            job.add_done_callback(finished)
            try:
                # Timeout does not release capacity until the native job really
                # completes. Run in one worker process with a supervisor hard
                # timeout in staging to terminate hung native runtimes.
                findings = await asyncio.wait_for(asyncio.shield(job), settings.inference_timeout)
            except TimeoutError:
                app.state.runtime_failures[spec.id] = "INFERENCE_TIMEOUT"
                return failure("INFERENCE_TIMEOUT", 504, request_id, **base)
            except Exception as error:
                app.state.runtime_failures[spec.id] = "MODEL_RUNTIME_FAILED"
                logger.warning(json.dumps({"event": "model_runtime_error", "request_id": request_id,
                                           "model_id": spec.id, "error_type": type(error).__name__}))
                return failure("MODEL_RUNTIME_FAILED", 503, request_id, status="unavailable", **base)
            app.state.runtime_failures.pop(spec.id, None)
            return {"request_id": request_id, "status": "completed", "model_id": spec.id, "model_version": spec.version,
                    "model_sha256": spec.sha256, "modality": modality,
                    "clinical_use": "PROHIBITED", "label_verification": "UNVERIFIED",
                    "findings": findings, "quality": quality, "latency_ms": round((time.monotonic() - started) * 1000, 2),
                    "warnings": ["RESEARCH_ONLY", "DENTIST_REVIEW_REQUIRED", "RAW_LABEL_SEMANTICS_UNVERIFIED",
                                 "SCORES_ARE_NOT_DIAGNOSTIC_PROBABILITIES", "NEGATIVE_OUTPUT_DOES_NOT_ESTABLISH_HEALTH"]}
        finally:
            await file.close()

    return app


app = create_app()
