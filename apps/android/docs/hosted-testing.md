# Explicit hosted Firebase acceptance

This opt-in test uses the existing connected app, real Firebase client SDKs, actual server-source reads, existing AES-GCM contract, and existing encrypted outbox. It does not deploy resources, use an administrator SDK, inspect inboxes, mark an email verified, distribute weights, or claim product-UI/two-phone acceptance. Keep the existing emulator tests unchanged.

Before execution, the operator must independently record the exact approved empty `sonri-hybrid-*` project, Spark plan, absent billing link, default database location, dedicated rule deployment hash, registered Android package/signing fingerprints, and enabled providers. The APK cannot verify these administrative facts. Do not execute against production or synchronize patient data.

Build the connected APK and its instrumentation APK with the **same** approved public configuration, `-PsonriConnectedTests=true`, and `-PsonriEmulators=false`. Supply the existing project approval reference. Do not include administrator credentials, passwords, dental weights, or test TLS trust in either APK.

Create a private JSON file outside Git using a local editor; give it mode `600`. The following is a schema example, not usable credentials:

```json
{
  "runId": "owner-generated-lowercase-uuid",
  "approvedProject": "sonri-hybrid-OWNER_APPROVED_ID",
  "ownerApprovalReference": "EXACT_REFERENCE_COMPILED_IN_APK",
  "authorizeSyntheticAccountOperations": true,
  "email": "OWNER_CONTROLLED_SYNTHETIC_MAILBOX",
  "password": "PRIVATE_RANDOM_PASSWORD_12_TO_128_CHARACTERS"
}
```

The mailbox must receive real mail; `.test` addresses are refused. Do not send its password or action links to chat, command arguments, Git, PRs, or evidence. The runner sends the JSON over adb stdin to `no_backup/hosted-input.json`; the test deletes that input immediately after parsing and stores cross-stage synthetic recovery state using the existing Android Keystore `ProtectedState`. The owner-managed host input is **not** deleted automatically. Preserve that file privately when needed and remove it after the authorized test. The runner never saves raw instrumentation output, only its digest and the redacted test report.

On the dedicated unlocked Android emulator, invoke one stage at a time:

```sh
python3 apps/android/scripts/hosted_test.py \
 --adb /path/to/sdk/platform-tools/adb --serial emulator-5580 \
 --apk /private/results/approved-connected.apk \
 --test-apk apps/android/app/build/outputs/apk/androidTest/connected/app-connected-androidTest.apk \
 --input /private/owner-controlled/hosted-input.json \
 --stage register --output /private/results/hosted
```

Use `--setup-emulator` only for the existing dedicated emulator with its known synthetic PIN. It never operates on a physical phone. Installation uses `-r`, never uninstall/data wiping.

1. **`register`** creates the explicitly authorized synthetic account, requests a real verification email, and requires actual server denial while its token is unverified. Result: `WAITING_FOR_OWNER_EMAIL_VERIFICATION`. This is not completed acceptance. If registration was already persisted but a subsequent assertion failed, rerunning this stage logs into that same UID with the original private password and repeats the unverified denial check; it does not create another account or resend email. Evidence distinguishes initial creation from resumed login. The owner opens the actual mailbox verification link privately; no Admin shortcut is accepted.
2. **`accept`** logs in and refreshes both user and token. If not verified it returns the same waiting status. Once verified, it creates/reads the profile, writes ciphertext and one immutable revision, checks idempotent retry, independently authenticates named client B, restores from the server and compares the exact decrypted synthetic record. It exercises stale conflict, reviewed-head protection, the actual encrypted product outbox under disabled SDK networking, controller reload, reconnect/acknowledgement, and explicit sign-out. Two named auth clients in **one Android app environment** are independent authenticated sessions, not separate phones or isolated app data. Test scope and data remain synthetic. A partial failure must be investigated from its redacted last-step code before retrying; do not relabel it successful.
3. **`other-denial`** requires a separate, already email-verified owner-controlled synthetic account. Add private `otherEmail` and `otherPassword` fields. The test authenticates its distinct UID and requires server `PERMISSION_DENIED` for the first account's profile and ciphertext. These fields may also be supplied during `accept`; otherwise that specific result remains `NOT_TESTED`, even when the other acceptance checks pass. This stage never creates or administrator-verifies the other account.
4. **`recovery-request`** sends a real password-reset email for the accepted account. Result: `WAITING_FOR_OWNER_PASSWORD_RESET`; sending an email is not completed password recovery.
5. The owner follows the real email reset link and sets a **different** private password. Update the host JSON's `password` and add `"passwordResetCompletedByOwner": true`; run **`recovery-confirm`**. It requires that attestation, a password hash different from the original test password, successful refreshed login, and exact server decryption of both the preserved reviewed and queued records. The report distinguishes the owner-attested email action from the programmatically observed new-password login/restore.

Retain each stage's JSON together. Each report binds the exact project, actual APK and test APK SHA-256, source hashes, run ID, stage, observed results, timestamp, and scope. Failure diagnostics expose only exception class names and enumerated Firebase/Auth error codes; SDK messages, raw payloads, tokens and email links are withheld. Waiting, `NOT_TESTED`, and failed results must remain visible. No diagnosis is clinically validated by these tests.

The acceptance stage also injects a controlled `RESOURCE_EXHAUSTED` push response through a backend delegating all other calls to the actual hosted backend. It requires the existing product outbox to retain/reload the encrypted pending record, then retries against the real backend and checks server restoration. This is explicitly an **injected quota failure**, never actual provider-quota exhaustion.

Run the existing private RF-DETR device harness on the **same configured connected APK** with airplane mode enabled for separate offline-AI evidence. This hosted harness does not perform Google Credential Manager UI, App Distribution, provider billing/quota-console review, actual exhausted-provider quota, camera/physical-phone tests, or owner signing. AOSP without Google Play services cannot establish real Google sign-in. Do not exhaust Spark quotas deliberately.

Synthetic hosted accounts and immutable revisions remain until the explicitly approved owner cleanup process. The test deletes neither user accounts nor cloud history automatically.
