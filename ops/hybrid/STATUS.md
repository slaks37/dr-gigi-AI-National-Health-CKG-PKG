# Executed hybrid research acceptance

Checked 2026-10-25. This branch is stacked on Draft PR #6 at `c6ca0ea49a078d13d3f49574fc498ca765368d1a`. The owner confirmed that no dedicated Firebase project exists and authorized emulator/configuration work only.

## Local results

The [source/APK-bound execution record](../../apps/android/evidence/hybrid-acceptance.v1.json) contains actual reports and SHA-256 fingerprints, not predicted results:

| Check | Executed result |
| --- | --- |
| Kotlin unit tests | 12 passed |
| Firestore rules against local emulator | 8 passed |
| Debug / connected lint | Both passed, no errors |
| Final default connected APK, general Android instrumentation | 11 passed; 4 intentionally skipped (private weights and configured local-service tests run separately) |
| Same final APK, privately imported exact RF-DETR checkpoint | 2 passed: numeric equivalence and visible native workflow |
| Configured emulator-only APK, real local Auth/Firestore SDK and local signed HTTPS delivery | 2 passed |
| Physical phones / hosted Firebase / Cloudflare / App Distribution | Not tested or provisioned |

Final default connected APK: **102,839,242 bytes**, SHA-256 **`64aadbb29fd041a625534b8779b04ed18b8131bfe5fad25dd9e55fdd6ea163a3`**. It has network permission, no configured Firebase project/update authority, no pretrained weights/test TLS trust, disabled backups and TLS-only settings. APK bytes/debug certificates from another build host can differ; always use the checksum accompanying that artifact.

Actual private RF-DETR execution on one AOSP API35 ARM64 emulator, configured 4 GiB/two cores, airplane mode/Wi-Fi/data disabled: five samples, inference p50 **853.32 ms**, p95 **1044.85 ms**; analysis total p50 **1166.36 ms**, p95 **1348.27 ms**; sampled peak PSS **463,872 KiB**. Total excludes earlier import/decode and drawing. Two generated geometric fixtures produced 12/0 raw findings with matching raw class sequences/counts and numeric tolerances. This establishes runtime compatibility, not dental accuracy or phone battery/latency.

The actual local-service run uses two named Firebase client contexts on one emulator, not two devices or complete multidevice UI acceptance. It verifies synthetic registration/OOB verification/profile/login, encrypted restoration, disconnected rejection/reconnection, idempotency, stale/reviewed conflict protection, cross-account rejection, password recovery and a pending deletion request. The signed-delivery test activates two arithmetic ONNX kernels, rejects corrupt/truncated downloads, checks rollback, runs offline and rejects rollback below a new signed safety floor. It does not distribute a dental model.

[Reproduce these checks](TESTING.md). The new GitHub workflow builds a separate safe default APK before emulator configuration and uploads only that APK and synthetic reports; inspect the Draft PR's actual run/artifact links for CI completion. No local pretrained checkpoint enters CI.

## Remaining gates

- Owner-approved empty Spark project, public client/OAuth configuration, actual email/Google access, operator authority and independently checked billing/privacy settings. No cloud resource or paid service was created.
- Owner release-signing authority, hardened connected release configuration, approved Pages origin/public update key, authorized tester group and actual hosted acceptance. The delivered APK is debuggable research software.
- Independent cryptographic review before patient-data sync; only consented synthetic records can sync. Per-record professional key delivery, full professional UI, complete two-device acceptance and live operator purge remain outstanding. A deletion request is not completed deletion.
- Physical 4/6/8 GB phone/camera/credential testing, sustained battery/thermal/memory-pressure measurements. Emulator numbers must not be advertised as phone performance.
- Checkpoint redistribution rights, authoritative disease class provenance, independent patient-disjoint licensed annotations and authorized clinical review. All raw labels remain **UNVERIFIED**, verified AI ICD capability **0/108**, clinical use **PROHIBITED**. The original credential incident stays **OPEN** pending nonsecret owner revocation evidence; the credential was not read or tested.
- No new training, merge, clinical production deployment or billing activation occurred. Quota estimates/dashboard are reproducible planning arithmetic and manual Console inputs, not live monitoring or a promise of unlimited free usage.
