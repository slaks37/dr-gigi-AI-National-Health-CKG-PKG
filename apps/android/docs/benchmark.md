# Executed Android research evidence — 2026-10-25

**Result:** real RF-DETR FP32 inference and native bbox workflow succeeded on an Android **emulator**, in airplane mode, without INTERNET permission or a remote service. No physical phone was available; the owner explicitly requested APK/emulator continuation. This is synthetic software compatibility/equivalence evidence, not clinical accuracy, independent real-image evaluation or phone performance validation.

Baseline is integrated PR #5 head `bfc3c1a5a6a432759e170d119b797f9d7aa8a4d1`. Android source is isolated on `codex/sonri-android-offline`; source hashes, actual APK SHA and instrumentation APK SHA are bound in [execution evidence](../evidence/android-emulator.v1.json). Existing production, protected Preview, clinical gates, training and cloud resources were not changed.

## Actual measured execution

AOSP Android 15 / API 35, ARM64-v8a emulator on an Apple Silicon macOS host, configured 4 GiB / two virtual CPUs / software GPU. Guest OS reported 4,111,659,008 bytes RAM. This is **not a 4 GB physical-phone result**. ORT Android 1.24.3 CPU, two intra-op threads, original 704×704 FP32 weights, ALL_OPT; each analysis rehashes/reloads/closes its session.

| Measurement | Observed value / scope |
|---|---|
| Installation / startup | APK installation passed; force-stopped Activity `am start -W` TotalTime **1,970 ms**, WaitTime 1,976 ms. One sample, not a p95 or first-ever OS boot. |
| First model load | **528.37 ms** |
| Repeat inference p50 / p95 | **845.76 / 926.66 ms**, n=5 synthetic repeats, nearest rank |
| Analysis total p50 / p95 | **1,170.75 / 1,255.03 ms**, includes model SHA/load/preprocess/run/output decoding; excludes prior image import/decode and UI drawing |
| Sampled process peak PSS | **452,221 KiB (~441.62 MiB)**, sampled every 100 ms across reference/repeat execution; not an absolute peak, isolated ORT allocation or sustained memory-pressure test |
| Exact local model size | **121,573,930 bytes**, no external tensor files |
| Debug user APK size | **91,363,222 bytes** (both ARM64/x86_64, debuggable), no weights |
| R8 unsigned release build | **62,507,947 bytes**, build passed; not owner-signed or device-accepted as a release |
| Native libraries | All 10 checked ELF64 libraries have PT_LOAD alignment ≥16 KiB. This does not prove physical 16 KiB page-size acceptance. |
| Offline | Airplane flag observed; emulator Wi-Fi/cellular disabled; installed package has no INTERNET permission. All tested core operations succeeded. |
| Battery / temperature | Emulator reported 25°C and thermal status 0. **Virtual values, not physical battery/temperature evidence.** Drain/sustained heat NOT_ESTABLISHED. |
| Crashes / recovery | No crash during this short successful suite; fresh session execution repeated and background workspace lock/encrypted reload passed. Sustained OOM/thermal/restart-after-corruption recovery remains untested. |

Five repeats have substantial uncertainty. Host load, scheduling, host thermal state and emulator acceleration differ from phones. An earlier exploratory run under concurrent host work was slower; the committed table is the completed final source/APK-bound run at `2026-10-25T10:13:15.535797+00:00`, not a claim of reproducible phone latency. The provisional 15-second midrange-phone target remains **NOT_TESTED**.

## Numerical equivalence and native UI

Actual existing Python adapter + ONNX Runtime CPU 1.24.3 reference was executed first. No checkpoint conversion, quantization, calibration, resolution change, new labels or training occurred. Full float preprocessing was separately compared on a 315×123 synthetic RGB pattern (all 1,486,848 floats within 2e-6), with actual EXIF orientation-6 JPEG pixel tests and aspect-fit geometry unit tests.

