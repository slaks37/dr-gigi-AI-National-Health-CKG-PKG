# Phase 3 — independent benchmark pipeline

**Software pipeline implemented and tested; real independent benchmark BLOCKED.** No independently admitted clinical cohort or checkpoint-bound semantic reference review was supplied to this tool in this run. The existing 17-image source reproduction remains source reproduction with its stated class/patient limitations. Its existing schema is explicitly rejected by this independent pipeline. Synthetic test images and synthetic documentary assertions never count as clinical data or clinical validation.

`services/evaluation/independent.py` performs three offline stages: actual population/pixel audit, validation-only threshold analysis, and frozen held-out test evaluation. It calls the existing `evaluate.py` functions without changing that evaluator. It performs no image transfer, model loading, inference or model training. Model weights and inference-pipeline hashes bind supplied predictions; the evaluator does not certify their runtime origin.

## Private manifest contract

Store the manifest, images, prediction runs, audit and threshold plan outside application Git. Every JSON input's parent directory and the image root are checked: if a parent directory is itself a Git repository, the private directory must be ignored there too. Every image path is relative to the supplied private root; symlink/path escape, application-repository manifests and application-repository image roots are refused.

The JSON manifest has `schema_version: "sonri.independent-population.v1"` and these fields:

| Field | Required contract |
| --- | --- |
| `data_kind` | `REAL_DENTAL_IMAGES` for an actually admitted cohort; `SYNTHETIC_SOFTWARE_FIXTURE` requires explicit software-fixture opt-in at every stage and produces only `SYNTHETIC_SOFTWARE_TEST_ONLY` results. |
| `checkpoint_sha256` | Exact reviewed model artifact SHA-256. |
| `class_names` | Object with canonical numeric-string class IDs and distinct source class names. Class semantics/order must be independently established against this exact checkpoint, not inferred from behavior. Source strings stay private; exported metrics use class IDs. |
| `provenance` | Nonempty `dataset_id`, `dataset_version`, `modality`, `license`, `license_evidence`, `clinical_annotation_evidence`. These references stay private. |
| `attestations` | Every required boolean below must be literal `true`, with a nonempty private `evidence_reference`. Complete, accountable external documentation is required; software cannot establish the truth of these assertions. |
| `records` | Complete dental training/model-selection, validation and test populations; all three splits must exist. Each row has the fields below. No patient identity may be manufactured from filenames. |
| `threshold_protocol` | Predeclared sorted unique `candidates` in [0,1], `matching_iou` in (0,1], and objective `MAXIMIZE_CLASS_F1_TIE_RECALL_THEN_HIGHER_THRESHOLD`. Grid floor must be at least the prediction run's score floor. |
| `near_duplicate_reviews` | Optional initially; every cross-split dHash candidate must later have the explicit, hash-bound independent adjudication below. |

Required attestations: `data_rights_confirmed`, `consent_or_approved_waiver_confirmed`, `clinical_reference_independently_reviewed`, `semantic_class_mapping_verified`, `patient_group_identity_verified`, `complete_training_population_declared`, `train_val_test_frozen`.

Each record requires:

```json
{
  "record_id": "<opaque lowercase hex, 32-64 characters>",
  "patient_group": "<independently established anonymous group, lowercase hex, 32-64 characters>",
  "split": "train|val|test",
  "private_path": "<private relative image path>",
  "sha256": "<actual 64-character raw image SHA-256>",
  "reference_reviewed": true,
  "review_evidence_reference": "<private independent reference-review record>",
  "reviewed_negative": false,
  "annotations": [{"class_id": 0, "box": [0.1, 0.1, 0.4, 0.4]}]
}
```

This is a field guide, not an admitted template: angle-bracket placeholders are intentionally invalid. An actually reviewed negative must have `annotations: []` **and** `reviewed_negative: true`, with independent review evidence. Missing labels, absent disease folders and model non-detections do not create healthy negatives. **Validation and test each require at least one explicitly reviewed negative control.** Every class must have at least one validation reference box before a threshold can be selected. Test classes with no references retain undefined recall/AP and explicit counts, and are listed under `classes_without_test_reference_boxes`; they have no measured positive-detection support from that test population.

## Actual leakage checks and adjudication

The audit reads every supplied file and verifies its declared raw SHA-256. It computes a second SHA-256 over EXIF-transposed canonical RGB bytes, including dimensions, so different JPEG encodings with identical decoded pixels cannot evade duplicate detection. Any repeated raw or canonical RGB image is rejected, including within a split. Any anonymous patient group spanning splits is rejected despite all documentary booleans.

The audit additionally computes a 64-bit horizontal grayscale dHash using a 9×8 BILINEAR resize. Cross-split pairs with Hamming distance ≤6 block admission pending review. This is a screening heuristic: false positives and missed crops/augmentations are possible. It neither auto-equates near images nor establishes independence. Within-split candidates are counted separately; exact duplicates remain prohibited everywhere.

Blocked audits contain opaque record-pair candidates for private review. To clear a pair, supply:

```json
{
  "pair": ["<record ID A>", "<record ID B>"],
  "raw_sha256_pair": ["<lexicographically smaller raw SHA-256>", "<larger raw SHA-256>"],
  "decision": "DISTINCT_IMAGES",
  "reviewed": true,
  "independent_reviewer_confirmed": true,
  "evidence_reference": "<private accountable adjudication record>"
}
```

The raw pair must match the current actual files. Changing images cannot reuse a stale review. `UNRESOLVED`, known duplicates/same capture, missing independent review and incomplete references do not clear a pair. Rebuild the manifest and audit after any adjudication or split change. The audit is a private working artifact; publish only aggregate findings and the final redacted metrics as authorized.

