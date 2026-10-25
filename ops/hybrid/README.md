# Connected hybrid research staging

Implementation continues Draft PR #7 from `82aa781`, stacked on PR #6 `c6ca0ea`, preserving production Firebase, web services, inference gates and the protected Vercel Preview. The owner subsequently approved creation of the empty research project **`sonri-hybrid-research-20261025`**, Jakarta **`asia-southeast2`**, **Spark with no billing link**, and a private App Distribution group containing only the approved owner. That project is now configured and has real synthetic hosted execution evidence. See [dated hosted results and remaining failures](HOSTED-STATUS.md); [STATUS.md](STATUS.md) preserves the earlier local-only baseline. No paid plan, Cloud Run, Pages deployment or clinical production deployment was created.

## Build targets and account setup

`apps/android` is one native app/codebase. `assembleConnected` builds the connected research APK; primary inference stays ONNX CPU regardless of network. It adds INTERNET/ACCESS_NETWORK_STATE, Firebase Auth/Firestore and Google Credential Manager. `assembleDebug` preserves a no-INTERNET artifact for offline regression. Current source is version **0.2.1-hybrid-research, code 3**; the initial hosted evidence below used version 0.2.0 / code 2. Both variants use the same package/signing identity within a build host. Choose one artifact; different debug certificates require owner-managed data export/reinstall, never an automatic wipe.

Default connected/CI builds have **no Firebase configuration, no update trust key and no endpoints**. They remain usable in local guest mode and explain that accounts are not configured. The private hosted build instead contains only the approved project's public client configuration; its update authority remains blank. Account controls support email registration/login, verification/reload, Google Credential Manager, password recovery, sign-out, profile name/participation and explicit deletion requests. Google provider configuration is verified, but Google Credential Manager UI has not been exercised on a Google Play-enabled device. Login is not verified professional identity. Firebase SDK handles tokens in private app storage; backups are disabled, no token is logged or embedded in an APK. Offline cached login cannot detect remote revocation until connectivity returns; the device lock and local research-only scope remain required.

The approval is recorded in [owner-approval.v1.json](owner-approval.v1.json). Read-only operator preflight verified disabled billing/no account link, the default Standard Firestore database in `asia-southeast2`, registered package/signing fingerprints, enabled email/password and Google providers, and the exact dedicated active rule source. The naming/approval gate refuses earlier production project IDs. Use scoped operator access/ADC, never a service-account JSON in Android or chat. Creation approval does not authorize billing, patient data, a second project or production changes.

Place nonsecret public client config in ignored local Gradle properties or a private build configuration:

```sh
cd apps/android
./gradlew :app:assembleConnected \
 -PsonriProject=sonri-hybrid-OWNER_ID \
 -PsonriProjectApproval=NONSECRET_OWNER_EMPTY_SPARK_ATTESTATION \
 -PsonriAppId=OWNER_ANDROID_APP_ID \
 -PsonriApiKey=PUBLIC_RESTRICTED_FIREBASE_CLIENT_KEY \
 -PsonriGoogleClientId=OWNER_WEB_OAUTH_CLIENT_ID
```

Firebase client keys identify a project and are not privileged server keys; restrict them in the provider console. No privileged token, service-account key or signing password belongs in assets. Runtime live billing/empty-project verification cannot be performed from an unprivileged APK; an owner attestation is an operational gate, not provider proof.

For the approved project, the helpers reproduce read-only provider checks and a configured build without creating resources. Keep client configuration in an ignored operator file and execution output outside Git:

```sh
node ops/hybrid/hosted-preflight.cjs \
 --project=sonri-hybrid-research-20261025 --output=/private/results/preflight.json
python3 ops/hybrid/build-hosted.py \
 --client-config=/private/operator/google-services.json --output=/private/results/hosted-apk
```

Preflight refuses a different project before provider calls. The build helper rejects administrator credential fields, checks the approved project/package, runs the connected build/unit/lint tasks and records APK checksums. Neither command deploys rules, sends emails or distributes an APK. Use the [explicit hosted test runner](../../apps/android/docs/hosted-testing.md) for those acceptance stages that require private synthetic credentials and owner mailbox actions.

Only the existing reviewed [dedicated rules](firestore.rules) were deployed to this approved research project, and the active provider source was compared byte-for-byte with them. For an authorized repeat deployment, use `firebase deploy --only firestore:rules --project sonri-hybrid-research-20261025 --config ops/hybrid/firebase.staging.template.json` and recheck the exact target/source first. Do not target an unrelated existing project. Android disables Firestore disk persistence (memory cache only); the encrypted vault and encrypted outbox remain authoritative locally. [Hosted testing](../../apps/android/docs/hosted-testing.md) describes private input handling and staged mailbox actions.

