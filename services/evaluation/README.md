# SONRI evaluation tools

Real source-image reproduction is recorded in `source-raw-yolo-reproduction-17.v1.json`; the incompatible COCO-name comparison is separately quarantined in `source-reproduction-17.v1.json`. Neither is clinical validation. See [dataset interpretation](../../docs/validation/dataset-evaluation.md), [class-contract investigation](../../docs/validation/labels-investigation.md) and [versioned mappings](../../docs/validation/labels.v1.json).

The 17 image files are public research data under the current Zenodo record's CC BY4.0 grant. Acquisition retains attribution, verifies selected ZIP members and keeps images/private filenames outside Git. Checkpoint licensing is separate; the audited YOLO weights have upstream AGPL obligations. No model weights or source images are redistributed here.

From the repository root, use the existing inference environment:

```sh
services/inference/.venv/bin/python -m pytest services/evaluation/tests -q

# Download just the predeclared public licensed source-test intersection.
services/inference/.venv/bin/python services/evaluation/prepare_source_subset.py \
  --private-dir /tmp/sonri-dental-evaluation-20261024 \
  --acknowledge-public-research-license

# Compare source annotations without using detector behavior.
services/inference/.venv/bin/python services/evaluation/compare_source_annotations.py \
  --private-manifest /tmp/sonri-dental-evaluation-20261024/manifest.json \
  --evidence-output /tmp/sonri-dental-evaluation-20261024/cross-format-audit.json

# No training; an explicitly trusted exact artifact is required.
services/inference/.venv/bin/python services/evaluation/run_yolo.py \
  --manifest /tmp/sonri-dental-evaluation-20261024/manifest-raw-yolo.json \
  --checkpoint /secure/models/daath-best.pt \
  --sha256 7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d \
  --purpose source-reproduction --acknowledge-research-checkpoint-license \
  --output /tmp/sonri-dental-evaluation-20261024/predictions.json

services/inference/.venv/bin/python services/evaluation/evaluate.py \
  --manifest /tmp/sonri-dental-evaluation-20261024/manifest-raw-yolo.json \
  --predictions /tmp/sonri-dental-evaluation-20261024/predictions.json \
  --checkpoint-sha256 7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d \
  --purpose source-reproduction \
  --output /tmp/sonri-dental-evaluation-20261024/raw-index-results.json

services/inference/.venv/bin/python services/evaluation/render_localization.py \
  --manifest /tmp/sonri-dental-evaluation-20261024/manifest-raw-yolo.json \
  --predictions /tmp/sonri-dental-evaluation-20261024/predictions.json \
  --private-dir /tmp/sonri-dental-evaluation-20261024/raw-index-overlays
```

The runner emits raw detector outputs with minimum confidence 0.001; the evaluator computes TP/FP/FN at 0.25 and AP across retained scores. Normalized boxes, image hashes, every missed box and every false-positive box are reproducible. `--purpose independent-benchmark` **rejects this cohort**. A prospective accepted manifest must include complete verified patient-grouped split population, hashes, duplicate/near-duplicate groups and documentary audit references; the evaluator checks actual cross-split overlaps and refuses even fully attested cohorts with overlap. Its `reference_audit` additionally requires verified semantic mapping, compatible reference classes, independent clinical-reference review and an evidence reference; an explicit class conflict is always rejected. Missing annotations never silently become healthy negatives. Passing these documentary gates does not grant clinical approval.

Checkpoints can be inspected without executing their pickle globals:

```sh
services/inference/.venv/bin/python services/evaluation/inspect_checkpoint.py \
  --checkpoint /secure/models/daath-best.pt \
  --sha256 7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d \
  --output /tmp/sonri-dental-evaluation-20261024/yolo-metadata.json
```

Tests are synthetic software-verification fixtures only. Actual model evidence is in the real-image run artifacts and has the limitations above. Mapping records contain no clinical finding or ICD-10 bindings. Keep all clinical use prohibited.
