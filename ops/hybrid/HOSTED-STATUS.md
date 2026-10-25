# Real Firebase research staging — dated execution status

This records actual observations on **2026-10-25 UTC**, continuing Draft PR #7 from `82aa781`. It supersedes the cloud-availability statements in the [historical local acceptance](STATUS.md). Tests use only synthetic identities/records. Clinical use and patient synchronization remain prohibited.

## Approved project and active configuration

| Item | Observed state |
| --- | --- |
| Owner approval | [owner-approval.v1.json](owner-approval.v1.json), reference `owner-chat-20261025-free-hosted` |
| Project | `sonri-hybrid-research-20261025` / project number `982393765999` |
| Cost boundary | Console Spark; Cloud Billing API `billingEnabled:false`, no linked billing account; no Blaze upgrade |
| Firestore | One `(default)` Native / Standard database, `asia-southeast2`; PITR and scheduled backups disabled |
| Android registration | `id.sonri.offline.research`; app `1:982393765999:android:644954c4737cd2dacf8d9a` |
| Registered local debug certificate | SHA-1 `0e9883b482fd644f777a5afb9476918b33e460f6`; SHA-256 `c73b3560bbf5611407b4f1882d03ff744c4694a4bcef2bc129d449fab52eb5ca` |
| Auth | Email/password and Google providers enabled; matching Android and web OAuth client configuration present |
| Dedicated rules | Actual active source equals [firestore.rules](firestore.rules), SHA-256 `d2ae513cd6c0b7a8c75ba4863452cf049e3f74914d1f320add829932a241b98f` |

Read-only administrative preflight was recorded at **15:42:10.115Z**. It checks provider state rather than trusting an APK attestation. No administrator credentials enter Android. The real hosted build uses public client configuration only; ordinary public CI builds keep the project blank. The signed update origin/public key remain unconfigured. Production Firebase and the protected Vercel research Preview were not changed.

## Observed execution

| Check | Actual result and limit |
| --- | --- |
| Registration / email verification | Synthetic A and B created; real verification emails delivered; owner performed mailbox actions; refreshed SDK user and token verified |
| Unverified / other-user access | Actual deployed rules returned `PERMISSION_DENIED`, including a verified distinct UID attempting to read the first account's profile/ciphertext |
| Profile / encrypted write | Server profile read/write and AES-GCM synthetic record plus immutable revision passed; identical operation retry was idempotent |
| Independent authenticated restore | Freshly authenticated named client B restored and decrypted the exact record through actual server-source reads |
| Conflict / reviewed data | Stale revision rejected without changing the head; reviewed revision also denied by a direct deployed-rule write attempt |
| Offline queue / restart | Existing encrypted outbox survived SDK networking disablement and controller reload, then synchronized/restored against the real server |
| Quota failure retention | Controlled `RESOURCE_EXHAUSTED` injection retained/reloaded the actual encrypted outbox; retry used real Firebase. Provider quotas were not exhausted |
| Logout | Both independently authenticated named sessions signed out |
| Password recovery | Real reset email delivered and owner attested completion; latest **15:41:56.841187Z** confirmation **FAIL** at `REAL_EMAIL_LOGIN`, `ERROR_INVALID_CREDENTIAL`. New-password login/restore is not proven |
| Google sign-in | Provider/configuration verified; real Google Credential Manager UI **not tested** on this AOSP emulator |
| Offline AI on the configured APK | General instrumentation: 11 passed / 5 intentional skips; separate real RF-DETR: 2 passed with airplane mode observed |

Hosted core acceptance was rerun on the corrected **0.2.1 / code 3 APK** and passed at **15:42:38.138126Z** using the actual Android Firebase client SDK. The independent clients share **one emulator/app environment**; they are not two physical phones or separate app storage. The hosted test calls existing backend/controller APIs and does not establish complete product-screen acceptance. Read the [staged reproduction procedure](../../apps/android/docs/hosted-testing.md) before rerunning. Owner-managed private inputs and mailbox action links must remain outside Git, PRs and reports.

The offline RF-DETR run used the authorized private exact checkpoint on one API35 ARM64 emulator configured with 4 GiB/two cores: five iterations, CPU inference p50 **891.51 ms**, p95 **999.65 ms**. These are synthetic runtime/equivalence observations, not dental accuracy, physical-phone speed, battery measurements or clinical validation. The private harness removes temporary model imports after testing; successful instrumentation does not imply the ordinary app is left with a model installed.