| Own geometric fixture | Actual raw findings, desktop = Android | Maximum absolute box difference | Maximum absolute logit difference |
|---|---:|---:|---:|
| 704×704 `research-fixture.png` (SHA `2fd5e924…32445`) | 12 | 2.5630e-6 | 2.5272e-5 |
| 315×123 `resize-fixture.png` (SHA `c9cba991…ae86b`) | 0 | 2.4274e-5 | 9.8705e-5 |

All raw class sequences/counts match; complete raw tensors, not just counts, are compared. Allowed raw-output tolerances were boxes 1e-4 / logits 1e-3. Small FP32 kernel/architecture differences are expected and stayed inside those predeclared software bounds. Unknown original training transforms/class semantics remain unresolved.

The emulator-only native workflow also used the real local importer, consent, image decoding, quality acknowledgment, actual inference button, encrypted save and visible Canvas bounding boxes. It checked the 12 actual raw findings and empty candidate/review fields. Runtime code contains no expected box/count injection. Test-only expected outputs come from the independently executed reference. System credential/picker interaction and camera hardware were not automated or claimed verified; test setup uses a dedicated emulator and synthetic screen credential.

## Completed checks

[Software snapshot](../evidence/software-tests.v1.json): **10 Kotlin tests**, **10 public Android instrumented tests** plus **2 explicitly skipped private tests**, then **2 private exact-model instrumented tests passed**. Android lint passed with 0 errors and 13 nonfatal dependency/icon warnings. Debug, instrumentation and R8 unsigned release builds passed. The final APK static inspection verifies no bundled model, test graph/goldens, keys, INTERNET/storage/audio permission or enabled backup. Tests include native catalog search, FDI editing/save/reload/background lock, denied-camera import alternative, native arithmetic, EXIF/resize, hash rejection, actual Keystore tamper/deletion and real PDF output.

Local debug APK SHA-256:

```text
eee000f9bde5eb135df583b6d69d47760bdb0d728133a8e0d0b2e95a0988d6ed
```

Public GitHub CI executes the software suite without private weights. Its APK can differ because CI uses a separate debug certificate/build environment; obtain that artifact's own checksum. See the Draft PR's actual workflow/check/artifact links for CI evidence; the existence of YAML does not establish execution.

## Hardware and clinical acceptance

| Target | Status / precise blocker |
|---|---|
| API 35 ARM64 emulator | Actual software + exact model CPU inference/equivalence passed as above |
| CI API 35 x86_64 emulator | Public software-only path configured; use actual PR check results, no private-model claim |
| Physical ARM64 4 GB | **NOT_TESTED — no physical device supplied** |
| Physical ARM64 6 GB | **NOT_TESTED — no physical device supplied** |
| Physical ARM64 8 GB | **NOT_TESTED — no physical device supplied** |
| Android 10–14, vendor camera/Keystore, 16 KiB page-size device | Build targets only; **NOT_TESTED** |
| Battery / sustained heat / memory pressure / many-case durability | **NOT_ESTABLISHED — physical hardware/protocol required** |
| Other model files/hashes, ARMv7/32-bit, Android below 10 | Intentionally unsupported by this build/import contract |
| Public checkpoint bundling / copying to additional phones | **BLOCKED — artifact-specific Android redistribution rights not independently verified** |
| Clinical model use / AI ICD-10 diagnosis | **PROHIBITED — authoritative labels/modality, independently reviewed licensed patient-disjoint benchmark, clinical/legal authorization missing** |

No real dental-image accuracy, sensitivity, specificity, per-class disease recall or clinical validation is derived from these fixtures. The 17-image Phase 2 source reproduction is not reused as independent evidence. Terminology/workflow coverage remains 108/108 while verified AI ICD capabilities and clinical validation remain 0/108. No smaller replacement, fine-tuning or paid optimization job is justified by these software results alone. Follow the [physical testing protocol](testing.md) when hardware and rights are available.
