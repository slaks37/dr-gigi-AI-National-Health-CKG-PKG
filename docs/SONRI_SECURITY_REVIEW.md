# SONRI Security Review

Updated 2026-10-16. Research implementation; no clinical or production approval.

Preserved Firebase server token verification/revocation, role checks, patient ownership, qualified independent assigned dentist review, guardian/subject checks, strict request schemas, quota controls, audit transactions and private no-store API responses. No production auth rules or database migrations changed.

Added admin-only inventory/inference API; request fields cannot select executables/artifacts or external URLs. Python path/manifest/artifact are operator environment configuration only. Image type/bytes/pixels/decode limits, private temp paths, checksum checks, raw class verification, cancellation, per-worker concurrency one, five admin attempts/minute, max 1,000 recent principals, 90-second Python deadline and 95-second process kill cap constrain resource use. Socket calls are blocked in the Python runner; no patient image is sent to an external provider. Source temp files are deleted; no images or predictions enter medical records via research paths. Checkpoint uses default safe RF-DETR loader, not unrestricted pickle fallback.

Open risks: public-writable source dataset, unknown consent/license/individual sharing; distributed worker limits are not globally coordinated; externally supplied Python/model manifests require operator provenance review; model reload per call; no production runtime load/capacity test; regulator/clinical sign-off absent. Local denial/contract/unit/emulator checks do not prove hosted security or identity-provider availability. No real patient accounts or records were created by tests.

Main branch protection inspection returned GitHub HTTP 403 with an upgrade/public-repository requirement. Enforced remote protection could not be established on the current plan. No upgrade, visibility change or repository-setting change was made. Work remains on a dedicated branch/draft PR with no direct main writes; owner must resolve enforcement before release.