## Tested binary and private distribution

The corrected **0.2.1-hybrid-research / versionCode 3** APK is **102,517,352 bytes**, SHA-256 **`e096e7b7bb262856b29e39eb8a16324562bc3e867bfa1f863d0ff345c5ab5c48`**. It is debuggable owner-research software: networking enabled, backups disabled, cleartext disabled, no administrator credentials/test TLS trust and **no pretrained dental weights**. All current hosted, offline and distribution reports bind this exact binary and its source hashes in [firebase-hosted.v1.json](../../apps/android/evidence/firebase-hosted.v1.json).

Private upload/distribution succeeded for **`sonri-owner-research`**, sole explicitly approved owner tester, with no public invitation link. [Tested version 3 release `7cdjs1qhuuo28`](https://appdistribution.firebase.google.com/testerapps/1:982393765999:android:644954c4737cd2dacf8d9a/releases/7cdjs1qhuuo28?utm_source=firebase-tools) requires that approved account. The actual downloaded APK SHA-256 matched the tested local APK. Install as an update to preserve local data; never automatically uninstall/wipe a phone to resolve a signing mismatch. This proves distribution integrity, not successful installation or analysis on the phone. No dental checkpoint was uploaded.

Current sanitized operator reports are under `outputs/hybrid/hosted-v3/` in the enclosing workspace. Earlier version 2 reports remain under `outputs/hybrid/hosted/`: APK SHA-256 `ff6cb0bfce1b8bf33f2d404957ef6c579a2e707c90a8e2349cf4747e629edeca`, initial private release `37g0dao1fa06o`. The current evidence preserves the earlier registration/mail stages as dated history and the latest failed password-recovery result. No result is transferred silently to another APK. Raw logs, private input JSON, credentials and temporary signed binary URLs are excluded from committed reports.

## Owner's phone analysis report

The owner reports that pressing **“Jalankan AI lokal sebenarnya”** on an Android phone produces no visible response, and selected “still not responding or another message” after the corrected release was provided. The exact phone status text/model/Android version is pending. No phone logs or model-state evidence have been captured, so the phone's root cause is not yet verified. Inspection of the dedicated emulator found no installed private dental model after test cleanup. Source inspection also identified that a missing-model refusal can appear outside the visible scrolled analysis controls. The **0.2.1-hybrid-research / versionCode 3** repair adds model readiness beside the analysis controls, disables execution when the model is not ready and provides a direct local-import route. The corrected APK passed 12 Kotlin unit tests, connected lint, 11 general Android tests (5 intentional skips), 2 actual private RF-DETR tests, and the real hosted core/other-account-denial rerun. These tests establish the native emulator readiness/import route and actual synthetic inference; physical-phone execution remains unobserved.

For the existing local-import flow, open **Perangkat dan model**, provide an authorized nonsecret local-use reference, acknowledge permission and import the exact compatible ONNX through the file picker. Import before opening an image because leaving for the picker locks the workspace and drops in-memory images; unlock again afterward. Installing an APK, Firebase login and a small software-kernel update do not install the dental checkpoint. A missing model must not be addressed by bypassing the rights, size/hash, research, consent or technical-quality gates.

## Remaining operational boundaries

- Complete password-reset login/restore using owner-controlled mailbox credentials; retain the failed result until a real successful rerun exists. Do not use an administrator verification/reset shortcut as mailbox evidence.
- Obtain exact phone error/device details and physical-phone execution/log evidence and test full product UI, Google Play sign-in and independent device/session restore. The owner's button report remains open until the corrected build is actually exercised.
- Provider usage charts showed **No Data** at inspection. This is unavailable telemetry, not zero quota use. Enrollment remains bounded to the approved owner; [quota calculations](README.md#pages-tester-distribution-and-limits) are estimates. No paid fallback or auto-upgrade is allowed.
- Keep the original exposed-credential incident **OPEN** until nonsecret owner revocation evidence is verified. No old credential was revealed or tested. No independent cryptographic patient-data review, dental checkpoint redistribution permission, authoritative disease mapping, independent clinical benchmark or authorized clinical validation has been established by these infrastructure tests. Raw labels stay **UNVERIFIED**, evaluated/clinically validated AI ICD capability stays **0/108**.
- No new training, paid infrastructure, production deployment or PR merge was performed. Hardened connected release signing, signed dental-model delivery, professional sharing/key delivery and live operator purge remain separate gates.
