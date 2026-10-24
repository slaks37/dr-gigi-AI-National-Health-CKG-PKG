import hashlib
import io
import json
import logging
import time
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from sonri_inference.adapters import InvalidModelOutput, box, score
from sonri_inference.api import create_app
from sonri_inference.config import Settings
from sonri_inference.quality import InvalidImage, decode_image
from sonri_inference.registry import Registry

TOKEN = "local-test-token-that-is-at-least-32-bytes"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def image_bytes(noise=True, width=256, height=256):
    array = np.random.default_rng(17).integers(0, 255, (height, width, 3), dtype=np.uint8) if noise else np.full((height, width, 3), 127, dtype=np.uint8)
    stream = io.BytesIO()
    Image.fromarray(array).save(stream, format="PNG")
    return stream.getvalue()


def setup_model(tmp_path, **overrides):
    artifact = tmp_path / "test.onnx"
    artifact.write_bytes(b"test fixture; not a trained model")
    entry = {"id": "oral-classifier", "enabled": True, "version": "unit-test-fixture",
             "checkpoint": str(artifact), "sha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
             "license": "TEST_FIXTURE", "license_acknowledged": True, "trusted_checkpoint": True,
             "output_format": "nchw-logits"} | overrides
    path = tmp_path / "registry.json"
    path.write_text(json.dumps({"schema_version": "1", "models": [entry]}))
    return Settings(api_token=TOKEN, registry_path=path, model_root=tmp_path)


def post(client, *, model="intraoral-yolo", modality="intraoral", data=None, opt=True, mime="image/png", headers=None):
    return client.post("/v1/infer", headers=AUTH if headers is None else headers,
                       data={"model_id": model, "modality": modality, "research_opt_in": str(opt).lower()},
                       files={"file": ("patient-name-never-log.png", image_bytes() if data is None else data, mime)})


def test_auth_and_missing_configuration():
    with TestClient(create_app(Settings())) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/v1/models").status_code == 503
    with TestClient(create_app(Settings(api_token=TOKEN))) as client:
        assert client.get("/v1/models").status_code == 401
        assert client.get("/v1/models", headers={"Authorization": "Bearer wrong"}).status_code == 401
        response = client.get("/v1/models", headers=AUTH)
        assert response.status_code == 200
        assert len(response.json()["models"]) == 7
        assert all(not model["available"] for model in response.json()["models"])
        assert "checkpoint" not in response.text
        assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("model,modality", [("intraoral-yolo", "intraoral"), ("oral-classifier", "intraoral"),
    ("panoramic-dentex", "panoramic"), ("panoramic-bone-loss", "panoramic"), ("cbct-toothseg", "cbct"),
    ("comparative-rfdetr", "intraoral"), ("comparative-maskrcnn", "intraoral")])
def test_each_path_explicitly_unavailable(model, modality):
    with TestClient(create_app(Settings(api_token=TOKEN))) as client:
        response = post(client, model=model, modality=modality)
        assert response.status_code == 503
        assert response.json()["status"] == "unavailable"
        assert response.json()["reason"]
        assert response.json()["findings"] == []
        assert response.json()["clinical_use"] == "PROHIBITED"


def test_opt_in_modality_unknown_and_validation():
    with TestClient(create_app(Settings(api_token=TOKEN))) as client:
        assert post(client, opt=False).json()["reason"] == "RESEARCH_OPT_IN_REQUIRED"
        assert post(client, modality="cbct").json()["reason"] == "MODEL_MODALITY_MISMATCH"
        assert post(client, model="someone's private info").json()["reason"] == "UNKNOWN_MODEL"
        response = post(client, modality="not-valid")
        assert response.status_code == 422
        assert "not-valid" not in response.text


def test_auth_happens_before_upload_limit():
    with TestClient(create_app(Settings(api_token=TOKEN, max_upload_bytes=10))) as client:
        assert post(client, data=b"a" * 100_000, headers={}).status_code == 401
        response = post(client, data=b"a" * 100_000)
        assert response.status_code == 413


def test_chunked_body_limit_is_enforced_without_content_length():
    with TestClient(create_app(Settings(api_token=TOKEN, max_upload_bytes=10))) as client:
        response = client.post("/v1/infer", headers=AUTH, content=(b"a" * 10_000 for _ in range(8)))
        assert response.status_code == 413
        assert response.json()["reason"] == "UPLOAD_TOO_LARGE"


def test_rate_limit():
    with TestClient(create_app(Settings(api_token=TOKEN, requests_per_minute=1))) as client:
        assert client.get("/v1/models", headers=AUTH).status_code == 200
        assert client.get("/v1/models", headers=AUTH).status_code == 429


