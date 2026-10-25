# Historical local hybrid research acceptance — `82aa781`

Baseline checked 2026-10-25, before the subsequent cloud creation approval. This branch is stacked on Draft PR #6 at `c6ca0ea49a078d13d3f49574fc498ca765368d1a`. The results below describe the earlier local-only `82aa781` delivery. **They are not the current hosted status.** The owner later approved the separate Spark project and private tester group; see [HOSTED-STATUS.md](HOSTED-STATUS.md) for actual provider checks, hosted execution and unresolved failures.

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
| Physical phones / hosted Firebase / Cloudflare / App Distribution | Not tested or provisioned in this historical local run; see the later hosted status |

Final default connected APK: **102,839,242 bytes**, SHA-256 **`b8009fd290aff0b2acd2cdf3e655f6167eff798fdc983090d386408e63cfd4b0`**. It has network permission, no configured Firebase project/update authority, no pretrained weights/test TLS trust, disabled backups and TLS-only settings. APK bytes/debug certificates from another build host can differ; always use the checksum accompanying that artifact.

Actual private RF-DETR execution on one AOSP API35 ARM64 emulator, configured 4 GiB/two cores, airplane mode/Wi-Fi/data disabled: five samples, inference p50 **906.70 ms**, p95 **1370.64 ms**; analysis total p50 **1252.19 ms**, p95 **1805.98 ms**; sampled peak PSS **466,075 KiB**. Total excludes earlier import/decode and drawing. Two generated geometric fixtures produced 12/0 raw findings with matching raw class sequences/counts and numeric tolerances. This establishes runtime compatibility, not dental accuracy or phone battery/latency.

The actual local-service run uses two named Firebase client contexts on one emulator, not two devices or complete multidevice UI acceptance. It verifies synthetic registration/OOB verification/profile/login, encrypted restoration, disconnected rejection/reconnection, idempotency, stale/reviewed conflict protection, cross-account rejection, password recovery and a pending deletion request. The signed-delivery test activates two arithmetic ONNX kernels, rejects corrupt/truncated downloads, checks rollback, runs offline and rejects rollback below a new signed safety floor. It does not distribute a dental model.

[Reproduce these checks](TESTING.md). The new GitHub workflow builds a separate safe default APK before emulator configuration and uploads only that APK and synthetic reports; inspect the Draft PR's actual run/artifact links for CI completion. No local pretrained checkpoint enters CI.

## Gates recorded at this baseline

- **Subsequently resolved in part:** creation of the owner-approved empty Spark project, public client/OAuth configuration, real verification email actions, registered certificate and independent no-billing/rule checks. Real Google UI and completed password-reset recovery remain unverified. No paid service was created.
- **Subsequently resolved in part:** the owner-only tester group, private App Distribution and hosted SDK acceptance were executed. Owner release-signing authority, hardened connected release configuration, Pages origin/public update key and full physical-device/product UI acceptance remain outstanding. The APK remains debuggable research software.
- Independent cryptographic review before patient-data sync; only consented synthetic records can sync. Per-record professional key delivery, full professional UI, complete two-device acceptance and live operator purge remain outstanding. A deletion request is not completed deletion.
- Physical 4/6/8 GB phone/camera/credential testing, sustained battery/thermal/memory-pressure measurements. Emulator numbers must not be advertised as phone performance.
- Checkpoint redistribution rights, authoritative disease class provenance, independent patient-disjoint licensed annotations and authorized clinical review. All raw labels remain **UNVERIFIED**, verified AI ICD capability **0/108**, clinical use **PROHIBITED**. The original credential incident stays **OPEN** pending nonsecret owner revocation evidence; the credential was not read or tested.
- No new training, merge, clinical production deployment or billing activation occurred. Quota estimates/dashboard are reproducible planning arithmetic and manual Console inputs, not live monitoring or a promise of unlimited free usage.