## Encryption, sync and recovery

Only `dataKind=SYNTHETIC` records with local consent can be admitted. Authorized nonpatient research and real patient records remain device-local. Migrating a guest requires an explicit preview/confirmation for up to 20 records; new account registration does not upload guest data. No images enter cloud records or training.

A random 256-bit recovery code is generated locally, never derived from an account password. User must save it privately and import it on Device B. AES-256-GCM authenticates owner UID, record ID and cloud revision. Keystore-protected local state holds recovery codes/outbox; Firebase stores ciphertext plus bounded operational metadata. The server has no recovery key. Losing all keys/devices loses decryption access. This design and implementation are **not independently security-reviewed for patient data**, so that scope stays prohibited. Sharing a whole account recovery key would reveal all its eligible records: do not do so. Per-record key envelopes/professional sharing recovery are not implemented; clinical sharing UI is disabled even though rules test trusted grants.

Every cloud mutation is a transaction with expected head revision, immutable matching `revisions/N` and an operation UUID. Retrying the identical operation is idempotent. No last-write-wins merge is used. Reviewed heads cannot be changed by clients; conflicting edits remain in the encrypted queue and require human reconciliation/export, not overwriting. Local review is self-attested research review, not a professionally verified diagnosis. Tombstones are explicit revisioned deletions for eligible unreviewed records; immutable cloud history remains until operator purge. Local retention/deletion/reset does not promise cloud purge.

History is paginated 20 heads per request. Foreground connectivity restoration attempts an eligible queued sync after explicit account migration; manual sync is also available. No periodic background service is created. Errors/timeouts retain the queue and impose a one-minute retry delay; local AI/records continue. Quotas/credential failures are not treated as success. SDK transactions may retry internally; this is not a global billing cap. Reviewed revisions, missing keys or active drafts may require intervention rather than an automatic restore. Local changes while cloud operations run are guarded.

The original local-service reproduction and the later **real hosted Firebase** test both restore synthetic ciphertext through separately authenticated named Firebase clients in one Android emulator. Actual hosted server reads and exact decrypted-record comparison passed. These are independent auth sessions, **not two phones, isolated app storage or complete product UI acceptance**. A real reset email was delivered, but the most recent recovery-confirm login returned `ERROR_INVALID_CREDENTIAL`; successful password-reset recovery must not be inferred from the earlier local-emulator test. Original local record vault format/key is preserved in a separate file from sync metadata. An account sign-out hides account-bound records while preserving encrypted local data; guest records remain clearly distinct. Offline revocation cannot instantly invalidate a disconnected device's already authorized local access.

## Privileged roles, deletion and feedback

Profiles cannot set roles, verification or grants. Only a scoped operator may set `clinicianVerified` after independent credential review; rules also require an active reviewer account and an operator-created per-record grant. Reviewer key delivery, verified-professional UI and clinical data sharing remain gated. A local title/Google login never creates this claim.

`operator.mjs` defaults to **dry-run with zero provider calls**. Applying a role, disabling an account or purging an account requires exact project/UID, nonsecret approval reference, scoped ADC and `--apply`. Clinician assignment additionally needs an independently reviewed credential reference. Revocation first disables the Firestore account (immediate rule denial), then disables/revokes Auth; already issued tokens alone may remain valid until expiry. Purge requires the user's recorded deletion request and `--confirm-permanent-deletion`; it disables access, recursively deletes owned revisions/grants, removes Auth and the request. Operator must verify provider state/retries and retention obligations. This tool was not applied to any provider account.

The app honestly records `PENDING_OPERATOR_PURGE`; it does not claim immediate account deletion. Export locally before requesting purge and restore every cloud page before a complete multi-device export. External PDF/JSON and other-device copies remain separately controlled. Production deletion/retention compliance and independent audit hardening are unresolved.

Participation is a profile preference, not blanket consent to collect images or train. Feedback/data submission remains **disabled** until an approved protocol establishes rights, independent annotation, de-identification, access/retention/withdrawal and review. No training is initiated by login/sync.

## Signed updates and release lifecycle

The connected app accepts strict base64-envelope metadata signed with SHA256/ECDSA and an operator-pinned X509 public key. HTTPS is required; redirects are refused; payload/download sizes, sequence, expiry, compatibility and a monotonic minimum-safe version are checked. APK notices compare package, increasing versionCode and installed certificate hash; no APK is installed silently. Active exams are never interrupted by a forced update.

