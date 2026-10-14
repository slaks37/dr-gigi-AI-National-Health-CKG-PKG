# Audit baseline — dr Gigi AI

Date: 14 October 2026 (Asia/Jakarta). Source: `main` at `358a7344e922aad174075bf6377f2ccf8e98abf9`. Repair branch: `repair/security-clinical-safety`.

## Executed baseline

| Check | Actual outcome |
|---|---|
| `npm ci --ignore-scripts` | FAILED: package/lock mismatch; Next and ESLint config locked at 15.5.12 while manifest requested 15.5.24; optional platform entries missing. |
| Dependency reconciliation | `npm install --ignore-scripts` succeeded; baseline source was subsequently tested from a pristine `git archive` with the reconciled dependency tree. |
| `npx tsc --noEmit` on pristine source | FAILED: recursive compression wrapper had an invalid three-argument self-call; four nullable searchParams errors. |
| Existing `npm run lint` | Exit 0, but original config did not include a TypeScript parser/config. This did not establish TSX coverage. |
| Existing `npm run build` | FAILED locally fetching Google fonts under restricted networking. Original config also bypassed both type and lint validation. |
| Existing tests | No test script or suite existed. |
| Dependency audit after baseline reconciliation | 39 advisories: 1 low, 18 moderate, 16 high, 4 critical. No patient data or live integrations were contacted. |

## Evidence and priorities

| Severity | Source path / reproducible trigger | Root cause | Repair strategy |
|---|---|---|---|
| P0 | `app/api/records/route.ts`: anonymous GET with role=admin; POST a reused recordId | Client identity/permitted scope trusted; repository upsert did not verify ownership | Verified token, custom claims, default-deny ownership and transaction conflict checks |
| P0 | appointments/activity/stats/auth sync routes | Missing authentication; activity impersonation; admin stats readable; role accepted at registration | Central API guard, admin-only stats/audits, no user-supplied actor/role |
| P0 | `firestore.rules`, `components/AuthProvider.tsx` | User could write role; rules used that role; email granted optimistic admin state | Server-issued custom claims only; explicit assignment scope; browser medical writes denied |
| P0 | SATUSEHAT sync route | Returned fake 201/sync IDs without an HTTP submission | NOT_CONFIGURED gate; separate preliminary local collection preview |
| P0 | IoT API and modal | Read token but never verify; global memory telemetry; hardcoded readings applied to form | Disabled ingestion; no demo measurements or device connection claims |
| P0 | clinic action and initial clinic page | Generated clinics; substituted phones/hours; random BPJS/ratings/reviews | Real OSM results only; unknown metadata retained; honest errors |
| P0 | adult/child/anthropometry/consultation clinical paths | Empty findings interpreted as healthy; confidence defaults; photo height/weight guesses; synthetic waveform and posture claims | Disable clinical inference pending validation; explicit display states; remove clinical simulations/defaults |
| P1 | browser DB helper | Unscoped local clinical cache; automatic guest reassignment; independent Firestore/SQL writes; swallowed failures | No new browser medical storage; no automatic legacy import/deletion; authoritative server Firestore writes |
| P1 | checkup feedback handlers | Model result.id was not the persisted record ID; success set before persistence | Separate savedRecordId; feedback PATCH against stored record; confirm before success |
| P1 | settings | Save success without storage; fake credentials/device/log state | Account preference persistence; truthful integration readiness; server-only secrets |
| P1 | image compression / overlays | Shadowed imported function; no geometry bounds; default photo mirroring | Single decoded/compressed utility; explicit mirror flag and bounded boxes |
| P2 | build/lint/CI/dependencies | No CI; validators bypassed; security advisories | Enforce actual checks, test suites, patched runtime dependencies |

## Boundaries

No production deployment, rules publication, role changes, SQL mutation, patient-data test or medical validation was performed. All demonstrated attacks were reproduced against synthetic fixtures, mocked authentication or a local demo emulator. Production IAM, existing profile integrity, patient migration, clinician assignment and actual provider availability remain external acceptance gates.
