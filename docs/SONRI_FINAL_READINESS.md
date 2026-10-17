# SONRI Final Readiness

Updated 2026-10-16. Research implementation; no clinical or production approval.

This is an incremental implementation, not completion of the full clinical platform vision.

| Module | Research status | Patient clinical model |
|---|---|---|
| Caries | INFERENCE_TESTED on synthetic input only | UNAVAILABLE; no clinical approval |
| Gingival / periodontal | ARCHITECTURE_READY; structured measurements | UNAVAILABLE |
| Mucosa / tongue | ARCHITECTURE_READY; questionnaire/review rules | UNAVAILABLE |
| Structure / development | ARCHITECTURE_READY; dentition/structural reasoning | UNAVAILABLE |
| Clinical / radiographic evidence | ARCHITECTURE_READY; authorized interpretation workflow | UNAVAILABLE |

All modules: training/evaluation DATASET_BLOCKED; no automatic promotion. ICD terminology: 124 entries; no independently approved clinical model, full inclusion/exclusion review, or external code coverage.

Research GO: local or isolated Neon cloud synthetic input/permission-reviewed research only, with proper operator setup. Clinical-data research remains gated by consent/license and dataset security. Staging NO-GO for medical use; infrastructure and authorized cohort acceptance not performed. Production NO-GO: independent clinical evaluation, dentist review, privacy/regulatory sign-off and explicit owner release approval remain required.

No merge, production deployment, paid API use, permission modification or database migration performed. Draft PR is the review destination. See final execution report for branch/commit/PR and final test counts.

Remote main protection could not be verified/enabled: GitHub returned HTTP 403 requiring an eligible plan or public visibility. Neither was changed. This is an additional release blocker.

Verification: 122 unit/API tests, 30 emulator tests, 8 browser tests, 4 Python contract tests and 1 separately enabled real-checkpoint/synthetic-image integration test passed. TypeScript, lint, build and production dependency audit passed. No positive-lesion or independent clinical metrics were measured.

## Neon cloud research runtime

Real RF-DETR inference is running on a separate Neon research branch using ONNX Runtime WASM CPU. The local Model Lab configuration selects this runtime with separate cloud transfer consent. Application production deployment is unchanged. Five raw checkpoint output slots remain unmapped; clinical availability remains UNAVAILABLE. [Runtime evidence](../research/neon-vision/README.md).

## Browser AI research update — 2026-10-17

Real ONNX inference now runs in the administrator Browser AI panel using a dedicated Web Worker, explicit WebGPU/WASM selection, owner-selected local model and verified optional model cache. Synthetic-only decoded parity passed on desktop Chrome. Five raw slots remain unmapped; no clinical record input or automatic Neon fallback is enabled. Existing local and Neon reference implementations are unchanged.

Current verification: 136 unit/API tests passed (one optional artifact test skipped in the default suite); nine browser smoke tests passed against the newly started local production build. Nine real synthetic inference runs and nine browser fault cases passed separately in the loopback benchmark harness; EXIF/RGB checks and cache reloads passed. TypeScript and production build passed; ESLint has no errors and retains the existing Neon style warning. The build required network access for existing Google Fonts after sandbox DNS failed. Clean installation completed; production dependency audit was clear. Full dependency audit reported seven high-severity development-tool findings in the existing braces/fast-glob/Firebase/ESLint chain; no breaking automated downgrade was applied.

No mobile physical hardware, live Firebase administrator flow on Vercel Preview, private-weight public hosting or clinical evaluation is claimed. Preview acceptance remains pending and no production deployment/merge occurred. Read [the complete browser runtime report](../research/browser-vision/README.md) and its measured evidence.