Bounds: 2,000 records, 64 classes, 21 candidate thresholds, 1,000 boxes/predictions per image, 16 MB per JSON input, 25 MB / 25 million pixels per image, 512 MB total image bytes and 200 million decoded pixels per audit. Multiframe images are unsupported. Larger cohorts require an explicitly reviewed resource/protocol change, not silently partial auditing.

## Prediction files and threshold freeze

Validation and test have separate JSON files:

```json
{
  "schema_version": "sonri.independent-predictions.v1",
  "manifest_sha256": "<canonical manifest JSON digest>",
  "checkpoint_sha256": "<exact reviewed checkpoint digest>",
  "split": "val",
  "inference_run": {
    "score_floor": 0.001,
    "max_det": 300,
    "pipeline_sha256": "<reviewed runner/runtime/preprocessing/postprocessing contract digest>",
    "evidence_reference": "<private actual inference-run evidence>"
  },
  "records": {"<validation record ID>": [{"class_id": 0, "score": 0.7, "box": [0.1, 0.1, 0.4, 0.4]}]}
}
```

Every record from the declared split must be present exactly once; extras, test records in validation, checkpoint/manifest mismatch, nonfinite values, invalid geometry and undeclared retention are rejected. Empty prediction arrays explicitly represent a run with zero retained predictions. Val/test score floor, `max_det` and pipeline digest must agree. Hash binding does not prove honest inference provenance; retain actual trusted runner logs privately.

Each stage SHA-256 binds canonical JSON (sorted keys, compact separators, no NaN) rather than incidental whitespace. The audit binds the complete manifest plus actual image fingerprints. The frozen threshold plan binds the audit, manifest, checkpoint, validation predictions and predeclared selection protocol. Select per-class thresholds by maximum validation F1, tie-breaking first by recall and then higher threshold. The selection function accepts only validation predictions and never uses test performance. This research objective does not recommend a clinical operating point. No sensitivity/specificity claim follows from the mathematical objective.

Record the emitted plan digest in an independently controlled research record **before opening test predictions**. The test stage requires that expected frozen digest, rechecks actual images/audit, and deterministically rederives the plan from the bound validation inputs. Re-signing an edited threshold plan does not make it validation-derived. These hashes detect staleness/mutation; they cannot prevent an operator from reading test results elsewhere, rewriting history or fabricating external attestations. Prospective blinding and freeze accountability remain research-governance responsibilities.

## Execution and metrics

Use Python ≥3.10 with Pillow; the existing isolated inference environment supplies these. Git is needed when checking ignore rules in an enclosing repository. No additional dependency or training resource is provisioned by the tool.

```sh
services/inference/.venv/bin/python services/evaluation/independent.py audit \
  --manifest /secure/sonri/manifest.json --private-images /secure/sonri/images \
  --output /secure/sonri/population-audit.json

services/inference/.venv/bin/python services/evaluation/independent.py select-thresholds \
  --manifest /secure/sonri/manifest.json --private-images /secure/sonri/images \
  --audit /secure/sonri/population-audit.json \
  --validation-predictions /secure/sonri/validation-predictions.json \
  --output /secure/sonri/frozen-thresholds.json

# Substitute the digest independently recorded when validation thresholds froze.
services/inference/.venv/bin/python services/evaluation/independent.py test \
  --manifest /secure/sonri/manifest.json --private-images /secure/sonri/images \
  --audit /secure/sonri/population-audit.json \
  --validation-predictions /secure/sonri/validation-predictions.json \
  --threshold-plan /secure/sonri/frozen-thresholds.json \
  --frozen-plan-sha256 RECORDED_FROZEN_PLAN_SHA256 \
  --test-predictions /secure/sonri/test-predictions.json \
  --output /secure/sonri/test-results.json
```

Audit exit 1 means unresolved near-pair review; exit 2 means rejected input. Reports include all per-class TP/FP/FN, precision/recall/F1, normalized localization evidence and every missed/false-positive box. Reviewed-negative image FP rates have explicit numerators/denominators, per class and for any class; an absent negative denominator yields `null`, not zero. AP uses all supplied pre-threshold retained scores; operating counts use frozen per-class thresholds. Thus AP and a threshold's false-negative count answer different questions. Runner score floor/max-det still limit observed AP.

Final reports omit private paths, patient-group tokens, owner/reviewer references and source class-name strings. Images are referenced only by raw SHA-256. Every result prohibits clinical use and denies clinical validation; box-level Wilson intervals are descriptive and ignore within-patient/tooth correlation. Licensed real data plus documentary admissions could produce an independent **research** benchmark; they do not certify clinical use.

## Observed software verification

```sh
services/inference/.venv/bin/python -m pytest services/evaluation/tests/test_independent.py -q
```

**16 synthetic software tests passed** on actual generated image files, including all three CLI stages; a reviewed negative with injected false positives; mandatory negative controls in validation and test; private-manifest rejection in application Git and an unignored enclosing repository; patient leakage; exact duplicate bytes; different JPEG bytes with identical decoded pixels; unreviewed empty labels; uncertain near-pair blocking and hash-bound adjudication; test-prediction exclusion during threshold selection; frozen plan tamper even after recomputing its seal; changed manifest/validation predictions/image bytes; changed validation/test retention; and public-report identifier suppression. The existing 17-image source artifact is explicitly rejected. These results are software evidence only, with no clinical sample size or clinical performance claim.
