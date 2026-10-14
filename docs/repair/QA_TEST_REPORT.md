# QA test report

Date: 14 October 2026, Asia/Jakarta. All medical/device identities and measurements in tests are synthetic. No production patient data, clinical provider or SATUSEHAT transaction was used.

## Executed checks

| Command / evidence | Actual result |
|---|---|
| Baseline `npm ci --ignore-scripts` | FAIL — inconsistent lockfile |
| Baseline TypeScript | FAIL — five errors (recursive compression wrapper plus nullable searchParams) |
| Baseline lint | Exit 0 with incomplete TypeScript coverage |
| Baseline build | FAIL — external font fetch blocked by restricted network; validators were bypassed |
| Final `npm ci --ignore-scripts` | PASS — clean locked install, 1306 packages installed |
| `npm run typecheck` | PASS — no TypeScript errors |
| `npm run lint` | PASS — TSX-aware lint, no reported errors/warnings |
| `npm test` | PASS — 59 tests across 4 files |
| `npm run test:rules` | PASS — 11 tests across Firestore rules and actual server transactions in a local demo emulator |
| `npm run build` | PASS — optimized Next.js build with type/lint enforcement |
| `npm run test:e2e` | PASS — 4 Chromium smoke tests |
| `npm audit --omit=dev --json` | PASS — 0 reported production vulnerabilities at recorded run |
| Full `npm audit --json` | FAIL/open — 11 development-tool advisories (4 moderate, 7 high), no critical |
| SQL migration/backup restoration | BLOCKED — no SQL environment/backup credentials; no schema mutation applied |
| Provider clinical benchmarks / real rPPG / physical GATT | BLOCKED — no validated dataset, approved provider/device environment |
| Real SATUSEHAT OAuth/submission/rejection | BLOCKED — submission disabled, official credentials and validated program profile unavailable |
| Hosted CI | Added; status must be checked on the created PR; local results do not imply hosted success |

A later test run was interrupted by concurrent dependency reinstallation; after clean install completed, all validator/unit/emulator/build/browser checks were rerun. First-run test harness failures (dependency peer selection, missing emulator test alias and synthetic token typing) were corrected before reporting final passes. Emulator issued an ADC metadata lookup warning in the local environment but both rules and synthetic transaction suites passed; this is not evidence of production credentials working.

## Changed paths / root cause / tested behavior

| Paths | Root cause and repair | Actual verification |
|---|---|---|
| `src/server/security.ts`, `src/lib/firebase-admin.ts` | No verified identity; add revocation-checked token gate, custom claims, size/content/depth validation, safe errors | Missing/invalid token tests; revocation argument assertion; owner/role/input tests PASS |
| `src/server/store.ts`, `src/server/resources.ts`, records/appointments API routes | Untrusted UID/role and ownership-blind upsert; authoritative Firestore transactions, assigned scope, bounded lists, version feedback, idempotent create and audit | Mock API authorization tests and actual emulator create/read/version conflict/idempotent retry/delete/appointment tests PASS |
| activity/auth-sync/stats API routes | Actor spoofing/profile role trust/admin data exposure | Spoofed role rejected, admin-only endpoints denied, anonymous paths denied PASS |
| `firestore.rules` | Self-promotion, broad profile/doctor access and unprotected mutation | 8 actual rules tests: promotion/ownership/assignment/audit/client clinical mutation denial PASS |
| `app/lib/apiClient.ts`, `app/lib/db.ts`, `components/AuthProvider.tsx` | Silent dual writes, unscoped browser medical cache and session leak | HTTP storage failure visibility, bearer attachment, changed-session rejection, explicit legacy purge and no automatic cache read PASS |
| `app/api/preferences/route.ts`, `app/settings/page.tsx`, language provider | Fake save/diagnostics/secrets | Account preference POST/GET and cross-account isolation on emulator PASS; secrets rejected; browser status/save-disabled checks PASS |
| SATUSEHAT API, `src/server/fhir.ts`, SatuSehat modal | Local bundle advertised as accepted remote transaction | NOT_CONFIGURED response has no remote ID; preview remains preliminary/DRAFT; NIK/simulated/diagnosis fields rejected PASS |
| clinical AI API routes and Agnes adapter | Unvalidated clinical output, uncontrolled provider cost/input instruction | Authenticated clinical calls fail closed with 503; no network/provider benchmark claimed |
| adult/child/anthropometry/consultation pages, `src/server/analysis-state.ts` | Empty results -> healthy; synthetic confidence/biometrics; feedback uses model ID; mirrored boxes | Presentation-state, coordinate-bound/mirror, saved-ID feedback client tests PASS; review-gate browser tests PASS; actual clinical/image localization validation BLOCKED |
| rPPG, posture and IoT components / IoT API | Simulated/live-measurement confusion, unverified device data | Fail-closed route tests PASS; UI apply-data path removed; actual device integration BLOCKED |
| `app/actions/get-clinics.ts`, clinics page, ClinicMap | Fake clinic fallback/metadata, unescaped external text | Empty/provider failure stays empty; real fixture preserves unknown metadata/source; browser no fictional clinic PASS |
| `app/lib/imageUtils.ts`, anthropometry compressor wrapper | Recursive name shadowing; raw data URL bypass/corrupt input; resource cleanup | File/blob/data URL decode/compression/error tests PASS; unsupported MIME/oversize/corrupt URL denied; TypeScript PASS. Image unit tests use simulated browser imaging primitives, not a physical mobile device. |
| dashboard | Appointment error propagated without usable UI; unreviewed results looked authoritative | Emulator appointment reload/isolation PASS; draft/source banner; full signed-in browser workflow remains staging gate |
| layout/global error | Global error suppression/fetch rewrite; invalid lint navigation | Build/lint PASS; concealment script removed |
| legacy SQL schema access/config/repository | Broad doctor access, ownership-blind update, raw DB logging and insecure migration connection | Runtime routes no longer use SQL; code changes typecheck/build PASS; actual SQL integration/migration BLOCKED |
| Next/ESLint/package/CI configs, test configs and tests | Build bypasses, no regression suite, vulnerable dependencies | Clean install/validators/build/tests and production audit as above; remaining dev advisories explicitly open |

