# SONRI V3.1 browser research runtime

Validated 2026-10-17 on this desktop; this is an administrator research experiment, not clinical AI. Existing five-module workflows, emergency triage, terminology, dentist review, local Python research and Neon reference code are preserved. There is no automatic cloud fallback or patient database migration.

## Actual artifact audit

The private file was available locally and audited with ONNX checker, not assumed from an earlier report. It is 121,573,930 bytes (115.94 MiB), opset 17, FP32, 1,654 nodes. SHA256: `a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0`. Input `input`: `[1,3,704,704]`; outputs `dets`: `[1,300,4]`, and `labels`: `[1,300,5]`. See evidence/model-audit.json.

Model identity: `intraoral-caries-detection-ynpy9-1-rfdetr-large-t1`, version `dataset-v1-onnx-fp32`. Output names are graph names: `labels` contains logits, not verified disease names. All five slots remain `RAW_CLASS_0` through `RAW_CLASS_4`; no slot is guessed to be background. Mapping UNVERIFIED, clinical use PROHIBITED. Four rounded synthetic rectangles eliciting predictions are not evidence of oral-region specificity or clinical accuracy.

## How to run

1. `npm ci --ignore-scripts`, then `npm run build` (or `npm run dev`). Explicit prebuild/predev generates the worker and the pinned `onnxruntime-web@1.30.0` runtime. No model downloads occur during installation/build.
2. Start the app with `npm run start -- --port 3010`. Sign in with an actual administrator and open `/admin/vision-lab` -> Browser AI. The server rechecks the administrator token and explicit synthetic research permission before a run.
3. Choose the owner-authorized local ONNX file with the checksum above. This file stays in the browser; the app does not expose a download URL or upload endpoint for it. Authorize local synthetic research. File access is the operator's explicit action.
4. Select Auto, WebGPU or WASM and a built-in synthetic fixture. GPU initialization fallback is opt-in in Auto; explicit WebGPU never silently becomes WASM. Comparison runs use the same fixture with explicit providers.
5. Repeat for session reuse; optionally cache only the verified model and reload to test cache. Every cache read is size-bounded and SHA256 verified. Clear-cache removes the versioned model cache. Stop/release terminates the worker without clearing a deliberately saved model cache.

Only built-in permitted synthetic fixtures can be selected for Browser AI. There is no patient image picker in this section. Existing local/remote image experiments remain separate, with their existing permissions.

## Processing and lifecycle

The browser-only runtime import is performed inside a dedicated module Worker after deliberate interaction. Auto capability detection checks secure context, WebAssembly, GPU adapter, OffscreenCanvas and reported device memory; <4 GB is conservatively refused. Unknown memory is reported as unknown, not safe/validated; initialization can still fail. Single-thread WASM needs no global cross-origin isolation headers.

The image decoder uses EXIF `from-image`, no premultiplication/color-space conversion, and an exact-size canvas read to RGB. The custom resize uses bilinear half-pixel centers with float32 scale/source-coordinate rounding measured against PyTorch, then ImageNet normalization and Float32 NCHW. It does not ask Canvas to approximate resize. PNG/RGB checksums, independently generated PyTorch probes and tensor hashes are recorded. All four full-resolution synthetic fixture probe comparisons passed, with observed maximum absolute difference <0.000001. The synthetic EXIF orientation-6 JPEG also passed dimensions and RGB probes (observed channel difference 0).

Decoding preserves all five logits per query, sigmoid scores, global top-300 query/class pairs, threshold >0.25 and normalized coordinates 0–1000. It verifies names, full shapes, finite scores/boxes and detection limits. The displayed image is the exact versioned synthetic fixture whose decoded RGB checksum was checked. Predictions have no route into clinical records; client-supplied predictions/findings/ICD confirmations are rejected by clinical request schemas.

