# SONRI Baseline

Updated 2026-10-16. Research implementation; no clinical or production approval.

Application baseline: `e02f602811e4d36a3ac32fe18e5e455018c6938f`, latest remote main when cloned. Dedicated branch: `feat/sonri-v3-modular-evidence`.

Reused Next.js 15.5.27, Firebase verified ID tokens/revocation, record ownership, independent assigned dentist review, idempotent screening persistence, versioned review audits, deterministic emergency triage before image decoding, existing 124-entry WHO catalog, image normalization, HEIC safeguards, dataset consent/split/annotation gates. PostgreSQL components remain legacy; no migration performed.

Initial execution: `npm ci --ignore-scripts`, `npm test` (99 passed), `npm run typecheck` (passed). No clinical model was installed in the default patient pipeline. Existing local prototype branches were not copied into main or substituted for latest source.

Changes add research inference and structured clinician evidence. Existing engine serialization version is retained for old records; reasoning changes carry `oral-rules-research-2`.
