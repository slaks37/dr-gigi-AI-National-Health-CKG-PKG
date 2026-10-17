# SONRI Zero Budget Deployment

Updated 2026-10-16. Research implementation; no clinical or production approval.

Mandatory additional AI API/license expenditure in this run: Rp0. No paid model API, GPU service, Roboflow credits, subscriptions or billing activation. RF-DETR source/checkpoint use Apache-2.0 as verified. Python runtime + model currently occupy about 1.1 GiB + 128 MiB locally; CPU/RAM/electricity/storage/hosting still have costs.

Keep patient screening functional without Python or generative AI. Local Model Lab is opt-in with three absolute private paths in `.env.local`: SONRI_RESEARCH_PYTHON, SONRI_RESEARCH_MANIFEST, SONRI_RESEARCH_ARTIFACT. These paths point to an isolated venv, permission/hash/label manifest and checkpoint. Example manifest/runner instructions in `research/oral-vision/README.md`.

Use owner-controlled local host for research. Do not configure this CPU/Python path on a serverless host without runtime/package/storage/time verification. No external Python microservice or public GPU endpoint was introduced. Build includes the runner script in tracing, but not Python or weights. Native HEIC runtime still depends on host support.

No staging or production deployment was performed. Staging needs owner-authorized infrastructure, identity configuration, workload limits, and permitted evaluation cohort. Production remains NO-GO. Rollback is reverting this branch/PR and removing optional research environment entries; no data migration requires reversal.
