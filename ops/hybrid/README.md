# Connected hybrid research staging

Implementation continues PR #6 `c6ca0ea` without modifying production Firebase, web services, inference gates or the protected Vercel Preview. Owner confirmed on **2026-10-25 Asia/Jakarta** that no separate project exists and authorized emulator/configuration work only. No live resource, billing link, paid plan, Cloud Run, App Distribution invitation or Pages deployment is created by these files.

## Build targets and account setup

`apps/android` is one native app/codebase. `assembleConnected` builds the connected research APK; primary inference stays ONNX CPU regardless of network. It adds INTERNET/ACCESS_NETWORK_STATE, Firebase Auth/Firestore and Google Credential Manager. `assembleDebug` preserves a no-INTERNET artifact for offline regression. Both are version 0.2.0, code 2, same package/signing identity within a build host. Choose one artifact; different debug certificates require owner-managed data export/reinstall, never an automatic wipe.

Default connected build has **no Firebase configuration, no update trust key and no endpoints**. It remains usable in local guest mode and explains that accounts are not configured. Account controls support email registration/login, verification/reload, Google Credential Manager, password recovery, sign-out, profile name/participation and explicit deletion requests. Login is not verified professional identity. Firebase SDK handles tokens in private app storage; backups are disabled, no token is logged or embedded in an APK. Offline cached login cannot detect remote revocation until connectivity returns; the device lock and local research-only scope remain required.

Owner must authorize a **new empty Spark** project with ID beginning `sonri-hybrid-`, default database, no billing link, no production records; select its region/privacy policy. Enable email/password and Google, register the package/certificate SHA and web OAuth client, configure email templates/domains and review abuse quotas. Provide scoped operator access/ADC, not a service-account JSON in Android or chat. This name constraint deliberately refuses earlier production project IDs.

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

After owner approval, review/deploy **only** these dedicated rules with `firebase deploy --only firestore:rules --project EXACT_APPROVED_ID --config ops/hybrid/firebase.staging.template.json`. Never run against an existing project. No deploy command is executed automatically. Android disables Firestore disk persistence (memory cache only); the encrypted vault and encrypted outbox remain authoritative locally.

## Encryption, sync and recovery

Only `dataKind=SYNTHETIC` records with local consent can be admitted. Authorized nonpatient research and real patient records remain device-local. Migrating a guest requires an explicit preview/confirmation for up to 20 records; new account registration does not upload guest data. No images enter cloud records or training.

A random 256-bit recovery code is generated locally, never derived from an account password. User must save it privately and import it on Device B. AES-256-GCM authenticates owner UID, record ID and cloud revision. Keystore-protected local state holds recovery codes/outbox; Firebase stores ciphertext plus bounded operational metadata. The server has no recovery key. Losing all keys/devices loses decryption access. This design and implementation are **not independently security-reviewed for patient data**, so that scope stays prohibited. Sharing a whole account recovery key would reveal all its eligible records: do not do so. Per-record key envelopes/professional sharing recovery are not implemented; clinical sharing UI is disabled even though rules test trusted grants.

Every cloud mutation is a transaction with expected head revision, immutable matching `revisions/N` and an operation UUID. Retrying the identical operation is idempotent. No last-write-wins merge is used. Reviewed heads cannot be changed by clients; conflicting edits remain in the encrypted queue and require human reconciliation/export, not overwriting. Local review is self-attested research review, not a professionally verified diagnosis. Tombstones are explicit revisioned deletions for eligible unreviewed records; immutable cloud history remains until operator purge. Local retention/deletion/reset does not promise cloud purge.

History is paginated 20 heads per request. Foreground connectivity restoration attempts an eligible queued sync after explicit account migration; manual sync is also available. No periodic background service is created. Errors/timeouts retain the queue and impose a one-minute retry delay; local AI/records continue. Quotas/credential failures are not treated as success. SDK transactions may retry internally; this is not a global billing cap. Reviewed revisions, missing keys or active drafts may require intervention rather than an automatic restore. Local changes while cloud operations run are guarded.

Cross-device decryption is demonstrated only with synthetic ciphertext and separate Firebase client instances in one Android emulator. It is **not two physical phones or hosted Firebase**. Original local record vault format/key is preserved in a separate file from sync metadata. An account sign-out hides account-bound records while preserving encrypted local data; guest records remain clearly distinct. Offline revocation cannot instantly invalidate a disconnected device's already authorized local access.

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

Owner release signing remains outside Git. The connected APK delivered here is debuggable research software; the existing `assembleRelease` target is the offline variant. A hardened connected release configuration, owner signing authority and final release acceptance remain gated before distribution beyond explicitly approved research testing. App Distribution is a later explicit operator action with the approved Firebase app ID, owner-signed APK and invited tester group; do not send invitations to unspecified people. Example after authorization: `firebase appdistribution:distribute /private/owner-signed.apk --app OWNER_ANDROID_APP_ID --groups APPROVED_RESEARCH_GROUP --release-notes-file /private/reviewed-release-notes.txt`. This is not Play Store silent updating and was not run.

Current provider documents checked 2026-10-25:
- [Firestore](https://firebase.google.com/docs/firestore/quotas): one free database, 1 GiB stored, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 10 GiB outbound/month. Daily counters reset around midnight Pacific, not Jakarta. TTL/backup/restore features require billing and are excluded.
- [Auth limits](https://firebase.google.com/docs/auth/limits): Spark verification emails 1,000/day; reset emails 150/day; signups 100/hour/IP; Identity Platform Spark Tier1 3,000 DAU if that upgrade is enabled. Provider abuse controls can change. Email delivery and Google consent are not proven by local emulators. No SMS, email-link login or billing upgrade is used.
- [App Distribution](https://firebase.google.com/docs/app-distribution/troubleshooting): 500 testers/project, 200/group, 150-day release retention. This invited tester path is not a 10,000-user deployment mechanism.
- [Pages](https://developers.cloudflare.com/pages/platform/limits/): Free 500 builds/month, 20,000 files, 25 MiB per asset. The 121 MB RF checkpoint and ~100 MB APK do not fit as individual assets; use approved App Distribution for APK and separately authorize any future weight delivery. No paid storage workaround is activated.
- [Spark billing boundaries](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans): do not link billing, activate Blaze or depend on trial credits. [SDK release mapping](https://firebase.google.com/support/release-notes/android) is pinned to BOM34.4.0 after BOM35.1.0 required Kotlin2.4; Kotlin/AGP baseline was preserved.

`python3 ops/hybrid/quota.py` reproduces explicit 100/1,000/10,000-account scenarios. At 20% DAU, the 10,000-account scenario exceeds reads, stored data and egress free quotas. Smaller scenarios are arithmetic estimates, not a guarantee or actual telemetry. The three-revision assumption is a finite snapshot: append-only history accumulates until an authorized operator purge, so long-term storage can exceed it. Dashboard inputs must come from provider Console usage; no project-wide real-time monitor exists without owner access. Check 80% thresholds, restrict enrollment, defer sync and preserve local operation; never auto-upgrade. No billable infrastructure was provisioned.
