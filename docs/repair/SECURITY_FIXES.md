# Security fixes

## Trust boundaries

`src/server/security.ts` validates Firebase ID tokens with `verifyIdToken(token, true)`, including revocation/disabled-account checks. Missing/invalid tokens return 401. Privileged actions use verified custom claims only, never profile.role, query role, request UID, email allowlists or frontend state. Ordinary authenticated users default to patient; unassigned doctors have no cross-patient access. Admin stats/audit access returns 403 to other roles.

Responses are private/no-store. Unexpected failures return a generic 503; provider/DB errors, NIK, images and raw health reports are excluded from API logs. JSON requires the correct content type and is bounded by actual streamed bytes, nesting depth and node count. Domain payloads reject unrecognized fields and owner/provenance/assignment spoofing.

`src/server/resources.ts` provides owner-scoped pagination and explicit authorized resource lookup. Create, feedback and delete run in Firestore transactions with a server audit event. Existing clinical resources cannot be overwritten; matching create retries are idempotent via canonical payload hash. Feedback requires a version and cannot replace clinical data. A clinician can read explicitly assigned records but cannot delete somebody else's record.

`firestore.rules` uses custom claims, limits profile reads, denies self-promotion and denies direct browser clinical/appointment/audit writes. Patient-profile updates cannot alter owner or assignment. All new clinical mutations use the server service account, so its IAM permission and project/database alignment must be verified in staging.

`components/AuthProvider.tsx` derives role from token claims, defaults safely and remounts descendant state when identity changes. Client API responses arriving after an identity switch are rejected. Legacy unscoped cache content is not read or automatically imported. An explicit settings action can purge old caches after the user has secured a backup; the repair does not silently delete them.

## SQL and compatibility

Firestore is authoritative for this repair. No clinical API reads/writes SQL. Legacy SQL source is retained for a controlled migration; doctor-wide access, ownership-blind upserts and raw error logging were also reduced there. Do not treat legacy SQL roles or user-editable Firestore profile roles as trusted.

API request contracts changed (records/appointments now use `{ id, payload }`, feedback uses PATCH). Browser callers were changed with them. This requires a coordinated deployment; stale clients must refresh. Physician assignments, privileged claims and legacy-only SQL records need approved migration before rollout. No existing production database was modified.

## Validation

See QA_TEST_REPORT.md for actual executed tests, including real emulator transactions and browser denial checks. Firebase token verification calls are mocked in deterministic API/transaction tests; live revoked-token and service-account behavior remain staging checks. No clinical inference/network cost is permitted while the safety gate is active, so anonymous/authorized users cannot consume AI provider quota.
