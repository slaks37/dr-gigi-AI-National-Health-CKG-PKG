# Reproducing software and private-model acceptance

No patient images or private weights belong in Git, CI uploads or this folder. All committed images and numeric goldens are generated geometric synthetic fixtures. The 173-byte arithmetic ONNX graph in `androidTest/assets/software-arithmetic.onnx.bin` is a software kernel test, not a dental detector. The user APK does not contain test assets.

## Public tests

```sh
# Repository root:
node --import tsx apps/android/scripts/export-terminology.ts --check
cd apps/android
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest
cd ../..
python3 apps/android/scripts/verify_apk.py \
  --apk apps/android/app/build/outputs/apk/debug/app-debug.apk \
  --manifest apps/android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml \
  --output /private/results/apk-static.json
python3 apps/android/scripts/device_test.py \
  --serial emulator-5554 --setup-emulator \
  --apk apps/android/app/build/outputs/apk/debug/app-debug.apk \
  --test-apk apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk \
  --output /private/results/emulator
```

Run an isolated API 35 AOSP ARM64 or x86_64 emulator first. `--setup-emulator` checks qemu, disables Wi-Fi/cellular, sets airplane mode and installs a known **synthetic emulator-only** screen-lock PIN `135790` (or reuses that same synthetic PIN). Do not use an emulator containing private data or another credential. The tool refuses to modify settings on physical devices. It does not uninstall an incompatible-signed existing APK. Dedicated emulator startup can use `-no-snapshot -no-window -no-audio -memory 4096 -cores 2 -camera-back none -camera-front none`; local ARM64 execution used software graphics, two virtual CPUs and no physical camera.

Public instrumentation verifies installed permission/backup flags, actual native arithmetic execution in airplane mode, hash-verified terminology, all 1,486,848 preprocessing floats against desktop reference, real EXIF JPEG rotation, Keystore encryption/tamper/deletion, no image-cache growth, a real PDF stream, checksum rejection and native catalog/FDI/lock-persistence interactions. Two private dental-model tests are explicitly skipped without `pretrained=true`. The emulator UI fixture opens the already OS-unlocked workspace directly through its ViewModel after host credential setup; it **does not verify the real system credential prompt**, biometric behavior, identity, gallery picker interaction, camera hardware or Android 10 vendor Keystore behavior. These remain manual physical-device acceptance items.

## Rebuild actual desktop reference (authorized checkpoint required)

The generator runs the existing `services/inference/sonri_inference/adapters.py` CPU reference and records actual raw tensors; it does not train or export weights. Use an isolated Python 3.11+ environment with the pinned reference requirements:

```sh
python3 -m venv /private/sonri-reference-venv
/private/sonri-reference-venv/bin/pip install -r services/inference/requirements-onnx.txt onnx==1.19.1
/private/sonri-reference-venv/bin/python apps/android/scripts/reference.py \
  --checkpoint /private/authorized/sonri-rfdetr-large-v1.onnx \
  --permission-reference NONSECRET_OWNER_LOCAL_RESEARCH_PERMISSION_REFERENCE \
  --evidence-dir /private/results/desktop
```

The generator rejects an evidence directory inside the repository and checks exact size/hash, ONNX consistency and absence of external tensors. It writes only deterministic synthetic assets/goldens to source, and hardware/reference evidence to the private output directory. `resize-reference.f32.fixture` is deterministic gzip with an opaque extension so Android packaging does not silently decompress/rename `.gz` assets. Numeric comparison tolerances: preprocessing max absolute 2e-6, raw boxes 1e-4, raw logits 1e-3, same raw class sequence/count. The non-square fixture exercises resize and aspect-fit geometry; zero findings is explicitly not health.

## Real pretrained Android execution

Only after checkpoint-specific research permission:

```sh
python3 apps/android/scripts/device_test.py \
  --serial emulator-5554 --setup-emulator \
  --apk apps/android/app/build/outputs/apk/debug/app-debug.apk \
  --test-apk apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk \
  --pretrained /private/authorized/sonri-rfdetr-large-v1.onnx \
  --permission-reference NONSECRET_OWNER_LOCAL_RESEARCH_PERMISSION_REFERENCE \
  --iterations 5 --output /private/results/emulator
```

The harness streams the private model directly into the debuggable application's private `no_backup` directory. It waits for remote completion and verifies remote byte count and full SHA-256 before invoking tests; host hash alone is insufficient because ADB `exec-in` can return before the consumer flushes. Temporary benchmark weights are removed in `finally`. No checkpoint is uploaded with evidence. The native test rehashes and reloads each run, compares full raw outputs on two fixtures, then measures five additional identical synthetic analyses. p50/p95 use nearest rank; n=5 has substantial uncertainty and is not a clinical sample. Process PSS is sampled every 100 ms, not a guaranteed allocation peak. Emulator battery/thermal values are marked virtual and not physical evidence.

The additional emulator-only native workflow test imports the exact model through the real `LocalModel` importer (test URI, no system picker automation), explicitly consents to the built-in fixture, acknowledges quality, clicks inference, checks the actual saved raw finding count, displays the bbox Canvas and confirms no ICD candidate/review was generated. Its expected 12 findings come from the independently executed desktop fixture, not runtime hardcoded boxes. Temporary test record/model are removed without deleting other records. Logs and reports contain synthetic outputs only.

## Physical phone protocol (not executed in this delivery)

Provide an authorized, dedicated ARM64 Android 10+ phone, owner-set screen lock, USB debugging, approved exact checkpoint-copy rights and synthetic-only test approval. Manually select airplane mode with Wi-Fi/cellular off; the harness refuses to mutate physical settings. Replace emulator arguments with `--serial YOUR_SERIAL --physical-approved-synthetic-only` and omit `--setup-emulator`. Approve installation/USB prompts locally. Never use a phone containing patient data for a debug APK benchmark.

Record actual model/RAM/OS, installation/startup, full system credential and file-picker roundtrip, camera permission granted/denied, consent/review negative cases, hash corruption, cancellation, background lock, force-stop/restart, external PDF/JSON export/delete, storage limits and recovery. Measure cold/warm load, at least 30 latency samples, memory pressure/OOM/crash behavior, battery delta and sustained thermal state with a documented idle baseline. Test representative 4/6/8 GB devices separately. The current harness samples seven model executions (two reference + five repeat), so it does not replace sustained battery/memory-pressure testing or establish a safe 15-second phone target. No physical phone is listed supported until those results exist.

## Evidence scope

The committed `evidence/` snapshot contains synthetic numeric execution evidence and test/APK source hashes, not private weights, device serials, Android IDs or patient data. Local and CI APK checksums may differ because debug signing certificates/build metadata differ; always use the checksum from the matching artifact. Public CI establishes native software acceptance on its named emulator only. Follow the final PR checks/artifact for actual CI results; no green build is inferred from the workflow YAML.
