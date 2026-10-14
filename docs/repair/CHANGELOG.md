# Changelog — security and clinical safety repair

- Central verified Firebase authentication, trusted custom-claim roles, explicit ownership/assignment policy and private/no-store API responses.
- Firestore server transactions with append-only audit, version-checked feedback and idempotent create retry. New records remain unreviewed drafts; SQL is quarantined pending migration.
- Remove browser medical persistence, automatic shared-browser guest reassignment, silent SQL sync and ownership-blind overwrites. Preserve legacy caches until explicit user cleanup after backup.
- Replace fake SATUSEHAT acceptance with NOT_CONFIGURED and preliminary local DRAFT preview.
- Disable unvalidated clinical inference, rPPG, posture overlays, device ingestion and simulated clinical form values.
- Eliminate fictitious clinic referrals and substituted metadata; escape sourced facility strings before Leaflet HTML interpolation.
- Correct image compression recursion, input decoding/size limits, URL cleanup, overlay geometry/mirroring, feedback record ID and persistence-confirmation behavior.
- Persist account accessibility/language preferences; remove fake secrets, diagnostics and sync logs from live settings.
- Restore type/lint enforcement and TypeScript-aware lint; reconcile npm lock; patch Next.js/jsPDF/runtime dependencies and add regression/emulator/browser CI.
- Remove global error suppression/fetch rewriting that concealed runtime failures.

See AUDIT_BASELINE.md for root causes and QA_TEST_REPORT.md for actual test results. Production clinical/integration readiness is explicitly blocked pending credentials, migrations and validation.
