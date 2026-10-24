# SONRI research inference service

Separate FastAPI process; no model weights or ML libraries belong in Next.js. This service produces raw research outputs and never confirms diagnoses or emits ICD-10. Every response states `clinical_use: PROHIBITED`. Even an empty detection result requires clinician review.

## Run locally

Use **Python 3.12+** explicitly (macOS `/usr/bin/python3` may be 3.9).

```sh
python3.12 -m venv .venv
.venv/bin/pip install -c constraints.lock.txt -r requirements-test.txt
# Choose one worker's optional model runtime:
.venv/bin/pip install -c constraints.lock.txt -r requirements-onnx.txt
# Or, after reviewing AGPL obligations:
# .venv/bin/pip install -c constraints.lock.txt -r requirements-yolo.txt
export INFERENCE_API_TOKEN="$(openssl rand -hex 32)"
.venv/bin/uvicorn sonri_inference.api:app --host 127.0.0.1 --port 8000 --no-access-log --workers 1
```

Without a configured token of at least 32 bytes, protected routes return 503. All seven default model entries are unavailable until an operator configures a trusted local checkpoint, digest, exact I/O contract and license acknowledgment. Dependency presence alone does not establish runtime success or clinical suitability. The listing distinguishes `NOT_PROBED`, `EXECUTED`, and `FAILED` runtime states; a failed request marks the model unavailable until a successful retry.

To configure a reviewed research artifact, copy `registry.example.json` to ignored `registry.local.json`, set its absolute checkpoint path and reviewed values, and export `SONRI_MODEL_REGISTRY` and `SONRI_MODEL_ROOT`. The path must resolve within the model root. Never accept checkpoint uploads from API callers. PyTorch checkpoints can execute pickle code: trust acknowledgment and a pinned SHA256 are mandatory. The service performs no checkpoint download.

## Canonical API

- `GET /healthz`: liveness only; no authentication, no model or clinical readiness claim.
- `GET /v1/models`: bearer authentication. Returns `{schema_version: "1", models: [...]}` with model ID, version, architecture, source, digest, license, availability and precise blocker. Filesystem paths and tokens are omitted.
- `POST /v1/infer`: bearer authentication and multipart fields `model_id`, `modality` (`intraoral`, `panoramic`, `cbct`), `research_opt_in=true`, and `file`.

```sh
curl --fail-with-body http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer $INFERENCE_API_TOKEN"
curl --fail-with-body http://127.0.0.1:8000/v1/infer \
  -H "Authorization: Bearer $INFERENCE_API_TOKEN" \
  -F model_id=comparative-rfdetr -F modality=intraoral \
  -F research_opt_in=true -F file=@synthetic.png
```

A completed response contains `request_id`, `status: completed`, `model_id`, `model_version`, `model_sha256`, `modality`, `clinical_use: PROHIBITED`, `label_verification: UNVERIFIED`, `quality`, `findings`, `latency_ms`, and warnings. A raw detection is `{kind: detection, class_id, raw_label, score, box: [xmin,ymin,xmax,ymax], label_verification: UNVERIFIED, review_status: UNCONFIRMED}`. Boxes are normalized to **0–1**, not pixels or the legacy browser demo's 0–1000. Classification scores and segmentation area fractions are raw model quantities, not diagnostic probabilities or clinical bone-loss measurements. No adapter assigns FDI tooth numbers without a verified semantic contract; all registry entries currently report FDI numbering unavailable.

Failures have structured `status: rejected|unavailable`, `reason`, empty `findings`, `request_id`, and the same research restrictions. HTTP statuses: 401 unauthorized, 404 unknown model, 413 upload size, 422 incompatible input/quality/opt-in, 429 rate/capacity, 503 unavailable checkpoint/license/runtime, 504 inference deadline. Request validation never echoes supplied medical information. Model runtime exceptions expose only a stable failure reason, never exception text.

## Adapter scope

