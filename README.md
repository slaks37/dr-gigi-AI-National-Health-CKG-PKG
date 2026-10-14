# dr Gigi AI — repair candidate

This branch contains a security/clinical-safety repair and is not approved for production rollout. Clinical AI, rPPG/posture predictions, device ingestion and SATUSEHAT submission are deliberately disabled pending validation. Firestore is authoritative; legacy SQL/role reconciliation is required before release. No production data migration was executed.

Use Node 24 and npm (the reconciled `package-lock.json` is authoritative). The historical `bun.lock` is retained but has not been regenerated/tested; do not use it as a frozen install for this branch.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run test:rules    # Requires Java 21; demo emulator and synthetic identities only
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

Read [the executive summary](docs/repair/EXECUTIVE_SUMMARY.md), [actual QA results](docs/repair/QA_TEST_REPORT.md) and [deployment/migration prerequisites](docs/repair/DEPLOYMENT_CHECKLIST.md). Never deploy production or update production rules without explicit approval. Do not enable gated clinical features merely by adding credentials.

## Experimental hybrid screening implementation

Adult/pediatric screening now starts with a tri-state symptom questionnaire and deterministic emergency triage, followed by bounded local image checks and independent clinical review. The oral model registry is empty; the system does not fabricate detections or diagnose from an LLM photo prompt. Source images are not retained.

See [architecture](docs/SYSTEM_ARCHITECTURE.md), [dataset audit](docs/DATASET_AUDIT.md), [clinical limitations](docs/CLINICAL_LIMITATIONS.md) and [release gates](docs/DEPLOYMENT_CHECKLIST.md). This branch depends on the security repair and remains unapproved for production clinical use.

`npm run dataset:inventory` performs optional authorized read-only metadata discovery. Configure `SONRI_ROOT_FOLDER_ID`, `GOOGLE_DRIVE_READONLY_ACCESS_TOKEN` and `DATASET_PRIVATE_OUTPUT` securely; output must be outside this repository. Never commit patient source data.

`npm run dataset:prepare -- manifest.json annotations.json options.json /secure/private/output` exports a gated frozen COCO manifest only after documented permissions, independent review, quality and leakage checks. It does not train a model.
