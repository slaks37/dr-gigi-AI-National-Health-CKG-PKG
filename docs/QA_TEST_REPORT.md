# Software QA — 14 October 2026

Checks on the implementation candidate: TypeScript, ESLint, unit tests, Firestore rules/API emulator tests, production build, Playwright smoke tests and runtime dependency audit. Local result: 99 unit tests, 29 emulator tests and seven browser tests passed. Final commit and hosted CI are recorded in the delivery report.

Clean installation, TypeScript, ESLint and production build succeeded; runtime `npm audit --omit=dev` reported zero vulnerabilities. The real preparation CLI exported synthetic-only COCO with 64/8/8 partitions and models_trained: 0. This was not SONRI training. Unit tests cover deterministic triage, unknown symptoms, invalid media, exact duplicates, EXIF stripping, actual synthetic HEIC decode, unavailable detector, malformed adapter output, geometry and deadlines. Dataset tests cover pagination, privacy, weak labels, eligibility, grouping, independent annotation constraints and synthetic manifest preparation.

Emulator cases cover anonymous access, owned subject/guardian, cross-owner isolation, emergency persistence failures, quotas, idempotency, forged legacy confirmation, trusted assignment, clinician evidence/version gates and independent annotation review. Browser cases verify emergency guidance before upload/login and truthful unavailable-model/dataset states.

All identities, records, clinical observations and codec fixtures used in automated tests are synthetic. No production medical write, real dataset pixel validation, clinical model accuracy measurement or actual training was performed. Metadata discovery is a separate authorized live read-only check. Missing-credential inventory CLI correctly blocks; that does not prove live CLI access.

Final clean dependency tree verification (`npm ls esbuild --depth=4`) passed after reconciling the esbuild override and Vite optional peer. Full dependency audit: seven high findings in development-only braces/lint/emulator chains, zero moderate findings; runtime-only audit: zero. The upstream braces advisory had no patched version at verification. No automatic breaking downgrade was applied.