| Model ID | Executable adapter contract | Current default |
|---|---|---|
| `intraoral-yolo` | Trusted Ultralytics local detection `.pt`; CPU; native raw labels | Checkpoint disabled until trust/license review |
| `oral-classifier` | ONNX float32 NCHW RGB [0,1]; square bilinear resize; one `[1,C]` logits output | Verified export and label metadata missing |
| `panoramic-dentex` | ONNX named `boxes[N,4]`, `scores[N]`, `labels[N]`; normalized xyxy; same RGB preprocessing | Compatible checkpoint and FDI mapping missing |
| `panoramic-bone-loss` | ONNX `[1,C,H,W]` logits; raw segmentation area fractions only | Compatible weights/calibration missing; clinical bone quantification unavailable |
| `cbct-toothseg` | Reserved nnU-Net bundle contract, fail closed | Verified task/plans/checkpoint bundle and CBCT validation missing; volume execution unavailable |
| `comparative-rfdetr` | Above generic detector export, or exact `rfdetr-cxcywh-logits` export: ImageNet normalization, bilinear half-pixel RGB resize, `dets[1,300,4]`, `labels[1,300,5]`, sigmoid/top-300/confidence>0.25 | Explicit reviewed local registry required |
| `comparative-maskrcnn` | Compatible three-output ONNX detection export; masks unavailable | Compatible weights and license missing |

These export contracts are adapter interfaces, not claims that unprovided source checkpoints have been converted or executed. No label names, mapping, FDI numbering, detection-to-diagnosis relation or bone-loss calibration is inferred from output dimensions. CBCT and unsupported exports remain unavailable rather than generating synthetic predictions.

Technical quality checks verify PNG/JPEG content against MIME, decoded pixel count, single frame, minimum dimensions, exposure, detail and panoramic aspect ratio. Modality remains caller-declared: quality heuristics cannot prove that an image is oral, panoramic, diagnostically adequate or within a model's validated domain. PNG/JPEG only; DICOM, HEIF and CBCT are not silently coerced into RGB.

## Verification

```sh
.venv/bin/python -m pytest -q
.venv/bin/python smoke_pretrained.py \
  --checkpoint /secure/models/sonri-rfdetr-large-v1.onnx \
  --sha256 a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0 \
  --acknowledge-research-license \
  --output evidence/pretrained-synthetic-smoke.json
```

The smoke script creates deterministic 704×704 geometric imagery, performs two real model requests through FastAPI, checks repeated outputs, records runtime/provenance and saves no token or local model path. Its evidence is in `evidence/pretrained-synthetic-smoke.json`. The same script accepts `--model yolo` with the Daath SHA from `registry.example.json`; actual YOLO CPU execution is recorded separately in `evidence/yolo-synthetic-smoke.json` (zero detections on synthetic geometry). Synthetic execution and regression repeatability do **not** establish model sensitivity, specificity, mAP, clinical performance, dataset permission, patient safety or external clinical validity. Current clinical benchmarks and CBCT execution are blocked by verified datasets/checkpoints and clinician review, not represented as passed tests. API behavior tests use an explicitly identified test double only where model-independent failure handling is under test.

## Deployment and privacy

Build from this directory: `docker build -t sonri-inference:research .`. Docker defaults to the ONNX CPU profile. Use one worker/container and separate model-specific worker images for larger dependencies. Run unprivileged, read-only filesystem, `--tmpfs /tmp`, drop capabilities, mount `/models` and registry read-only, pass the API token via your secret manager, keep port 8000 private, terminate TLS at an authenticated gateway, and block outbound network. The shared constraints file pins the executed environment; optional profiles only install their required subset. The Dockerfile is prepared; an image build and staging deployment must be verified separately.

Do not expose this bearer credential to browser JavaScript. Next.js must proxy requests after its own patient/encounter authorization and consent checks. Service authentication does not replace application RBAC. Send only the minimum image and model fields, never patient names, NIK or medical histories. No source images, EXIF or outputs are persistently stored here; multipart buffering can use transient OS temp storage, so require tmpfs and disable gateway/body logging. The application owns permitted evidence persistence, access auditing and retention.

24 MiB image/file ceiling, 20 million decoded pixels, global authenticated 20 requests/minute and one active upload/decode/inference request per worker are conservative defaults. Auth runs before body parsing. Authenticated raw body buffering is capped before multipart parsing, including chunked requests. Native inference times out at 90 seconds; capacity remains occupied until the native job actually finishes. A supervisor must terminate/restart a worker on a hung native runtime; Python cannot safely cancel a native thread. Use process/container memory and request limits, gateway timeouts, and no public ingress. Audit logs allow only request ID, fixed route, HTTP status, latency, registered model ID and exception type; no uploaded filenames, bodies, IPs, credentials, raw labels or exception messages.
