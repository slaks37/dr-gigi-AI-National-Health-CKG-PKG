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
