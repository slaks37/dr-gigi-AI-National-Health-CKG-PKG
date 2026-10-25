# Hybrid acceptance reproduction and evidence boundaries

All examples use dedicated local emulators and geometric synthetic fixtures. They do not create provider resources. An approved hosted Spark project, Pages origin, owner release key, tester group and physical hardware have not been supplied. Public model redistribution, real-patient sync, professional clinical diagnosis and training remain prohibited.

## 1. Software/unit/rules checks

```sh
npm ci --ignore-scripts
node --import tsx apps/android/scripts/export-terminology.ts --check
JAVA_HOME=/path/to/jdk21 npx firebase emulators:exec \
 --project demo-sonri-hybrid --config ops/hybrid/firebase.emulator.json --only firestore \
 'npx vitest run --config ops/hybrid/vitest.config.mts'
cd apps/android
./gradlew :app:testDebugUnitTest :app:lintDebug :app:lintConnected \
 :app:assembleDebug :app:assembleDebugAndroidTest :app:assembleConnected
```

Eight rules tests execute actual Firestore rule evaluation: anonymous/unverified/cross-account denial, role/owner escalation, atomic paired revisions, immutable history, stale revisions, reviewed-head protection, operator account revocation, trusted clinician/grant/revocation and pending deletion. These rules protect a **separate** collection schema/project, not the existing web project's rules. No production rules are overwritten.

Kotlin checks add AES-GCM owner/revision/key binding, synthetic-only admission, signed metadata trust/tamper/expiry/sequence/security floor/contract rejection and app downgrade/package/signature checks to the previous ten tests. Instrumentation adds real Keystore-backed outbox persistence, explicit migration, account isolation and lock state with a **mock backend identity**. That queue test is not Firebase-hosted evidence.

## 2. Offline RF-DETR regression

Start an isolated AOSP API35 emulator with the synthetic PIN used by the existing harness, and run the preserved [device harness](../../apps/android/docs/testing.md). `--setup-emulator` checks qemu, sets/uses the known synthetic PIN, wakes/dismisses that test keyguard if shown, and keeps the emulator awake. This never changes a physical phone. The no-INTERNET APK keeps real RF-DETR equivalence separate from connected identity/sync and generic arithmetic tests. Private weights stay outside Git/CI and require prior local research permission.

```sh
python3 apps/android/scripts/device_test.py \
 --serial emulator-5554 --setup-emulator \
 --apk apps/android/app/build/outputs/apk/debug/app-debug.apk \
 --test-apk apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk \
 --output /private/results/offline \
 --pretrained /private/authorized/rfdetr.onnx \
 --permission-reference NONSECRET_OWNER_LOCAL_RESEARCH_PERMISSION --iterations 5
```

Do not generate/update source fixtures while the drift-checked harness runs. Public CI deliberately skips the two private-weight tests. Android UI/credential-locked storage require the dedicated emulator to be unlocked; passing numeric ORT tests alone does not establish UI behavior.

## 3. Actual local-service Android integration

Generate ephemeral test keys **outside the repository** and copy only a test public key/certificate into ignored test assets. The generator uses the existing 173-byte synthetic arithmetic ONNX graph; it is not a dental model and never replaces RF-DETR.

```sh
python3 ops/hybrid/synthetic_updates.py prepare \
 --out /private/tmp/sonri-hybrid-fixture \
 --assets apps/android/app/src/connectedAndroidTest/assets/generated
# Terminal A (loopback-only local services):
JAVA_HOME=/path/to/jdk21 npx firebase emulators:start \
 --project demo-sonri-hybrid --config ops/hybrid/firebase.emulator.json --only auth,firestore
# Terminal B:
python3 ops/hybrid/synthetic_updates.py serve --out /private/tmp/sonri-hybrid-fixture
# Build an emulator-only variant; NEVER distribute this APK to testers:
cd apps/android
./gradlew :app:assembleConnected :app:assembleConnectedAndroidTest \
 -PsonriConnectedTests=true -PsonriEmulators=true \
 -PsonriProject=demo-sonri-hybrid -PsonriAppId=1:123:android:synthetic \
 -PsonriApiKey=synthetic-emulator-only-not-a-secret
cd ../..
python3 apps/android/scripts/connected_test.py \
 --serial emulator-5554 \
 --apk apps/android/app/build/outputs/apk/connected/app-connected.apk \
 --test-apk apps/android/app/build/outputs/apk/androidTest/connected/app-connected-androidTest.apk \
 --output /private/results/connected
```

The connected-only tests run two **named Firebase client environments within one Android emulator**, not two phones. They actually register a synthetic email via Firebase Auth SDK, use emulator OOB verification (no real email sent), save a profile, log in a separate client, decrypt the same record with its recovery key, simulate disconnected Firestore, reconnect, perform idempotent writes, reject stale and reviewed revisions/another account, record a pending deletion, request password recovery and sign out. Queued local durability/account migration are separately instrumented with a mock backend. This combination must not be represented as full two-device product UI acceptance.

The HTTPS test uses an ephemeral local certificate trusted only inside the instrumented process. It actually downloads signed metadata and synthetic ONNX bytes, verifies SHA/signature, executes native ORT before activation, activates versions 1/2, rejects corrupt/truncated responses, preserves the active model, rolls back, executes installed ONNX with airplane mode/Wi-Fi/data disabled, reconnects, raises the safety floor and rejects the vulnerable rollback. No Cloudflare origin, dental model release or owner production signing key is involved.

CI `SONRI connected hybrid research` reproduces the local-service test on x86_64 and exports **only the default unconfigured TLS-only connected APK**, copied before the emulator-only build. Test endpoint APKs, ephemeral keys and private weights are not uploaded. Existing `Android offline research APK` independently tests the no-INTERNET path. Check actual runs/artifacts on the Draft PR; workflow YAML alone is not a successful run.

## 4. Hosted and physical acceptance still required

After owner project/region/plan/privacy/credential approvals, verify actual Spark/no billing, deploy only dedicated rules, configure OAuth/certificates, test real email/Google login, and perform the requested workflow on two authorized devices with synthetic data. Exercise full account UI, recovery code transfer, all paginated restores, offline edits/foreground resume, conflict reconciliation, reviewed-record export, sign-out/revocation, operator purge and service recovery. No provider quota should be deliberately exhausted; use a controlled denial fixture for resource-exhausted behavior and verify actual Console budgets separately. Code retains the queue for timeout/service/quota failures; **actual exhausted quotas and expired provider credentials have not been demonstrated** here.

Physical 4/6/8 GB, battery/thermal/memory pressure, real camera/picker, actual system app-unlock prompt, independent cryptographic review, professional verification workflow, scoped per-record encryption-key sharing and patient-data legal/clinical authorization are separate outstanding gates. The existing incident still requires owner nonsecret credential-revocation evidence; this work never reads/tests the exposed credential.
