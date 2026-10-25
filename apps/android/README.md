# SONRI Android connected hybrid research

Native Kotlin / Jetpack Compose application, Android 10+ (API 29), ARM64 and emulator x86_64. The connected-first product uses optional configured Firebase accounts/synthetic synchronization while primary AI remains local. Build `:app:assembleConnected` for this product. The preserved `:app:assembleDebug` offline regression artifact has no INTERNET permission or Firebase dependency. Both share the same native screens, inference and encrypted vault. No remote inference API or recurring inference-server resource is required.

See [current hosted research status](../../ops/hybrid/HOSTED-STATUS.md), [connected hybrid setup, privacy and quotas](../../ops/hybrid/README.md), [hosted acceptance](docs/hosted-testing.md) and [local-service tests](../../ops/hybrid/TESTING.md). The owner-approved `sonri-hybrid-research-20261025` project now runs on Spark with no billing link. A separately configured private connected APK has passed real Firebase SDK encrypted write/restore tests using independent authenticated sessions on one emulator. Default public CI builds still contain no Firebase configuration or update authority. Real Google sign-in UI, password-reset completion and physical-phone acceptance remain unverified; see the dated hosted status for the exact evidence scope.

**Research only: synthetic or authorized nonpatient data. Clinical use PROHIBITED.** Every RF-DETR slot is UNVERIFIED. No AI finding is assigned a disease, ICD code, FDI number, probability of disease or healthy status. A local reviewer records a manual decision; device credentials and self-attestation do not verify professional identity.

The APK includes 108 terminal codes and 15 categories from the existing WHO ICD-10 2010 catalog, manual clinical forms, permanent/primary/mixed FDI odontograms, evidence checklists, local review, encrypted history and explicit JSON/PDF export. Authored clinical checklists/differentials retain the existing limitations; they are not clinician-validated rules. AI capability remains 0/108 evaluated or clinically validated ICD diagnoses.

## Build and install

Prerequisites: JDK 21 (17 minimum for AGP), Android SDK platform 36 and Build Tools 35.0.0, accepted Android SDK licenses. Set `ANDROID_HOME` to your SDK, or create ignored `local.properties` with `sdk.dir=/absolute/sdk/path`. Initial dependency downloads require connectivity on the build host; the installed core app does not.

```sh
# Repository root, only when refreshing the bundled terminology from existing source:
npm ci --ignore-scripts
node --import tsx apps/android/scripts/export-terminology.ts --check

cd apps/android
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest
adb -s YOUR_SERIAL install -r app/build/outputs/apk/debug/app-debug.apk
```

The checked-in Gradle 8.13 wrapper verifies its distribution SHA-256. AGP 8.13.2, Kotlin 2.2.21 and ORT Android 1.24.3 are pinned. Android Studio can open this directory directly. The debug application ID is `id.sonri.offline.research`. APK and instrumentation APK are separate; install only `app-debug.apk` for ordinary research use. Debug builds are debuggable and inappropriate for patient records. New CI jobs can have different debug signing certificates; Android may require uninstalling the previous debug build, which destroys its local records and model. Export wanted synthetic records first. Never uninstall a device's data automatically.

`Android offline research APK` GitHub Actions builds the APK, runs Kotlin/lint/static checks and actual AOSP emulator software acceptance, and uploads `sonri-android-research-debug` with checksum and reports for 14 days. Public CI deliberately has no dental weights and skips private pretrained tests. Download through the authenticated GitHub Actions artifact page; no model/signing key is in that artifact.

## First offline session

1. Set a secure Android screen lock. Open SONRI, accept research limits and authorize with the system credential prompt. Catalog browsing is available while the workspace is locked.
2. Open **Perangkat dan model**. Read the license limitation, enter a nonsecret permission-reference and explicitly acknowledge local research rights. Choose the already authorized local ONNX file. The importer checks size and full SHA-256 before atomic replacement. Do not infer permission from the filename or a generic library license.
3. Start a research examination, select synthetic or authorized nonpatient data and document local consent/permission. Open the bundled geometric synthetic fixture or an authorized local image/camera capture.
4. Inspect technical quality, acknowledge limitations and run actual CPU inference. Boxes show RAW_CLASS_0..4 / UNVERIFIED. No detection is not proof of health. Results and timings are actual model outputs.
5. Enter examinations/FDI observations separately. Select an ICD candidate manually and inspect missing evidence. Local review requires documented evidence, orientation and the required examination checklist. It does not establish clinical validation or permission to treat patients.
6. Save locally. Report export requires explicit confirmation and a system file destination. Exported JSON/PDF is unencrypted outside the vault and contains no source image. Use a local destination; operating-system file providers are outside SONRI's networking controls.

