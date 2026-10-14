# Security changes in the clinical/dataset implementation

All new endpoints use verified Firebase token authentication. Reviewer and SONRI scope claims are server trusted. Patient/subject ownership, independent reviewer assignment and expected record versions prevent cross-owner access, self-confirmation and stale overwrites. Legacy records reject forged screening/confirmed-code payloads.

Screening creation validates strict bounded schemas, consent, MIME magic, pixel limits, abort/deadline budgets, shared quotas and idempotent content hashes. HEIF decoding runs in a bounded local worker; no external conversion service receives patient bytes. Worker limits are defense in depth, not a general sandbox.

Dataset import is admin-only metadata; it cannot silently overwrite existing records or import a reviewed label. Hash/version checks bind annotations to the right file. Independent review preserves corrections and invalidates image approval when annotations change. Private files stay outside Git; no secret or source image is committed. Direct browser writes to internal clinical/dataset/quota collections are denied.

Audit records include clinical evidence and must remain privileged with an approved retention policy. Production IAM, retention, backups, credential review and legacy-role reconciliation remain deployment work; no live rules or roles were changed.

Development tooling contains an unresolved braces stack-exhaustion advisory affecting lint/emulator dependency chains; [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) listed no patched version at verification. These tools do not accept patient-supplied glob patterns in this implementation. Runtime-only audit is clean; full-tree counts are reported separately, not described as a vulnerability-free toolchain.