Current downloadable contract is **SOFTWARE_KERNEL_TEST only**. Real dental weights remain local exact-hash import because redistribution/class contracts are unresolved. Signed download → SHA check → actual ORT kernel compatibility run → atomic model file → authenticated pointer change; failure preserves the prior active version. Previous compatible versions can be selected unless revoked by the signed safety floor. Offline execution uses the installed model; it cannot learn a new remote revocation while disconnected. Model versions are independent of APK versions for this tested compatible contract. Dental-family activation requires its own verified contract/rights and review before expansion.

The HTTPS test server generates **ephemeral test keys outside Git** and a public test CA only in test assets. Test trust is installed in the instrumented process and restored afterward; no global TLS bypass or production trust key is shipped. Never deploy test trust metadata to a public production update channel. Owner signing public key/origin are blank in the deliverable; no owner release-signing authority was invented.

Before any dental model release: authorized data/annotation → patient split/quality audit → justified authorized training → independent per-class/FN evaluation → clinical/domain review → artifact-license approval → signed release → compatibility test → monitoring/rollback. No stage is inferred from a successful download. No automatic training/paid job exists.

## Pages, tester distribution and limits

`pages/` contains public nonsecret onboarding/privacy and a manual quota dashboard. It can be uploaded to an owner-approved **existing Free Pages project** after approval; no Functions/Workers/R2/billing is required. There is no live signed `manifest.json` until an owner creates an approved signed release. Do not publish private weights, patient records, test keys or Firebase credentials with the static bundle.

Owner release signing remains outside Git. The connected APK is debuggable research software; the existing `assembleRelease` target is the offline variant. A hardened connected release configuration, owner signing authority and final release acceptance remain gated before distribution beyond explicitly approved research testing. The owner approved the debug research APK for the private **`sonri-owner-research`** group with one owner tester. App Distribution upload/distribution succeeded; the downloaded binary matched the actually tested APK. No public invitation link was created and no dental weights were uploaded. [Hosted status](HOSTED-STATUS.md) links the dated tested release; a later UI-fixed APK needs its own checksums, acceptance and release record. App Distribution is not a silent Play Store update and does not demonstrate successful installation or analysis on the owner's phone.

Current provider documents checked 2026-10-25:
- [Firestore](https://firebase.google.com/docs/firestore/quotas): one free database, 1 GiB stored, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 10 GiB outbound/month. Daily counters reset around midnight Pacific, not Jakarta. TTL/backup/restore features require billing and are excluded.
- [Auth limits](https://firebase.google.com/docs/auth/limits): Spark verification emails 1,000/day; reset emails 150/day; signups 100/hour/IP; Identity Platform Spark Tier1 3,000 DAU if that upgrade is enabled. Provider abuse controls can change. Real verification/reset email delivery and refreshed verified tokens were observed in the hosted test; Google consent UI and completed password-reset recovery remain unverified. No SMS, email-link login or billing upgrade is used.
- [App Distribution](https://firebase.google.com/docs/app-distribution/troubleshooting): 500 testers/project, 200/group, 150-day release retention. This invited tester path is not a 10,000-user deployment mechanism.
- [Pages](https://developers.cloudflare.com/pages/platform/limits/): Free 500 builds/month, 20,000 files, 25 MiB per asset. The 121 MB RF checkpoint and ~100 MB APK do not fit as individual assets; use approved App Distribution for APK and separately authorize any future weight delivery. No paid storage workaround is activated.
- [Spark billing boundaries](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans): do not link billing, activate Blaze or depend on trial credits. [SDK release mapping](https://firebase.google.com/support/release-notes/android) is pinned to BOM34.4.0 after BOM35.1.0 required Kotlin2.4; Kotlin/AGP baseline was preserved.

`python3 ops/hybrid/quota.py` reproduces explicit 100/1,000/10,000-account scenarios. At 20% DAU, the 10,000-account scenario exceeds reads, stored data and egress free quotas. Smaller scenarios are arithmetic estimates, not a guarantee or actual telemetry. The three-revision assumption is a finite snapshot: append-only history accumulates until an authorized operator purge, so long-term storage can exceed it. The new project's usage charts showed **No Data** when inspected; that is unavailable telemetry, not zero usage. Dashboard inputs must come from provider Console usage; no project-wide real-time monitor exists. The hosted test injected `RESOURCE_EXHAUSTED` and verified encrypted queue retention/reload followed by real-server retry; it did not exhaust real Spark quotas. Check 80% thresholds, restrict enrollment, defer sync and preserve local operation; never auto-upgrade. No billable infrastructure was provisioned.