def test_registry_integrity_trust_and_path(tmp_path):
    settings = setup_model(tmp_path, sha256="a" * 64)
    registry = Registry(settings)
    assert registry.availability(registry.models["oral-classifier"])[1] == "CHECKPOINT_SHA256_MISMATCH"
    settings = setup_model(tmp_path, trusted_checkpoint=False)
    registry = Registry(settings)
    assert registry.availability(registry.models["oral-classifier"])[1] == "TRUSTED_CHECKPOINT_ACKNOWLEDGMENT_REQUIRED"
    settings = setup_model(tmp_path, license_acknowledged=False)
    registry = Registry(settings)
    assert registry.availability(registry.models["oral-classifier"])[1] == "LICENSE_REVIEW_REQUIRED"
    settings = setup_model(tmp_path, checkpoint="/etc/passwd")
    registry = Registry(settings)
    assert registry.availability(registry.models["oral-classifier"])[1] == "CHECKPOINT_OUTSIDE_MODEL_ROOT"


def test_registry_does_not_allow_modality_override(tmp_path):
    settings = setup_model(tmp_path, modality="cbct")
    with pytest.raises(ValueError, match="cannot change"):
        Registry(settings)


def test_quality_checks_do_not_claim_modality_or_diagnosis():
    image, quality = decode_image(image_bytes(), "image/png", "intraoral", 1_000_000)
    assert quality["accepted"]
    assert quality["compatibility"] == "MODALITY_SELF_REPORTED"
    image.close()
    image, quality = decode_image(image_bytes(False), "image/png", "intraoral", 1_000_000)
    assert not quality["accepted"]
    assert "LOW_DETAIL_OR_BLUR" in quality["reasons"]
    image.close()
    with pytest.raises(InvalidImage):
        decode_image(b"not image", "image/png", "intraoral", 1_000_000)
    with pytest.raises(InvalidImage, match="MIME_CONTENT_MISMATCH"):
        decode_image(image_bytes(), "image/jpeg", "intraoral", 1_000_000)
    with pytest.raises(InvalidImage, match="PIXEL_LIMIT"):
        decode_image(image_bytes(), "image/png", "intraoral", 10)
    image, quality = decode_image(image_bytes(), "image/png", "panoramic", 1_000_000)
    assert "PANORAMIC_ASPECT_INCOMPATIBLE" in quality["reasons"]
    image.close()


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -0.1, 1.1])
def test_invalid_scores_rejected(value):
    with pytest.raises(InvalidModelOutput):
        score(value)


@pytest.mark.parametrize("coords", [[0, 0, 0, 1], [0, 0, 2, 1], [float("nan"), 0, 1, 1]])
def test_invalid_boxes_rejected(coords):
    with pytest.raises(InvalidModelOutput):
        box(coords)


def test_api_completed_contract_uses_test_double_not_inference_evidence(tmp_path, monkeypatch, caplog):
    from sonri_inference import api
    settings = setup_model(tmp_path)
    app = create_app(settings)
    monkeypatch.setattr(app.state.registry, "availability", lambda _spec: (True, None))
    class FixtureAdapter:
        def infer(self, _image):
            return [{"kind": "classification", "raw_label": "RAW_CLASS_0", "class_id": 0, "score": .6}]
    monkeypatch.setattr(api, "create_adapter", lambda _spec: FixtureAdapter())
    caplog.set_level(logging.INFO, logger="sonri.inference.audit")
    with TestClient(app) as client:
        response = post(client, model="oral-classifier")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "completed"
        assert body["clinical_use"] == "PROHIBITED"
        assert body["label_verification"] == "UNVERIFIED"
        assert "NEGATIVE_OUTPUT_DOES_NOT_ESTABLISH_HEALTH" in body["warnings"]
        assert "diagnosis" not in body
        assert post(client, model="oral-classifier", data=image_bytes(False)).status_code == 422
        assert post(client, model="oral-classifier", data=b"invalid").status_code == 422
    assert TOKEN not in caplog.text
    assert "patient-name" not in caplog.text
    assert str(tmp_path) not in caplog.text


def test_runtime_failure_is_sanitized(tmp_path, monkeypatch, caplog):
    from sonri_inference import api
    app = create_app(setup_model(tmp_path))
    monkeypatch.setattr(app.state.registry, "availability", lambda _spec: (True, None))
    def fail(_spec):
        raise RuntimeError("private patient name from badly behaved model")
    monkeypatch.setattr(api, "create_adapter", fail)
    with TestClient(app) as client:
        response = post(client, model="oral-classifier")
        assert response.status_code == 503
        assert response.json()["reason"] == "MODEL_RUNTIME_FAILED"
        assert "private patient" not in response.text
        model = next(item for item in client.get("/v1/models", headers=AUTH).json()["models"] if item["id"] == "oral-classifier")
        assert not model["available"]
        assert model["runtime_status"] == "FAILED"
    assert "private patient" not in caplog.text


def test_timeout_keeps_capacity_until_native_job_finishes(tmp_path, monkeypatch):
    from sonri_inference import api
    settings = setup_model(tmp_path)
    app = create_app(Settings(**(settings.__dict__ | {"inference_timeout": .01})))
    monkeypatch.setattr(app.state.registry, "availability", lambda _spec: (True, None))
    class SlowAdapter:
        def infer(self, _image):
            time.sleep(.3)
            return []
    monkeypatch.setattr(api, "create_adapter", lambda _spec: SlowAdapter())
    with TestClient(app) as client:
        assert post(client, model="oral-classifier").status_code == 504
        assert post(client, model="oral-classifier").status_code == 429
