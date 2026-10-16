# SONRI Model Matrix

Updated 2026-10-16. Research implementation; no clinical or production approval.

| Candidate | Current evidence | Readiness / use |
|---|---|---|
| Owner RF-DETR Large v1 | Downloaded 128 MiB checkpoint; Apache-2.0 shown in authenticated Roboflow model page/export notice; actual local CPU inference on synthetic flat-field input | INFERENCE_TESTED for research smoke test only; benchmark/clinical review pending |
| RF-DETR Nano/Small/Medium/Large | Apache-designated models/source; released API inspected; no SONRI comparative training | Architecture candidate; no chosen clinical winner |
| Daath YOLO11m | Source README reports metrics on its original cohort; repository license unresolved | Isolated research reference only; not installed or benchmarked |
| Mask R-CNN dental segmentation | MIT source; README references Roboflow dataset/training; trained checkpoint availability and reuse rights not established | Unavailable |
| Gingival/mucosal/structure/radiograph AI | No task-appropriate reviewed artifact/data supplied | Unavailable |

Owner model ID: `intraoral-caries-detection-ynpy9-1-rfdetr-large-t1`. Artifact SHA-256: `9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c`. Stored outside repository under private `work/models`. Raw labels listed in Roboflow: Caries, Cavity, Crack, Tooth. IDs 0 (Caries) and 3 (Tooth) were observed in sample JSON. Other class IDs are blocked by the local manifest until an authorized label-map export is reviewed. No clinical ontology equivalence is assumed.

Roboflow UI verified during this run: precision 61.1%, recall 62.5%, F1 61.6%, mAP50 61.2%. These are vendor-reported test-set metrics, not independently reproduced. Cloud latency 5.3 ms is not local CPU latency. Roboflow UI dataset counter showed 4,779 images; this is a platform counter, not an independent content/consent audit.

Download succeeded after refreshing stale browser session; no upgrade, license purchase, billing activation, cloud training or manual cloud image submission occurred. Model artifact is not committed to GitHub.
