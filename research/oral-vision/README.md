# Local SONRI research runtime

This optional runtime is separate from patient screening. No model is clinically approved.

Use Python 3.12 in a private virtual environment. The exact tested macOS arm64 dependency set is in `requirements.lock.txt`; do not install it into system Python.

```sh
python3 -m venv /private/location/venv
/private/location/venv/bin/pip install -r research/oral-vision/requirements.lock.txt
```

Keep the downloaded checkpoint and manifest outside Git. Download through the owner's authorized Roboflow UI; do not bypass export gates. Record the exact SHA-256 and source/license evidence. The tested artifact SHA-256 is `9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c`.

An operator-reviewed manifest must explicitly provide:

```json
{
  "model_id": "intraoral-caries-detection-ynpy9-1-rfdetr-large-t1",
  "model_version": "dataset-v1",
  "architecture": "RFDETRLarge",
  "artifact_sha256": "9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c",
  "license": "Apache-2.0",
  "artifact_use_approved": true,
  "image_use_approved": true,
  "input_modality": "INTRAORAL_PHOTO",
  "class_labels": {"0": "Caries", "3": "Tooth"},
  "threshold": 0.25
}
```

These are raw model labels, never clinician-confirmed findings. IDs 0 and 3 were observed in Roboflow sample output. The UI also lists Cavity and Crack, but their IDs were not independently established; detections for unmapped IDs fail closed until verified against an authorized export. Check class IDs against the actual dataset/model export before using other artifacts. The manifest permissions are operator attestations and do not establish patient consent. The runtime smoke test used a synthetic flat field; it did not evaluate these labels on clinical images.

Run once with a permitted image:

```sh
/private/location/venv/bin/python research/oral-vision/run_local.py \
  --manifest /private/location/model.json \
  --artifact /private/location/weights.pt \
  --image /private/location/permitted-image.jpg \
  --output /private/location/new-prediction.json --timeout 120
```

Output is created exclusively (existing files are not overwritten). Failure exits nonzero without producing findings. First import/setup is included in the wall-clock deadline; result `processing_ms` measures model initialization and prediction only. The direct runner supports JPEG/PNG/WebP with pixel/byte bounds and EXIF orientation normalization. No URLs or cloud inference are supported. Networks are blocked in process; absent dependencies/backbone caches fail closed. Safe checkpoint loading remains enabled; no unrestricted pickle fallback.

For the optional administrator lab, set absolute private paths in ignored `.env.local`:

```dotenv
SONRI_RESEARCH_PYTHON=/private/location/venv/bin/python
SONRI_RESEARCH_MANIFEST=/private/location/model.json
SONRI_RESEARCH_ARTIFACT=/private/location/weights.pt
```

Start the existing Next.js app on an owner-controlled machine. `/admin/vision-lab` requires a server-verified admin. Never set these variables on hosts without the required Python/storage/CPU/runtime support. The Python process has a deliberately limited environment, 2 CPU threads, no external sockets, one worker run at a time and a 90-second deadline. Temporary source images/output are removed by the app. SIGKILL/power failure may leave OS temp files; host retention cleanup is an operator responsibility.

Software checks:

```sh
python3 -m unittest discover -s research/oral-vision -p 'test_*.py'
SONRI_LOCAL_MODEL_TEST=1 npx vitest run tests/local-vision.integration.test.ts
```

The second command also requires the three configured paths. Tests use synthetic input only. No training was run; no benchmark or clinical accuracy is implied. ONNX and segmentation require separate parity/alignment verification.
