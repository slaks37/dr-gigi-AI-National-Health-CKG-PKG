# SONRI implementation evidence — 24–25 October 2026

Branch: `codex/sonri-integrated-platform`, based on main commit `e02f602`.

Phase 2 continues verified commit `b1c9b395d0feece7898583f43a4dbc82ce79459b` on the same branch. The existing implementation is preserved. [Executed container evidence](validation/staging-acceptance.v1.json) records the tested branch and GitHub merge revisions separately.

The subsequent [Phase 3 evidence and blockers](PHASE3_STATUS.md) cover full-source label provenance, independent benchmark tooling, keyless Cloud Run identity and isolated Firebase staging preparation. Earlier execution records below retain their original scope.

This delivery is a functioning integrated research application with real local pretrained execution. It does **not** satisfy the entire software or clinical-production definition of done: operational hosted identity/database/inference staging, additional verified model bundles, independent clinical benchmarks and clinical/regulatory approvals remain outstanding. Production has not been merged, promoted, migrated or activated.

## Preserved Phase 1 implementation

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
| Operations | Separate nonroot app/inference Dockerfiles, private/read-only model mounts and inference network, pinned Python dependency profiles, CI jobs, environment, staging, rollback and backup playbook. Docker is absent on this desktop; Phase 2 runs actual container acceptance on Linux CI. |

## Recorded Phase 1 verification

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
7. **Infrastructure/security:** synthetic Docker build, authentication, restart and emulator restoration are now exercised on Linux CI; managed-service backup restoration, cloud hosting, capacity, identity/storage retention and hosted security acceptance still require an authorized environment. The exposed supporting-repository credential remains OPEN / DEFERRED_BY_OWNER; no secret was copied or tested. See [incident evidence](validation/security-incident.md).
8. **Production:** independent clinical validation, clinician scope approval, regulatory/legal/privacy/security clearance and operational clinical oversight remain required. No production activation has occurred.

See `operations/STAGING_PLAYBOOK.md` for staged acceptance and rollback. Do not enable clinical models or remove the research Preview gate solely to satisfy a completion checklist.

## Phase 2 executed work and evidence

- Actual pretrained YOLO CPU reproduction on **17 public CC BY 4.0 intraoral images**, 59 reference boxes. Compatible raw class 0: TP45 / FP11 / FN7; raw class 1: TP7 / FP2 / FN0 at confidence 0.25 and IoU 0.5. All metrics were recomputed from the recorded predictions and matched exactly. Source-test reproduction does not establish independent clinical accuracy. [Metrics, false negatives and uncertainty](validation/dataset-evaluation.md).
- A prediction-independent annotation comparison proves a class-contract conflict: all 59 source YOLO boxes geometrically match LabelMe labels, but raw index 0 corresponds to source `D` and raw index 1 to `d`, contradicting checkpoint-declared names. Both checkpoint disease mappings remain **UNVERIFIED**. RF-DETR's exact Roboflow version, modality and category contract remain unavailable. [Versioned evidence](validation/labels.v1.json).
- Patient identity, complete training membership and pixel/near-duplicate independence are unverified. The strict independent-benchmark gate rejects the source cohort and unresolved class/reference contracts. The supplied Drive folder was inspected through metadata only; authorization, independent annotations and anonymous patient-group manifests are absent from returned metadata. Two capped listings prevent a complete inventory claim. Public-link write access was observed and not modified. [Drive eligibility](validation/drive-eligibility.json).
- **123 explicit evidence rows** cover 15 categories and 108 terminal codes. Terminology and research examination checklists are available for all 108 terminal codes; verified AI finding bindings, independent actual-data evaluations and professional validations remain zero. Available at `/evidence-coverage`, authenticated `/api/clinical-coverage`, and [JSON/CSV exports](validation/icd10-evidence-coverage.v2.csv). This is a descriptive evidence ledger, never runtime clinical approval.
- All four additional models have refreshed artifact, input, licensing and evaluation blockers. A CC BY 4.0 oral-classifier checkpoint was downloaded privately, hashed and inspected as HDF5 data; it has not executed. No additional model is operational. [Readiness evidence](validation/additional-model-readiness.md).
- Local checks passed: **136 application tests, 43 Python tests (25 inference + 18 evaluation), 3 credential-scanner tests, 9 production browser tests**, TypeScript, ESLint and production build. The browser tests include the mobile evidence matrix and unauthenticated coverage-API rejection. CI additionally verifies rules, synthetic authentication and generated-export freshness.
- Actual Docker Compose acceptance executes on GitHub Actions with Auth/Firestore emulators and a private, disabled-model worker. Browser lifecycle, authorization, logging, restart and six-collection export/recreation/import are exercised. Exact tested revisions, CI runs and sanitized artifacts are recorded in [Phase 2 operational evidence](operations/PHASE2_STAGING_REQUIREMENTS.md).

No private Drive image was opened or downloaded. No new training, paid GPU, managed Firebase provisioning, clinical-production deployment or professional validation was performed. Existing research Preview configuration was not changed.
