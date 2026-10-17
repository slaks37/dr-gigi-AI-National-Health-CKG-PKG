# SONRI Benchmark Report

Updated 2026-10-16. Research implementation; no clinical or production approval.

Actual SONRI checkpoint local CPU smoke test: `rfdetr==1.11.2`, Python 3.12, macOS arm64, two CPU threads, no network connections. Synthetic 640×480 flat-field PNG; no clinical content or positive lesions. Artifact hash `9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c`. Model load + predict reported 1270.79 ms, zero detections at threshold 0.25. This is one cold-path measurement, not a latency distribution or quality benchmark. First Python/library import time is excluded by the timer. TypeScript subprocess integration also executed successfully on a synthetic JPEG.

Independent clinical precision/recall/F1/AP/FP/FN: NOT_MEASURED. No authorized clinician-reviewed held-out intraoral cohort is available. Do not interpret synthetic zero detections as proof of health or classifier specificity. Roboflow and Daath published metrics are not comparable without the same independent test cohort.

`vision/evaluation/detection.ts` implements class-aware one-to-one IoU box matching, false-positive duplicate detection accounting, reviewed negative images, and threshold sweeps. `npm run vision:benchmark -- /private/evaluation.json /private/report.json` requires explicit permission/label/split attestations and frozen test-manifest hash. Synthetic unit tests verify arithmetic only. AP fields remain null; use separately validated COCO evaluation for mAP50/mAP50:95. No fake metrics are filled in.

ONNX/browser inference and mask alignment remain untested; no runtime switch/export performed.