The model is **not bundled**, including in the private Firebase-connected APK, because artifact-specific Android redistribution rights are unresolved. Installing or signing into SONRI does not install a dental model. An authorized local file, permission reference and import are required before AI can run; inspect **Perangkat dan model** first. The fixed-hash importer verifies the actual file, and cloud sign-in does not replace this gate. No cloud download occurs during inference. See [model compatibility and licensing](docs/model-compatibility.md) and the bundled [manifest](app/src/main/assets/model-manifest.v1.json). The owner's report that the analysis button has no visible effect on a phone is tracked in the hosted status; emulator inference evidence does not establish that phone's model state or execution.

## Storage and limitations

Records use AES-256-GCM with randomized IV, authenticated format and an Android Keystore key in `noBackupFilesDir`. Backup/device transfer is excluded. The key requires an OS-unlocked device; the app's system credential prompt is a separate UI gate. It is not a per-use cryptographic authentication binding or verified professional identity. Workspace state and in-memory images are dropped on `onStop`, including when leaving for a system picker; successful file selection can require device authentication again. Rooted/debuggable devices, compromised OS, device credential sharing and RAM forensics are outside the prototype's protection.

Raw image pixels exist only in memory; no image cache, gallery save, telemetry or image attachment to reports is implemented. CameraX capture is in-memory. Android Photo Picker can expose OS cloud-media providers; `EXTRA_LOCAL_ONLY` is requested, but use local files and airplane mode for offline acceptance. The offline debug variant has no INTERNET permission; the connected variant has INTERNET/ACCESS_NETWORK_STATE for optional accounts, consented synthetic ciphertext synchronization and configured signed updates. Primary inference still runs locally. Technical quality metrics are not a validated clinical adequacy assessment.

Retain 7/30/90 days (default 30), pruning on workspace unlock; max 100 records / 8 MB serialized vault. Deletion removes local records. Reset removes local records, Keystore key and imported model; exported external files remain under the user's control. No automatic backup means lost device, app uninstall, key invalidation or corruption can permanently lose records. Tampered ciphertext fails closed and is not silently overwritten. Audit is device-local, capped at 200 events per record; it is not an independent tamper-proof registry.

See [architecture](docs/architecture.md), [executed benchmark evidence](docs/benchmark.md), and [reproduction commands](docs/testing.md). No physical-phone execution or logs have been independently captured; the owner reports a phone analysis failure. Emulator success does not establish phone compatibility, 4/6/8 GB support, thermal/battery behavior or the provisional 15-second phone target.

## Release process (owner signing only)

```sh
cd apps/android
./gradlew :app:assembleRelease
# Result: app/build/outputs/apk/release/app-release-unsigned.apk
# Obtain authorized release keystore outside Git and use Android SDK apksigner:
zipalign -P 16 -f -v 4 app/build/outputs/apk/release/app-release-unsigned.apk /private/output/sonri-aligned.apk
apksigner sign --ks /private/keys/owner-release.jks --out /private/output/sonri-research.apk /private/output/sonri-aligned.apk
apksigner verify --verbose --print-certs /private/output/sonri-research.apk
shasum -a 256 /private/output/sonri-research.apk
```

Let `apksigner` prompt securely for credentials. Do not put passwords in commands, chat, Git or CI logs. No owner release key has been provided or generated, so this delivery makes no release-signed or Play Store claim. Re-run native/model acceptance against the final owner-signed build on approved hardware before distribution. Signing alone does not resolve licensing or clinical authorization. Never include private weights or keys in Git history.