One pending run, duplicate-click guard, 120-second timeout, page interruption cleanup, worker termination, tensor disposal, session release on provider changes and session reuse are implemented. Memory/initialization failures never return replacement predictions. Cache API stores model artifacts only; images are not persisted in Cache API, IndexedDB, localStorage or a service worker. Photo/model bytes are not sent to analytics or server logs. Public benchmark JSON contains synthetic results and capability metadata only.

## Measured desktop results

Actual installed Google Chrome 155.0.8059.80, headless browser automation, macOS ARM64, 8 GiB physical RAM. Initial spike reported an Apple Metal-3 adapter. This is genuine desktop browser execution, not Android/iPhone emulation. WebGPU EP can assign shape/unsupported operations to the CPU; these timings do not mean every graph node ran on GPU.

| Measurement (ms) | WebGPU | WASM CPU |
|---|---:|---:|
| First local model read | 94.4 | 174.3 |
| Model SHA256 | 86.2 | 64.1 |
| Initial session creation | 957.2 | 283.7 |
| Cold inference | 415.2 | 3339.0 |
| Warm inference, reused session | 300.8 | 3265.3 |
| Initial worker total | 1833.5 | 4078.8 |
| Warm worker total | 362.2 | 3300.0 |
| Verified cache read after reload | 25.4 | 39.1 |
| Cache SHA256 after reload | 58.9 | 59.7 |

These are observed samples, not percentiles or a device-wide performance promise. Worker totals include local model/runtime setup and fixture processing, but exclude operator file selection and real Firebase authorization round-trip. Model network download and warm-download times are N/A: approved hosting strategy C uses a local file. Runtime JS/WASM assets do load over the app origin and can use versioned HTTP caching. No photo/model uploads or cloud inference were seen in the benchmark network trace.

Decoded parity passed on all tested fixtures: rounded rectangles returned four detections matching the original PyTorch reference; flat/noise/gradient returned the same zero detections. The latter does not prove health. Maximum score difference on the shapes fixture was 0.000003004; maximum normalized box difference was 0.000000134. Earlier raw-array comparisons were not equivalent on query ordering; only decoded prediction parity is claimed.

The worker cannot measure GPU/WASM/process peak memory; values are explicitly null. The initial main-thread compatibility spike (evidence/initial-compatibility.json) measured ~132 MB JS heap, which excludes GPU/WASM allocations and is not peak process usage. No unmeasurable memory number is fabricated.

The UI benchmark runs the real React panel and generated worker in a loopback-only harness. Its administrator authorization callback is an explicit isolated test stub and its Next Image wrapper is replaced by an equivalent plain image for the standalone harness. Production API authorization is separately unit-tested with verified-claim mocks; anonymous denial is tested against the actual Next app. A live Firebase administrator sign-in -> run has not been tested end-to-end, and is a Preview acceptance item.

Reproduce with installed Chrome: `node scripts/benchmark-browser-vision.mjs /private/model.onnx /private/results`. The server permits only runtime/synthetic assets on 127.0.0.1, never the model or work directory. Fault injection exists only in that test server, never in the production worker. Temporary corrupt-artifact copies are deleted. `--orientation-only` tests the JPEG decoder without inference.

## Compatibility and failure matrix

| Environment | Status | Evidence |
|---|---|---|
| Desktop Chrome, real ARM64 hardware | PASSED WebGPU and WASM | Nine real runs, cache reloads, decoded parity and overlay screenshot |
| Android Chrome, physical device | NOT_TESTED | No Android hardware available |
| iPhone Safari, physical device | NOT_TESTED | No iPhone hardware available |
| Low-memory physical device | NOT_TESTED | The injected 2-GB response is a functional rejection test, not hardware benchmarking |

Real-browser fault tests passed: runtime asset 404, WebGPU absent -> CPU selection, injected GPU initialization failure with allowed CPU fallback, the same failure with fallback denied, reported memory <4 GB, same-size corrupt model checksum, truncated cache, page interruption and cancellation. Unit tests cover timeout/duplicate requests, incorrect output shapes, invalid predictions, non-square PyTorch preprocessing, API authorization and research-output injection into clinical input. The model itself has no network URL; the actual app returns 404 for an unhosted model asset. No automatic Neon invocation occurs.

