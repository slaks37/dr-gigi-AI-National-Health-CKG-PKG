# SONRI implementation evidence — 24 October 2026

Branch: `codex/sonri-integrated-platform`, based on main commit `e02f602`.

This delivery is a functioning integrated research application with real local pretrained execution. It does **not** satisfy the entire software or clinical-production definition of done: operational hosted identity/database/inference staging, additional verified model bundles, independent clinical benchmarks and clinical/regulatory approvals remain outstanding. Production has not been merged, promoted, migrated or activated.

## Implemented and executed

| Area | Delivered behavior and evidence |
|---|---|
| Consolidation | All ten requested source repositories inspected at pinned live commits; architectures, sources, checkpoint pointers, licenses, permissions and integration risks in `consolidation/repositories.json` and `REPOSITORY_AUDIT.md`. Three local checkpoint hashes freshly verified. |
| Inference | Separate authenticated, bounded FastAPI worker; quality checks; canonical provenance-rich raw outputs; separate optional ONNX/YOLO dependencies; disabled defaults and explicit modality/model unavailable states. |
| Real pretrained runs | RF-DETR ONNX and Daath YOLO executed twice through FastAPI on deterministic synthetic geometry. RF-DETR produced 12 raw detections; YOLO produced zero. Both repeat outputs matched. No disease semantics or accuracy inferred. Evidence in `services/inference/evidence/`. |
| Integrated inference | Real Auth emulator login → administrator browser → Next API → authenticated Python HTTP worker → pretrained ONNX → transactional model run and audit in Firestore emulator. Evidence `services/inference/evidence/application-browser-smoke.json`; no patient data or source image saved. |
| Terminology | SATUSEHAT's official documentation requires WHO ICD-10 **2010**, replacing the previous 2019 reference. Exactly 15 categories + 108 terminal codes from official WHO source snapshot/hash. K02.5 and ICD-10-CM extensions rejected. |
| Clinical reasoning | Deterministic rules cite actual finding IDs/affirmative symptoms; missing-evidence checklists, required/conditional examinations and unconfirmed differentials; terminology coverage explicitly separate from clinically validated AI scope. |
| Clinical application | `/sonri` workspace; email/Google sign-in; existing adult/child profile, history, consent, photo-quality/triage paths; assigned independent dentist review; structured encounter examination and FDI odontogram; previous/current revisions and consent attestations; immutable approved encounter; authorized history and escaped HTML report printable to PDF. |
| Authorization and persistence | Existing Firebase architecture retained. Server-verified roles/custom claims, owner/assigned-case checks, independent reviewer, optimistic versions, atomic revisions/consents/audits. Raw patient images and identifiers are not placed in localStorage. |
| Interoperability | Local-only FHIR collection preview from stored confirmed WHO2010 diagnoses and clinician-authored odontogram, with reviewer provenance. Supplied IHS identifiers remain unverified preview metadata. No remote submission or production integration claim. |
| Operations | Separate nonroot app/inference Dockerfiles, private/read-only model mounts and inference network, pinned Python dependency profiles, CI jobs, environment, staging, rollback and backup playbook. Docker executable is unavailable on this host, so container execution was not verified. |

## Actual verification

| Check | Result |
|---|---|
| TypeScript typecheck and ESLint | Passed |
| JavaScript unit/API/rule/contract tests | **126 passed** across 9 files |
| Firestore rules and integration tests | **36 passed** across 3 files using demo emulator only |
| Python inference tests | **25 passed**; `pip check` found no broken requirements |
| Production app build | Passed on Next.js 15.5.28, Node 24; 37 routes |
| Production-build browser checks | **8 passed**, including mobile workspace and new API anonymous denial |
| Authenticated synthetic browser workflows | **2 passed**: clinical lifecycle and real model integration |
| Production dependency audit | **0 reported vulnerabilities** after compatible patch updates |
| Model repeatability smoke | Real RF-DETR and YOLO runs completed; outputs repeat identically on synthetic input |

Hosted acceptance initially exposed Vercel's instrumented CommonJS loader rejecting the Firebase Admin → jwks-rsa → jose ESM chain (`ERR_REQUIRE_ESM`) before API handlers initialized. The dependency chain is explicitly bundled through Next.js `transpilePackages`; JWT libraries are not downgraded. Local build/auth/workflow checks and the replacement Preview must pass before treating that runtime defect as resolved.

Tests do not establish model sensitivity, specificity, precision, recall, F1, mAP, Dice, calibration or false-negative performance. No independent clinical benchmark, physical mobile-device model benchmark or model training was performed. The normal CI workflow skips the additional pretrained-browser case unless a reviewed private checkpoint/worker is explicitly configured; it never downloads unlicensed weights to make CI pass.

Reproduce the model browser case by starting a reviewed local research worker, setting private `SONRI_INFERENCE_URL`/`SONRI_INFERENCE_TOKEN`, and running `SONRI_MODEL_E2E=1 SONRI_MODEL_FIXTURE=/secure/synthetic.png npm run test:workflow`. These are synthetic local test accounts; never point test emulators or fixtures at real patient systems. Main check commands and service setup are in the root and inference READMEs.

## Outstanding gates and precise blockers

1. **Hosted staging:** the existing `sonri-browser-ai-research` Vercel project is a research Preview with `SONRI_RESEARCH_PREVIEW=1`. This blocks protected clinical/account/storage APIs. Isolated authorized Firebase identity/Admin/database configuration, private hosted inference ingress and hosted full-workflow acceptance are required for operational staging. A rendered Preview or liveness response is insufficient.
2. **Clinical labels and performance:** RF-DETR's exact checkpoint has no trusted disease class order; Daath labels `d/D` remain semantically unverified. Raw outputs never become confirmed findings or ICD-10 diagnoses. Independent clinician-approved data, thresholds and evaluation are missing.
3. **Other pathways:** classifier export/permissions, DENTEX-compatible weights and validated FDI mapping, bone-loss weights/calibration and verified ToothSeg nnU-Net task/plans/checkpoint volume contract are not installed/verified. CBCT execution and automatic FDI numbering are explicitly unavailable. An official ToothSeg artifact pointer/license is recorded; availability of a download is not verified runtime compatibility.
4. **Data and licensing:** source/code/checkpoint/dataset permissions are distinct. In particular the oral classifier dataset reports unknown licensing; DENTEX data has noncommercial/share-alike terms. Owner-side licensing review is needed before incorporating or commercializing affected artifacts. No private patient dataset was downloaded or trained upon.
5. **Historical terminology:** existing stored records are not bulk rewritten. Historical terminology versions must be reviewed before reconfirmation/export to a WHO2010-only integration. New reviews validate codes and record the current version.
6. **SATUSEHAT sandbox:** permitted sandbox credentials, organization/practitioner/patient/encounter resolution, profile validation and successful authorized remote tests are unavailable. Current FHIR output is a local draft only.
7. **Infrastructure/security:** no Docker runtime on this host; cloud CPU/GPU hosting, budget/scaling measurements, identity/storage retention configuration, backup restoration rehearsal and hosted security acceptance need an authorized environment. A credential exposure in an older supporting repository was documented without copying its value; the owner must revoke/rotate it.
8. **Production:** independent clinical validation, clinician scope approval, regulatory/legal/privacy/security clearance and operational clinical oversight remain required. No production activation has occurred.

See `operations/STAGING_PLAYBOOK.md` for staged acceptance and rollback. Do not enable clinical models or remove the research Preview gate solely to satisfy a completion checklist.
