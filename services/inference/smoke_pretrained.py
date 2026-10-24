"""Real pretrained API execution on synthetic geometry; no clinical performance claims."""
import argparse
import hashlib
import io
import json
import platform
import secrets
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from sonri_inference.api import create_app
from sonri_inference.config import Settings
from sonri_inference.registry import sha256_file


def synthetic_fixture():
    pixels = np.random.default_rng(20261024).integers(90, 160, (704, 704, 3), dtype=np.uint8)
    image = Image.fromarray(pixels)
    drawing = ImageDraw.Draw(image)
    for row in range(3):
        for column in range(6):
            x, y = 65 + column * 96, 80 + row * 210
            drawing.rounded_rectangle((x, y, x + 60, y + 135), radius=18, fill=(220, 210, 196), outline=(48, 51, 58), width=4)
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=["rfdetr", "yolo"], default="rfdetr")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--acknowledge-research-license", action="store_true", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    checkpoint = args.checkpoint.resolve()
    if sha256_file(checkpoint) != args.sha256:
        raise ValueError("Checkpoint digest mismatch")
    known_hashes = {"rfdetr": "a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0", "yolo": "7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d"}
    if args.sha256 != known_hashes[args.model]:
        raise ValueError("This smoke only supports the audited research artifacts")
    artifact = {"id": "comparative-rfdetr", "version": "dataset-v1-onnx-fp32-a73a2bb52bca", "checkpoint": str(checkpoint),
        "sha256": args.sha256, "enabled": True, "license": "Apache-2.0 recorded in prior owner-authorized export notice; current terms not reverified",
        "license_acknowledged": True, "trusted_checkpoint": True, "class_names": {str(cid): f"RAW_CLASS_{cid}" for cid in range(5)},
        "class_mapping_verified": False, "input_size": 704, "output_format": "rfdetr-cxcywh-logits"}
    if args.model == "yolo":
        artifact.update(id="intraoral-yolo", version="daath-yolo11m-7d5f7dcf616f", license="AGPL-3.0 per upstream source; local research only; commercial obligations pending review",
                        class_names={"0": "d", "1": "D"}, input_size=640, output_format="ultralytics")
    token, fixture, responses = secrets.token_urlsafe(48), synthetic_fixture(), []
    with tempfile.TemporaryDirectory(prefix="sonri-synthetic-smoke-") as temporary:
        registry = Path(temporary) / "registry.json"
        registry.write_text(json.dumps({"schema_version": "1", "models": [artifact]}))
        application = create_app(Settings(api_token=token, registry_path=registry, model_root=checkpoint.parent))
        with TestClient(application) as client:
            headers = {"Authorization": f"Bearer {token}"}
            available = next(m for m in client.get("/v1/models", headers=headers).json()["models"] if m["id"] == artifact["id"])
            if not available["available"]:
                raise RuntimeError(available["reason"])
            for _ in range(2):
                response = client.post("/v1/infer", headers=headers,
                    data={"model_id": artifact["id"], "modality": "intraoral", "research_opt_in": "true"},
                    files={"file": ("synthetic-geometry.png", fixture, "image/png")})
                if response.status_code != 200:
                    raise RuntimeError(response.text)
                responses.append(response.json())
    result = {"executed_at_utc": datetime.now(timezone.utc).isoformat(), "http_status": 200,
        "test_kind": "REAL_PRETRAINED_SYNTHETIC_API_SMOKE_AND_REPEATABILITY",
        "runtime": {"python": platform.python_version(), "platform": platform.platform(), "engine": args.model, "provider": "CPUExecutionProvider"},
        "model": available, "fixture": {"kind": "deterministic synthetic geometric RGB image", "patient_data": False, "sha256": hashlib.sha256(fixture).hexdigest(), "width": 704, "height": 704},
        "repeat_findings_identical": responses[0]["findings"] == responses[1]["findings"], "responses": responses,
        "clinical_validation": "NOT_PERFORMED", "dataset_benchmark": "NOT_PERFORMED",
        "limitations": ["Synthetic image execution only", "Five class slots have no trusted semantic names", "No sensitivity, specificity, mAP, Dice or calibration can be inferred", "Current commercial model terms require independent review"]}
    if not result["repeat_findings_identical"]:
        raise AssertionError("CPU output changed between repeated requests")
    if args.model == "rfdetr":
        result["runtime"]["onnxruntime"] = __import__("onnxruntime").__version__
    if args.model == "yolo":
        result["runtime"].pop("onnxruntime", None)
        result["runtime"].update(torch=__import__("torch").__version__, ultralytics=__import__("ultralytics").__version__, provider="PyTorch CPU")
        result["limitations"][1] = "Raw checkpoint labels d/D have no trusted clinical semantics"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"http_status": 200, "findings": len(responses[0]["findings"]), "cold_ms": responses[0]["latency_ms"], "warm_ms": responses[1]["latency_ms"], "repeat_findings_identical": True, "clinical_use": "PROHIBITED"}))


if __name__ == "__main__":
    main()
