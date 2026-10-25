# Label investigation — 24 October 2026

Both checkpoint semantic mappings remain **UNVERIFIED** and clinical use remains **PROHIBITED**. [labels.v1.json](labels.v1.json) versions the exact artifact hashes, raw labels, source definitions and unresolved contracts. There are no clinical finding or ICD-10 bindings.

## YOLO: a demonstrated annotation contract conflict

The exact Daath artifact SHA-256 is `7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d`. Fresh inert metadata inspection confirms names `0=d,1=D`, training data `yolo_split/data.yaml`, YOLO11m, input size 1280, batch 32. The [pinned classes file](https://github.com/slaks37/dental_study/blob/f02596a0227b9eaf767b955cd67196236111a3d5/Dataset/classes.txt), [configuration](https://github.com/slaks37/dental_study/blob/f02596a0227b9eaf767b955cd67196236111a3d5/yolo_split/data.yaml) and [training notebook](https://github.com/slaks37/dental_study/blob/f02596a0227b9eaf767b955cd67196236111a3d5/colab.ipynb) declare the same order. Notebook provenance points to Zenodo record 14827784.

The [original dataset descriptor](https://doi.org/10.1038/s41597-025-05647-9) defines `d` as primary-tooth decay and `D` as permanent-tooth decay. Annotation boxes surround visible carious **teeth**; they do not establish lesion depth, stage, complete lesion boundaries, ICD-10 subtype or FDI tooth identity.

That source definition cannot safely be attached to the checkpoint's declared names. A complete 17-image cross-format audit compared public source annotation bytes, without using model predictions:

- Every official test YOLO annotation file is byte-identical to its pinned Daath test counterpart.
- All 59 YOLO reference boxes match official LabelMe geometry at IoU ≥ 0.98. Raw index 0 accompanies LabelMe `D` 52 times; index 1 accompanies LabelMe `d` 7 times.
- Original test COCO categories are `1=D,2=d`, whereas train/valid categories are `1=d,2=D`. Category IDs are local to each annotation file. 55 COCO boxes match YOLO geometry at IoU ≥ 0.98; four have small conversion differences, best IoU≈0.975–0.978, recorded explicitly.

See [the hash-identified comparison evidence](dataset-cross-format-audit.v1.json). The contradiction is between source annotation representations and declared checkpoint/config names. Detector behavior is not the evidence for this conclusion. The sample supports investigating a reversed label contract; it does not authorize a global class-name repair across an incompletely documented training cohort. Preserve checkpoint names as raw strings and preserve `UNVERIFIED` until the original converter/class order, full training manifest and qualified source/owner adjudication resolve the conflict. Do not retrain before repairing this reference contract.

## RF-DETR: exact export provenance remains missing

Fresh PT inspection for SHA-256 `9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c` finds only model/args, `dataset_file=roboflow`, `class_names=null`, and no category/id2label mapping. Its ONNX export SHA-256 `a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0` exposes input `[1,3,704,704]`, outputs `dets[1,300,4]` and `labels[1,300,5]`, and an empty custom metadata map. Five output slots do not identify diseases, modality or background handling.

An interpretable real-image RF-DETR evaluation needs the exact Roboflow workspace/project/version, immutable export categories/classes and training/export configuration tied to this artifact, model-specific licensing, modality documentation and a compatible independent reference cohort. A generic framework repository or unrelated dental dataset cannot supply those missing facts. Current `RAW_CLASS_0..4` stays unchanged.

## Reproduce metadata inspection

`services/evaluation/inspect_checkpoint.py` verifies the requested digest before opening the ZIP. All pickle global names resolve to inert local stand-ins; no checkpoint-named callable or tensor storage is executed. The test suite includes a malicious-pickle fixture proving it does not invoke a shell command. This extractor is for metadata, not an alternate runtime loader. See [YOLO metadata](labels-yolo-checkpoint-metadata.v1.json), [RF-DETR PT metadata](labels-rfdetr-checkpoint-metadata.v1.json) and [ONNX metadata](labels-rfdetr-onnx-metadata.v1.json).
