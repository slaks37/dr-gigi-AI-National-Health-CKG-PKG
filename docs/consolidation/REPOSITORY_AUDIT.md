# SONRI repository and checkpoint consolidation

Audit date: 24 October 2026, Asia/Jakarta. Scope: all ten repositories named in the mission. The application baseline is `e02f602811e4d36a3ac32fe18e5e455018c6938f`. Feature implementation and its test outcomes are recorded separately; this document reports inspected source and artifact provenance.

[repositories.json](repositories.json) records exact commits, modality, architecture, checkpoint pointers, dependencies, labels, licenses, permissions, test evidence, risks and integration decisions for every source. [checkpoints.json](checkpoints.json) records three current local SHA-256 checks. All ten GitHub recursive trees were complete. Selected source text was read through authenticated GitHub APIs; no patient dataset, repository image, CBCT volume or new checkpoint archive was downloaded. Raw tree inventories and credential-bearing source text are excluded from Git.

| Source | Pinned commit | Reusable contribution | Execution/permission decision |
| --- | --- | --- | --- |
| Main Dr Gigi application | `e02f602811e4` | Existing Next.js/Firebase/Firestore foundation, protected review, image checks, deterministic clinical evidence | Retain repaired architecture; no storage migration |
| Sonri-untuk-Negeri | `b43c2fe614a1` | Earlier UI/navigation reference | No source license file; browser credential exposure and generative diagnosis path preclude importing inference/auth |
| 2.0-Sonry-Oral | `214b87b4c977` | Camera, annotation and report presentation reference | No source license file; unauthenticated record handlers and browser localStorage fallback must not be imported |
| rf-detr | `a0065d0acaa3` | Optional research detector/export framework | Apache source verified; Plus/PML variants excluded; dental checkpoint rights and label mapping separate |
| Tooth-and-Cavity-Instance-Segmentation | `de639e2b608f` | MIT Mask R-CNN/ResNet50 training, mask geometry and metrics reference | No trained dental checkpoint in tree/releases; dataset rights unverified |
| dental_study | `f02596a0227b` | Existing research YOLO11m checkpoint | Local hash matches official LFS pointer; raw `d/D` semantics unverified; YOLO AGPL obligations require review |
| ToothSeg-sonri | `b29d1017fa12` | Apache CBCT dual nnU-Net segmentation/numbering framework | Official CC BY 4.0 checkpoint located; not installed; no authorized CBCT acceptance volume |
| YOLOv8/U-Net panoramic pipeline | `0127fd30c5f3` | Detection/pose/mask/landmark and bone-loss geometry reference | Six checkpoint families absent; no code/model/data license evidence |
| DENTEXsonri | `a33bc4cd24ae` | Hierarchical panoramic quadrant/enumeration/abnormality contract | Missing `model_final.pth`; dataset is noncommercial; old container runtime requires repair |
| Oral-Disease-detector-sonri | `9f96216e6daf` | EfficientNetB0 six-class contract and no-healthy-class limitation | Missing `.h5`; source/model license unverified; dataset API explicitly reports unknown license |

## Checkpoints and compatibility

