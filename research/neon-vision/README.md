# Neon RF-DETR research compute

This function runs the owner's real RF-DETR Large checkpoint on cloud CPU through ONNX Runtime WASM. No Python service or laptop inference process is needed. The existing clinical screening adapter remains unavailable; Model Lab results cannot create confirmed diagnoses or ICD-10 codes.

## Verified deployment, 2026-10-16

- Project `empty-mode-44213888` (`sonry-oralytics-2-0`), free_v3, AWS us-east-1.
- Isolated branch `br-frosty-night-b8xf2z0m`, function `sonriinfer`, deployment 1, Node.js 24.
- Private `sonri-model-artifacts` bucket: model 121573930 bytes and WASM runtime 14239897 bytes. Function package ~41 KB; large artifacts stay outside its code bundle.
- Original checkpoint SHA256 `9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c`.
- Exported ONNX SHA256 `a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0`.
- Runtime WASM SHA256 `3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2`.
- Live unauthenticated request: 401. Authenticated synthetic self-test: 200, four real raw detections, ~35.7 seconds total, ~954 MiB process RSS. SONRI adapter -> cloud `/infer`: passed four-detection parity with PyTorch, ~22.5 seconds total, maximum score difference ~0.0000031 and normalized box difference <0.0000001. Timing is a measured sample, not a latency guarantee.
- Native ONNX/PyTorch decoded parity passed on flat, seeded noise, gradient and synthetic rounded rectangles. Full raw tensor parity on noise failed because selected-query ordering differs; no claim of identical internal arrays. Decoded predictions above 0.25 are the acceptance comparison.

## Label safety

The checkpoint has five output slots, 0–4. It contains no authoritative class-name metadata. IDs observed on hosted sample predictions cannot establish the exported checkpoint mapping. Preserve all slots, including slot 4; do not guess a background class. Display only `RAW_CLASS_<id>`, never a disease name. Label mapping remains UNVERIFIED and clinical use PROHIBITED. Synthetic boxes do not establish oral-region specificity, accuracy, sensitivity or clinical safety.

## App connection

Set server-only `SONRI_CLOUD_FUNCTION_URL` to the HTTPS invocation root and `SONRI_CLOUD_ORIGIN_SECRET` to the function's random ORIGIN_SECRET. Keep them in a private environment store, never NEXT_PUBLIC, Git or browser state. Local `.env.local` is configured on the development checkout. Existing deployed application environment has not been changed.

Model Lab administrators choose Neon cloud CPU and separately authorize sending the test image tensor to US East. The server validates and normalizes the image, decodes RGB, performs bilinear half-pixel resize without antialiasing to 704x704, applies ImageNet normalization, gzip-compresses NCHW Float32LE, then sends it to `/infer`. The tensor remains image-derived sensitive data; compression/normalization does not anonymize it. No patient image was used in deployment or verification. A cross-border processing checkbox is not a substitute for institution authorization.

The response must match the pinned model version, artifact hash, image hash, tensor hash and unmapped raw labels. Timeout, upstream error or mismatched provenance fails closed without fabricated output or local fallback. Patient screening does not invoke this function.

## Function packaging and configuration

Export with `rfdetr==1.11.2`, CPU, ONNX opset 17; use the owner-approved checkpoint and retain its checksum. The export was tested using torch 2.14.1, onnx 1.23.2 and onnxsim 0.8.1. Install `onnxruntime-web==1.30.0` in an isolated Node workspace. Obtain its version-matched MIT license from the official ONNX Runtime repository when absent in the npm package, placing it at runtime root/LICENSE.

Run `node build.mjs /private/runtime/node_modules/onnxruntime-web /private/synthetic-fixture.f32.gz /private/function-dist` from this directory. The fixture is exactly 1x3x704x704 normalized float32 little-endian bytes, gzip-compressed, generated only from a synthetic image. No patient fixture is permitted. ZIP the contents of that output directory, not the directory itself. Keep model weights, WASM binary and secrets out of the ZIP and Git.

Deploy the ZIP to the isolated Neon branch with runtime nodejs24, slug sonriinfer. Environment fields: MODEL_BUCKET, MODEL_KEY, MODEL_SHA256, WASM_KEY, WASM_SHA256, ORIGIN_SECRET (random >=32 chars), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION. Use a credential scoped to storage:read; environment contains secrets and must never be printed. Branch storage uses a private bucket. Large artifacts are downloaded with SigV4 and SHA256 checked before execution. Model session caches per function isolate.

A 0.25 CU supporting database endpoint was required before the new branch's invocation URL routed correctly; no schema or patient data was created/migrated. The main branch was untouched. The account rejected a custom suspend interval; plan defaults remain in effect. The supporting endpoint is now idle/suspended; function inference succeeded independently of its running state. No plan upgrade or paid service was enabled. Free quotas are finite and shared at project level; review current [pricing](https://neon.com/pricing) before sustained use. This deployment is research traffic only.

## Controls and limitations

Authentication is checked before input handling or initialization. Request/decompression/artifact limits, fixed tensor dimensions/ranges, per-isolate concurrency 1 and 5 requests/minute, SHA validation, no request-body logging, private no-store responses and sanitized failures are enforced. Rate limits are per isolate, not a distributed global spend cap. Neon CPU performance and cold starts may vary. Platform-managed logs/retention require a separate institutional review before patient processing.

Run function tests against a built bundle: `SONRI_FUNCTION_ENTRY=/absolute/function-dist/index.mjs node --test test.mjs`. App tests include separate cloud consent, provenance rejection and RGB normalization. Actual cloud verification requires credentials and a synthetic fixture; mocked unit tests alone are insufficient.

References: [Neon Functions limits](https://neon.com/docs/compute/functions/reference/runtime-limits), [function authentication](https://neon.com/docs/compute/functions/authentication), [ONNX Runtime](https://github.com/microsoft/onnxruntime/tree/v1.30.0), [RF-DETR](https://github.com/roboflow/rf-detr).
