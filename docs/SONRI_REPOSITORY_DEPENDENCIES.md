# SONRI Repository Dependencies

Updated 2026-10-16. Research implementation; no clinical or production approval.

| Repository | Inspected commit | License signal | Purpose |
|---|---|---|---|
| slaks37/dr-gigi-AI-National-Health-CKG-PKG | e02f602811e4d36a3ac32fe18e5e455018c6938f | Existing application; no new license grant inferred | Sole implementation destination |
| [slaks37/rf-detr](https://github.com/slaks37/rf-detr) | `a0065d0acaa3663ce5ff09fe91d08d1b2a4046c3` | Apache-2.0 | Reference inspection only |
| [roboflow/rf-detr](https://github.com/roboflow/rf-detr) | `a0065d0acaa3663ce5ff09fe91d08d1b2a4046c3` | Apache-2.0 | Reference inspection only |
| [slaks37/dental_study](https://github.com/slaks37/dental_study) | `f02596a0227b9eaf767b955cd67196236111a3d5` | NOASSERTION | Reference inspection only |
| [benjamin-ahlbrecht/Tooth-and-Cavity-Instance-Segmentation](https://github.com/benjamin-ahlbrecht/Tooth-and-Cavity-Instance-Segmentation) | `de639e2b608fb0701738e9e8d650ebcae2976eb2` | MIT | Reference inspection only |
| [cvat-ai/cvat](https://github.com/cvat-ai/cvat) | `2a57dd2c6da2be2e9d25153e11296d240f731800` | MIT | Reference inspection only |
| [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | `2fd0afabe8e6f48c128218d356740b218eec9ca3` | MIT | Reference inspection only |
| [Project-MONAI/MONAI](https://github.com/Project-MONAI/MONAI) | `9b8aad300d4a586baeaddfa000885ffb24c78339` | Apache-2.0 | Reference inspection only |

Actual RF-DETR runtime: PyPI `rfdetr==1.11.2`, upstream tag commit `7433d5919d0f7e72cc6cb78663e0a731afd499e0`. Optional environment resolved in `research/oral-vision/requirements.lock.txt` (macOS arm64/Python 3.12). Fork and upstream develop matched during audit; experimental develop code was not merged.

Only application code and the released RF-DETR package were executed. CVAT, ONNX Runtime, MONAI, Mask R-CNN and Daath were not installed/run. Apache/MIT source licenses do not establish dataset or checkpoint permissions. RF-DETR Plus/PML variants excluded. Daath repository has no GitHub-recognized license; YOLO ecosystem obligations need legal review. No Daath weights or MedGemma dependency added.
