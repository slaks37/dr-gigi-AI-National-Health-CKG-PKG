# Deployment and rollback — production release BLOCKED

No deployment, production rules update, privileged-role mutation or production DB migration was performed.

## Before any release

1. Review and approve the PR and the restricted clinical feature behavior. Obtain explicit production rollout approval.
2. Take and restore-test Firestore/SQL backups. Identify legacy-only SQL records, partial/mismatched dual writes and duplicate stable record IDs. Build a reconciliation manifest that excludes patient content from logs. This was not executed: no database access was provided.
3. Verify Firebase Admin ADC/Workload Identity, least-privilege IAM, project alignment and the named Firestore database. Never copy a service-account key into the repo or browser config. The existing Firebase web config is public application configuration, not Admin credentials; validate its API restrictions in the console.
4. Manually approve a role allowlist from independently verified staff identities. Existing profile/SQL roles are untrusted because old code allowed client role assignment. Set custom claims using an authorized server/operator; revoke old privileged sessions, reauthenticate and verify the refreshed token. No email-based auto-promotion.
5. Define/approve clinician assignment scope, provisioning and revocation. Current doctor list views are owner-scoped; an assigned record can be fetched by ID. No assignment-management UI is claimed.
6. Reconcile legacy records into the authoritative store only after verifying owner, backup, stable IDs, field-preserving merge and version/provenance. Never auto-import shared-browser guest caches. Arrange explicit local backup/purge; old cache data is quarantined, not automatically destroyed by this repair.
7. Test the new rules and API against staging. Coordinate app+rules release: old browser versions that wrote directly to Firestore will fail under the new rules, and new server mutations require the new app. Force refresh stale clients. Never temporarily reopen anonymous/role-edit access for compatibility.
8. Run CI and staging smoke tests, including real Firebase verification, administrator access, owner feedback/delete, invalid claims and revoked/disabled accounts. Confirm retention, audit/export, clinician-signoff and deletion governance.
9. Keep AI, IoT and SATUSEHAT gates disabled. Enabling requires a separate reviewed and validated implementation, clinical approvals and sandbox tests. Do not expose integration secrets through settings.
10. Review remaining development-only advisories and restrict CI to trusted dependencies/no secrets on pull requests. npm production audit has zero reported vulnerabilities at the recorded run; tooling advisories remain open.

## Migration / restore status

No schema or production data mutation was applied. SQL schema already declares unique stable record IDs. Query/retention/index changes and role/data reconciliation require environment-backed testing and approval. Emulator exercises server create/read/feedback/version conflict/delete and idempotent transactions; it does not establish recovery from production backups.

## Rollback

Keep backups and a reconciliation manifest before release. On a staging/production incident, keep secure rules and identity gates; disable writes/integrations and preserve audit evidence. Do not roll back to the original public medical APIs or role-edit rules. Restore backed-up data only through an approved operator process and compare record ID, ownership, version and audit history. Database rollback was not exercised because no production/staging database access existed.

## Package-manager decision

Npm is the declared package manager and the supported CI/install path. `package-lock.json` was reconciled, and `npm ci --ignore-scripts` is validated. Bun was not installed in this environment; the historical `bun.lock` is preserved and is not a supported/validated install path for this repair. Do not run a frozen Bun install against that historical lock. A future switch requires a separately regenerated and tested Bun lock rather than silently reusing old vulnerable resolutions.
