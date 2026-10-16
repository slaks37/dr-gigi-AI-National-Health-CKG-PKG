# SONRI Qa Results

Updated 2026-10-16. Research implementation; no clinical or production approval.

Initial baseline: 99 unit tests and TypeScript passed. Implementation verification results are recorded in `SONRI_FINAL_READINESS.md`; refresh this document if additional code changes occur.

Executed positive paths: optional checkpoint downloaded and SHA-256 verified; real CPU model load/predict with synthetic input; TypeScript-to-Python subprocess integration; structured clinician evidence schema and emulator persistence; existing ownership/clinical review/annotation protections; terminology export; synthetic threshold/IoU arithmetic.

Executed failure coverage: anonymous/patient/doctor Model Lab denial; missing runtime returns 503; patient injection of clinician evidence; mismatched performed exams; invalid FDI, duplicate sites, impossible depths, empty interpretations; bad prediction provenance/hash/box/score/unreviewed label; false positive duplicates and class mismatches; unknown symptoms; research adapter clinical unavailability; existing image quality/MIME/corrupt/duplicate/deadline and emergency regression coverage.

Not executed: positive-lesion clinical cohort evaluation, approved oral-region model, masks, model-family comparisons, ONNX parity, hosted staging identity/data flow, clinical approval. Local runtime tests are not clinical validation. First sandbox build failed on Google Fonts DNS; network-enabled build succeeded. First stale-browser download timed out; refreshed session produced real checkpoint. No failure was substituted with fabricated output.

Final executed results on this implementation:

| Command | Outcome |
|---|---|
| `npm test` | 122 passed; one artifact-dependent test skipped in default suite |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no warnings/errors |
| `npm run test:rules` | 30 passed against synthetic Firestore emulator |
| `npm run test:e2e` | 8 passed against local production build |
| `python3 -m unittest discover -s research/oral-vision -p 'test_*.py'` | 4 passed |
| `SONRI_LOCAL_MODEL_TEST=1 ... npx vitest run tests/local-vision.integration.test.ts` | 1 passed with actual checkpoint and synthetic JPEG; optional test executed separately, not merely skipped |
| `npm run build` | Passed; all 29 routes generated |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities reported |
| `npm run vision:coverage -- <output>` | 124-row matrix exported |
| `npm run vision:benchmark -- <synthetic-input> <output>` | Synthetic threshold report exported; not a model benchmark |
| `git diff --check` | Passed |

Manual local browser readback verified all five module cards and unknown initial answers. Screenshots and final report are delivered outside repository under outputs. Hosted CI must be inspected separately after PR creation.