To test real phones, use an approved HTTPS Preview (plain LAN HTTP lacks the needed secure context), sign in as admin, and transfer the owner-authorized model into private Files storage using an approved method. Open Browser AI on that actual device, export cold/warm/cache results, stop/clear, and compare the same fixture/provider. Record real OS/browser versions and physical device; do not relabel responsive emulation as hardware evidence. Respect private-weights authorization: anyone receiving the model can extract it. No mobile support/latency/recall claim is made before those tests.

## Hosting, budget and optimizations

[Current Vercel limits](https://vercel.com/docs/limits#static-file-uploads) document a 100 MB Hobby CLI **source-upload** ceiling (1 GB Pro). This is not the Functions payload/bundle limit, and does not by itself establish every Git/build-output limit. The 121.6 MB original artifact exceeds that source-upload allowance and is private. It is neither committed nor placed in public assets. The selected zero-service-cost strategy is C, local operator file selection. No public/external model hosting is enabled; do not bypass this by chunking or renaming private weights.

Generated pinned runtime assets total about 86.4 MB; all public assets are about 87.4 MB, without model weights. Build-time generation keeps them out of Git; exact sizes/hashes are in the runtime integrity manifest. The deployment must still verify its actual source/build-output and plan quotas. App routes do not trace ONNX runtime/model files into Vercel inference functions. Model execution is on the device. Runtime assets have immutable versioned caching; no eager runtime request is made for anonymous visits. A build guard rejects model-file extensions or files >=100 MB in public assets.

A real MatMul/Gemm-only dynamic INT8 conversion produced 39,027,388 bytes and ran on native CPU (~510 ms in that sample), but its maximum score shift was 0.088888 on the synthetic shapes fixture. It failed the original FP32 score-parity tolerance and is NOT_PROMOTED; browser compatibility and clinical accuracy were not established for it. No such variant is served or committed. See evidence/int8-spike.json. FP16/mixed precision was investigated in [official guidance](https://onnxruntime.ai/docs/performance/model-optimizations/float16.html) but not converted/benchmarked in this delivery; smaller architecture checkpoints and approved training labels are unavailable. Do not substitute an untrained generic detector. A future mobile candidate should be an owner-authorized, appropriately trained smaller RF-DETR variant, with reviewed label mapping and independent patient-disjoint evaluation before any recall/accuracy claim. Graph optimization `all` is enabled on the original model; no unmeasured speed-up is claimed.

Additional service resources purchased or billing upgrades enabled: **Rp0**. No paid AI/GPU API, new database, hosting upgrade, production deployment or cloud inference is used for this browser experiment. Device power, preexisting subscriptions and user data-plan costs are not measured; runtime delivery consumes bandwidth and remains subject to the existing hosting quota. This is not a promise of unlimited free public traffic.

## Preview readiness and remaining gates

Local production build and browser prototype are working. No Vercel project is linked in this checkout and no Vercel Preview URL has been deployed or tested. Status: READY_FOR_REVIEW / PREVIEW_ACCEPTANCE_PENDING. Before a Preview, provide its existing approved Firebase Admin environment and authorized HTTPS domain, check current plan and generated asset limits, then test actual administrator sign-in -> local model -> inference. No production configuration, merge or deployment is authorized by this implementation.

Remaining gates: real Android/iPhone/low-memory hardware, mobile memory/thermal/battery behavior, live Firebase administrator flow on Preview, authorized public weight distribution if ever wanted, smaller-model evaluation, authoritative labels, clinical validation and owner release approval. Patient screening remains unchanged and unavailable for this model.

Technical references: [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html), [WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html), [worker/runtime flags](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html), [quantization](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html), [owner RF-DETR fork](https://github.com/slaks37/rf-detr), [ONNX Runtime source](https://github.com/microsoft/onnxruntime).