The existing Daath artifact is 80,923,921 bytes. SHA-256 matches the [commit-pinned Git LFS pointer](https://github.com/slaks37/dental_study/blob/f02596a0227b9eaf767b955cd67196236111a3d5/best.pt). It was located locally and hashed again. Its `d` and `D` labels remain raw model labels; neither constitutes confirmed disease or a trusted mapping to WHO ICD-10. The upstream README describes occlusal views and author-reported metrics; neither smartphone generalization nor independent clinical performance was reproduced by this audit. The optional MedGemma branch is excluded from the integration: the source itself describes whole-image negative-template collapse and reduced recall when it vetoes detector findings.

The owner-local RF-DETR Large checkpoint and its existing ONNX export were hashed again. The checkpoint has five output slots and no authoritative class-name metadata in the available local metadata inspection. Retain `RAW_CLASS_0` through `RAW_CLASS_4`, including slot 0; do not assume any slot is background. An earlier local operator record reports an Apache-2.0 notice at the authorized model export, but this audit did not revisit the authenticated model page. Preserve the exact artifact-specific grant before distribution or hosted operation. Generic RF-DETR source licensing does not resolve that grant.

The [official ToothSeg checkpoint record](https://zenodo.org/records/14893540) and [record API](https://zenodo.org/api/records/14893540) identify `ToothSeg.zip`, 920,019,129 bytes, CC BY 4.0 and published MD5 `5d8dd061cce9529943567aeba3271143`. No archive was downloaded. Installation must preserve both semantic and border-core branches, plans, checkpoint dataset metadata, resampling and orientation. Compute a local SHA-256 after download; a published MD5 is a transport reference, not a replacement for artifact provenance. ToothFairy2 dataset permissions remain separate from the checkpoint license.

The classifier expects `best_pretrained_EfficientNetB0_model.h5` and 224×224 RGB input. Its exact class order is Calculus, Caries, Gingivitis, Hypodontia, Mouth_Ulcer, Tooth_Discoloration. It has no healthy/background class. The source's Kaggle model page could not be verified; an attempted exact public model metadata endpoint returned HTTP 404, which does not prove all model variations are absent. The [source dataset metadata API](https://www.kaggle.com/api/v1/datasets/view/salmansajid05/oral-diseases) reports version 3 and `licenseName: Unknown`. Model and dataset reuse remain blocked pending rights, exact version and hash.

DENTEX's [pinned README](https://github.com/slaks37/DENTEXsonri/blob/a33bc4cd24ae864c679e8ee0a156354b2b6bd858/README.md) states CC BY-NC-SA 4.0 for data and MIT for other code, but the full tree has no LICENSE file. The detector references `/opt/app/pretrained_model/model_final.pth`, absent from the tree; the Dockerfile copies that absent directory. The README's FDI example also conflicts with its quadrant description, so laterality must be verified from trusted mapping and image orientation. Its labels cover only four abnormality categories, not K00–K14 diagnosis coverage.

## Concrete gates

- Owner action: revoke/rotate the API credential exposed in the earlier Sonri-untuk-Negeri browser source. The credential is not reproduced in these artifacts. Remove it from current source and assess history/access separately; deleting the line does not rotate it.
- License action: retain artifact-specific owner RF-DETR export terms; resolve Daath code notice/YOLO AGPL obligations, missing classifier/panoramic source and model rights, and DENTEX commercial-use restrictions before redistribution or release.
- Artifact action: obtain exact classifier, panoramic and DENTEX dental checkpoints with hashes/class metadata; install the ToothSeg bundle and its plans in an isolated 3D worker if CBCT execution is required.
- Dataset/clinical action: obtain consent, legitimate usage rights, patient/duplicate-grouped frozen cohorts and clinician-approved label mappings/thresholds. [The Daath source dataset record](https://zenodo.org/api/records/14827784) declares CC BY 4.0; that declaration does not establish consent for unrelated SONRI patient images.
- Validation action: run each model on its compatible authorized modality, then independent benchmarks and clinical review. Source evaluation scripts and README numbers are author evidence only; they do not constitute measured SONRI sensitivity, specificity, mAP, Dice or calibration.

No source code was blindly merged. No reviewed medical label, clinical performance result, authorized patient dataset, funding/GPU entitlement, model license decision or production approval was invented. Runtime smoke results from feature implementation belong in the inference service's evidence directory and must remain separate from this source audit.

## Refresh

Run `python3 -B scripts/audit-repositories.py --output /tmp/sonri-repository-audit-refresh` using an authenticated `gh` CLI. This fetches metadata, complete trees and selected text/LFS pointers; it does not clone image datasets or download model binaries. It redacts recognizable exposed API keys in retrieved text. Review changes before updating the curated manifest; automated text selection is not a legal or clinical approval process.
