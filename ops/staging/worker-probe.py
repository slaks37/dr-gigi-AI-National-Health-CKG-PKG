"""Run inside the private worker. No model, patient bytes or credential output."""
import json
import os
import urllib.error
import urllib.request
import uuid

token = os.environ["INFERENCE_API_TOKEN"]
assert len(token) >= 32
checks = []


def check(name, path, status, authorization=None, data=None, content_type=None):
    headers = {}
    if authorization:
        headers["Authorization"] = f"Bearer {authorization}"
    if content_type:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(f"http://127.0.0.1:8000{path}", data=data, headers=headers)
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    assert response.status == status, name
    body = json.load(response)
    assert body["clinical_use"] == "PROHIBITED"
    assert response.headers["Cache-Control"] == "no-store"
    assert len(response.headers["X-Request-Id"]) == 32
    checks.append({"name": name, "status": response.status})
    return body


check("worker liveness", "/healthz", 200)
check("missing worker credential", "/v1/models", 401)
check("wrong worker credential", "/v1/models", 401, "synthetic-wrong-token")
inventory = check("private authenticated inventory", "/v1/models", 200, token)
assert inventory["models"] and all(not m["available"] for m in inventory["models"])
boundary = uuid.uuid4().hex
fields = {"model_id": "intraoral-yolo", "modality": "intraoral", "research_opt_in": "true"}
parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n' for key, value in fields.items()]
parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic"\r\nContent-Type: image/png\r\n\r\nSYNTHETIC_NO_PATIENT_DATA\r\n--{boundary}--\r\n')
result = check("disabled model fails closed", "/v1/infer", 503, token,
               "".join(parts).encode(), f"multipart/form-data; boundary={boundary}")
assert result["findings"] == []
assert result["label_verification"] == "UNVERIFIED"
print(json.dumps({"scope": "SYNTHETIC_PRIVATE_WORKER_BOUNDARY", "checks": checks,
                  "clinical_validation": "NOT_PERFORMED"}))