## Limits of the passes

API route tests mock Firebase verification; the emulator executes real Firestore transactions but token identities are synthetic mocks. The browser tests verify unsigned safety behavior; no real Google login or privileged authenticated browser session was exercised. The PDF dependency test verifies a PDF signature/text document, not every visual clinical report layout. JSON/PDF export of actual patient records, offline encrypted reconciliation, secure image retention, SQL-only record restore, clinician signoff and real external submission remain blocked or staging work.

The implemented safety gates satisfy safe rejection and truthful status behavior. They do not establish a validated clinical prediction system or a fully commissioned national-health integration.

## Complete changed-file inventory

- `.env.example`
- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `app/actions/get-clinics.ts`
- `app/antropometri/page.tsx`
- `app/api/activity/route.ts`
- `app/api/appointments/route.ts`
- `app/api/auth/sync/route.ts`
- `app/api/gemini/analyze/route.ts`
- `app/api/gemini/consultation/route.ts`
- `app/api/iot/ingest/route.ts`
- `app/api/preferences/route.ts`
- `app/api/records/route.ts`
- `app/api/satusehat/sync/route.ts`
- `app/api/stats/route.ts`
- `app/checkup-anak/page.tsx`
- `app/checkup/page.tsx`
- `app/clinics/page.tsx`
- `app/consultation/page.tsx`
- `app/dashboard/page.tsx`
- `app/global-error.tsx`
- `app/layout.tsx`
- `app/lib/agnesAi.ts`
- `app/lib/apiClient.ts`
- `app/lib/db.ts`
- `app/lib/imageUtils.ts`
- `app/settings/page.tsx`
- `components/AuthProvider.tsx`
- `components/ClinicMap.tsx`
- `components/FaceRppgPulseVisualizer.tsx`
- `components/IoTDeviceHubModal.tsx`
- `components/LanguageProvider.tsx`
- `components/PosturalSpineHeatmapOverlay.tsx`
- `components/SatuSehatModal.tsx`
- `docs/repair/AI_CLINICAL_VALIDATION.md`
- `docs/repair/AUDIT_BASELINE.md`
- `docs/repair/CHANGELOG.md`
- `docs/repair/DEPLOYMENT_CHECKLIST.md`
- `docs/repair/EXECUTIVE_SUMMARY.md`
- `docs/repair/QA_TEST_REPORT.md`
- `docs/repair/SATUSEHAT_INTEGRATION_STATUS.md`
- `docs/repair/SECURITY_FIXES.md`
- `eslint.config.mjs`
- `firebase.test.json`
- `firestore.rules`
- `next-env.d.ts`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `src/db/drizzle.config.ts`
- `src/db/index.ts`
- `src/db/repository.ts`
- `src/lib/firebase-admin.ts`
- `src/server/analysis-state.ts`
- `src/server/fhir.ts`
- `src/server/resources.ts`
- `src/server/security.ts`
- `src/server/store.ts`
- `tests/api.test.ts`
- `tests/clients.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/firestore.rules.test.ts`
- `tests/images.test.ts`
- `tests/resources.emulator.test.ts`
- `tests/security.test.ts`
- `tests/server-only.ts`
- `vitest.config.mts`
- `vitest.rules.config.mts`
