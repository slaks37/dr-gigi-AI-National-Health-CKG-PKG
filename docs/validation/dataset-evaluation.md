# Real-image evaluation — 24 October 2026

A real pretrained YOLO run on17 public, licensed dental images is complete. It establishes a limited **source raw-index reproduction**, with seven false negatives. It does **not** satisfy an independent or clinical validation benchmark. The separate nominal COCO-name comparison is quarantined because the annotation class contract conflicts with checkpoint names.

## Source and eligibility

[Zenodo record 14827784](https://zenodo.org/api/records/14827784) currently declares CC BY4.0 for the dataset. Retain attribution to Faizan Ahmed and colleagues, Scientific Data 12, 1297 (2025), DOI 10.1038/s41597-025-05647-9, dataset DOI 10.5281/zenodo.14827784. The publication reports calibrated dentist annotation with adjudication, anonymization, consent/assent for public sharing and AKUH ethical review. These are source-reported provenance, not new SONRI professional sign-off. Dataset licensing and article publication rights are separate.

The frozen selection is the **entire17-image intersection** between original benchmark-test COCO-referenced files and Daath's test split at commit `f02596a0227b9eaf767b955cd67196236111a3d5`. No score or image appearance influenced selection. There are59 reference boxes and zero independently verified healthy/negative images. Model weights were not retrained.

Only those17 image members and annotation metadata were retrieved using HTTP ranges. ZIP CRC32 and per-image SHA-256 were checked; a full 1.57 GB archive MD5 check was not performed. Images, original filenames and private manifests remain in a temporary 0700 directory outside Git. Public artifacts use SHA-256 identifiers and normalized geometry. Private overlays provide source/prediction localization panels and must not be added to Git.

The original test COCO JSON references 232 images; train/valid JSON reference 1781/214. These counts are annotation-reference denominators, distinct from the paper's6313 total images. Missing COCO entries are not presumed negative. The source Daath split has 1846/327/332 train/val/test images. Its filename grouping gives zero normalized identifier overlap, but303 training images do not match the notebook's patient-ID regex. Patient identity, complete training-population membership and exact/near-duplicate pixel independence remain unverified. See [eligibility evidence](dataset-eligibility.v1.json).

## Actual run and raw-index results

Exact checkpoint SHA-256 `7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d`; CPU, Ultralytics 8.4.177, torch 2.8.0, Python 3.12.14, input 1280, NMS IoU 0.7, max 300 detections/image, prediction floor 0.001. One real run took10.3046 seconds for 17 images. Operating-point matching uses confidence ≥ 0.25 and class-specific one-to-one IoU ≥ 0.5. AP uses 101-point interpolation across scores, with AP50–95 averaging IoU0.50:0.05:0.95; this is the documented local protocol rather than a claim of full COCOeval equivalence.

| Compatible raw training index | Reference boxes | TP | FP | FN | Precision | Recall | AP50 | AP50–95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| RAW_TRAINING_CLASS_0 |52|45|11|7|0.8036|0.8654|0.9008|0.6052|
| RAW_TRAINING_CLASS_1 |7|7|2|0|0.7778|1.0000|1.0000|0.7894|

These names deliberately carry no disease semantics. The [result](../../services/evaluation/source-raw-yolo-reproduction-17.v1.json) includes every false-positive prediction box, missed reference box and hash-identified case. Source YOLO references were byte-compared to the pinned test annotations. Source COCO/LabelMe class-name conflicts are documented in the [independent cross-format audit](dataset-cross-format-audit.v1.json), never fixed using model scores.

Seven raw-class 0 false negatives remain: five have a same-class prediction at the reference location below 0.25 confidence, one has the opposite raw class at that location, and one has insufficient localizationIoU. These are algorithmic error categories requiring clinician review. Small samples, correlated teeth/views, no negative-image cohort, possible source-training leakage, unresolved semantics, population/device restrictions and reference conversion differences limit interpretation. Descriptive box-level Wilson 95% recall intervals are0.7473–0.9332 for raw 0 and0.6457–1.0000 for raw 1; they are not patient-level clinical confidence intervals.

The [nominal COCO-name comparison](../../services/evaluation/source-reproduction-17.v1.json) reports d TP0/FP56/FN7 and D TP1/FP8/FN51. Its status is **QUARANTINED_REFERENCE_CLASS_CONFLICT**. Those numbers diagnose incompatible class contracts and must never be presented as a valid clinical disease benchmark.

## Reproduction and acceptance

Use [the evaluation README](../../services/evaluation/README.md). Strict independent-benchmark mode rejects the actual cohort because its patient/duplicate/training-population audit is missing. The [recorded rejection](../../services/evaluation/independent-benchmark-gate.v1.json) is a passing safety check, not a completed benchmark. No existing Preview safety gate, clinical workflow or model runtime label was relaxed.

An independent benchmark still needs an artifact-compatible class contract adjudicated by source authors/qualified clinicians, a licensed frozen cohort of verified distinct patients, the complete training population and pixel/near-duplicate audit, reviewed negatives and independent reference labels, and prespecified clinical thresholds/acceptance criteria. RF-DETR additionally lacks its exact export class/modality provenance. No disease capability or ICD-10 coverage is added by these source-index results. No paid resources or training were started. The observed class-contract defect warrants reference repair before considering fine-tuning.
