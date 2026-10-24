# SONRI AI

Integrated dental and oral examination research application, built on the existing Dr Gigi Next.js/Firebase foundation. Firestore remains authoritative; no production data migration is included.

The application separates observed findings, suspected/differential diagnoses and clinician-confirmed diagnoses. It includes the WHO ICD-10 2010 K00–K14 reference catalog used for SATUSEHAT compatibility: 15 categories and 108 terminal codes. Terminology coverage does not establish AI diagnostic capability. Clinical rules, model performance, regulatory/privacy approval and production activation remain pending.

## Use the application

| Route | Purpose |
| --- | --- |
| `/sonri` | Integrated examination workspace and terminology scope |
| `/login` | Email or Google sign-in using operator-provisioned Firebase accounts |
| `/checkup`, `/checkup-anak` | Adult/child profile, consent, symptoms, bounded image checks and triage |
| `/clinical-review` | Administrator assignment; qualified assigned dentist examination, FDI odontogram, evidence and diagnosis confirmation |
| `/examinations` | Authorized examination history and downloadable HTML report, printable to PDF |
| `/model-lab` | Administrator-only model inventory, synthetic-image research inference and raw annotations |
| `/evidence-coverage` | Per-code evidence status for WHO ICD-10 K00–K14, separate from AI capability |

A trusted `clinicalReviewer` claim and case assignment are required for dentist confirmation. Browser profile changes cannot grant clinical privileges. Research model outputs cannot confirm ICD-10 codes; no detection does not establish health. Source patient images are not retained by this examination flow or saved in browser localStorage.

## Local development

Use Node 24, npm and the committed `package-lock.json`. Configure an authorized Firebase development/staging project consistently for the browser and Firebase Admin; server credentials use Application Default Credentials. Keep secrets in a private local environment or secret manager. See [.env.example](.env.example) and the [operations playbook](docs/operations/STAGING_PLAYBOOK.md).

```sh
npm ci --ignore-scripts
npm run dev
```

Open `http://localhost:3000/sonri`. Without valid identity-provider/Admin configuration, protected account and database operations remain unavailable. Do not use real patients to test configuration.

The separate [FastAPI inference service](services/inference/README.md) runs with Python 3.12 and its own model-specific dependencies. The app uses `SONRI_INFERENCE_URL` and `SONRI_INFERENCE_TOKEN`; the worker uses `INFERENCE_API_TOKEN`, `SONRI_MODEL_REGISTRY` and `SONRI_MODEL_ROOT`. The two token values must match and contain at least 32 characters. Checkpoints stay outside Git and container images. All models are disabled by default; missing weights, rights or compatible exports produce explicit unavailable states. CBCT volume execution and automatic FDI numbering remain unavailable.

## Verification

Java 21 is required for the synthetic Firebase emulator tests. Run the authenticated workflow last because it uses a separate `.next-workflow` output and Auth/Firestore emulators.

```sh
npm run typecheck
npm run lint
npm test
npm run test:rules
npm audit --omit=dev
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:workflow
```

`test:workflow` exercises synthetic patient login → screening → administrator assignment → dentist examination/odontogram → confirmation → report through local Auth and Firestore. It does not establish hosted identity-provider or clinical performance. Python boundary tests and real pretrained synthetic smoke evidence are documented in the [inference service](services/inference/README.md). The [source audit](docs/consolidation/REPOSITORY_AUDIT.md) covers all ten requested repositories and records verified checkpoint hashes, source licenses and precise blockers.

## Deployment status and gates

[Docker/Compose and staging instructions](docs/operations/STAGING_PLAYBOOK.md) keep Next.js separate from ML workers, mount models read-only and leave inference private. The [Phase 2 acceptance harness and hosted requirements](docs/operations/PHASE2_STAGING_REQUIREMENTS.md) exercise synthetic Auth/Firestore, browser workflows, private inference boundaries, authorization, observability and recovery on a Docker-capable CI runner. Only completed runs and artifacts establish a pass. Full hosted Firebase/database/inference staging is not configured; independent clinical dataset benchmarks have not run.

Phase 2 includes an actual pretrained YOLO reproduction on 17 public CC BY 4.0 dental images, with per-class-index TP/FP/FN, localization geometry, AP and uncertainty. [The evaluation evidence](docs/validation/dataset-evaluation.md) documents seven raw-index false negatives and a cross-format annotation class conflict. Both YOLO and RF-DETR disease mappings remain UNVERIFIED; source reproduction is not independent clinical validation. [All 108 terminal codes](docs/validation/icd10-evidence-coverage.v2.csv) have explicit terminology/workflow/finding/evaluation/approval status. No code currently has a verified AI finding binding, independent actual-data evaluation or professional validation. [Additional-model readiness](docs/validation/additional-model-readiness.md) and the [open credential incident](docs/validation/security-incident.md) record remaining artifact, licensing and owner-action blockers.

The existing Vercel project `sonri-browser-ai-research` is a research Preview target. Its `SONRI_RESEARCH_PREVIEW=1` configuration blocks protected account/clinical-storage API workflows. A rendered Preview is not operational clinical staging. Keep that flag enabled until authorized isolated identity, storage and inference configuration and complete hosted acceptance are established. SATUSEHAT submission, remote generative clinical diagnosis and production patient use remain disabled.

Production requires independent clinical validation, clinician-approved scope and thresholds, applicable clearance, verified privacy/security controls, operational oversight and explicit release authorization. Never enable gated medical capabilities merely by adding credentials.

Authorized dataset tools remain available: `npm run dataset:inventory` retrieves metadata only; `npm run dataset:prepare -- manifest.json annotations.json options.json /secure/private/output` exports a frozen COCO manifest after permission, quality, independent review and leakage gates. Neither command trains a model. Keep patient source data and private exports outside this repository.
