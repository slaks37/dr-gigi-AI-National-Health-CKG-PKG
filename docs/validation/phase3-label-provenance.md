# Phase 3: original label provenance — 25 October 2026

**Status: UNVERIFIED_CONTRACT_CONFLICT. Clinical use remains PROHIBITED.** A complete annotation-only audit strengthens the evidence for a source class-contract defect. It does not approve an inverse mapping, independent benchmark, new clinical capability or ICD-10 binding. No new images were read, no model inference was run and no training was performed.

## What was traced

The [machine-readable evidence](phase3-label-provenance.v1.json) covers all 2,505 label files in Daath's pinned train/validation/test split, all 2,245 original YOLO annotation files, the three original COCO metadata files, the actual training notebook/configuration history and fresh inert metadata inspection of the exact checkpoint.

The private checkout was pinned to [f02596a0227b9eaf767b955cd67196236111a3d5](https://github.com/slaks37/dental_study/tree/f02596a0227b9eaf767b955cd67196236111a3d5). Git LFS was disabled and only annotation/configuration directories were materialized. No image or weight object was fetched. Source patient filenames stay outside Git; public evidence contains aggregate counts and annotation hashes.

The public upstream history contains six commits. [The initial commit](https://github.com/Eeman1113/dental_study/commit/3876e982997375df2535904e700136e2e26e1eaf) introduces `Dataset/classes.txt`, `yolo_split/data.yaml`, `colab.ipynb`, `prepare_data.py` and `train_yolo.py`. None has an earlier or later public contract revision in this history. The later commits concern README/charts. Each relevant file's blob ID, SHA-256 and path-specific history are recorded.

The [notebook](https://github.com/slaks37/dental_study/blob/f02596a0227b9eaf767b955cd67196236111a3d5/colab.ipynb) downloads the original Zenodo `Dataset.zip` (cell 7), copies existing numeric YOLO labels unchanged, creates empty labels when no annotation is found, then hardcodes `0=d,1=D` (cell 9). Cell 11 trains YOLO11m with size 1280 and batch 32. This is a split/copy operation; it is not the original LabelMe-to-YOLO converter. `prepare_data.py` similarly reads existing YOLO classes rather than proving their original numeric order. Its default YOLO11s/896 training script is distinct from the exact artifact's YOLO11m/1280 metadata.

The original `Dataset/Annotations/MS_coco/{train,valid,test}.json` Git blob IDs match the previously retrieved official Zenodo benchmark metadata bytes exactly. Thus SONRI's download/import did not introduce the observed category contract. Original COCO category names are file-local: train/valid use `1=d,2=D`; test uses `1=D,2=d`. Matching below uses each file's explicit name, never a shared numeric category assumption.

## Full split annotation audit

| Daath partition | Label files | Raw 0 boxes | Raw 1 boxes | Source YOLO byte matches | Empty labels | No original annotation stem |
|---|---:|---:|---:|---:|---:|---:|
| Train | 1,846 | 4,365 | 358 | 1,447 | 421 | 399 |
| Validation | 327 | 773 | 80 | 255 | 72 | 72 |
| Test | 332 | 785 | 65 | 254 | 78 | 78 |
| Total | 2,505 | 5,923 | 503 | 1,956 | 571 | 549 |

All 1,956 split labels for which an original source YOLO annotation exists are byte-identical. No original-annotation stem exists for 549 split labels; all these files are empty. Twenty-two additional empty files already exist among the original annotations. Neither absent annotation nor an empty file independently proves a clinically healthy image. The notebook's background-image construction therefore needs explicit source/clinician adjudication before those records can be treated as validated negatives.

One-to-one geometry matching at IoU ≥ 0.95 associates 6,424 of 6,426 raw source boxes with explicit original COCO names:

| Daath partition | Raw 0 alongside COCO `D` | Raw 1 alongside COCO `d` | Unmatched raw boxes |
|---|---:|---:|---:|
| Train | 4,364 | 357 | 2 |
| Validation | 773 | 80 | 0 |
| Test | 785 | 65 | 0 |

No opposite association is observed among these matches. The two unmatched boxes are retained as uncertainty; at the stricter IoU ≥ 0.98 the counts are lower, and both thresholds are recorded. COCO and YOLO are conversions of the same annotations, so agreement is provenance evidence rather than independent clinical validation. The prior 17-image LabelMe/YOLO audit remains source evidence only and was not rerun or renamed as an independent cohort.

The exact checkpoint SHA-256 remains `7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d`. Fresh metadata still declares `0=d,1=D` and `yolo_split/data.yaml`, YOLO11m, size 1280, batch 32. The broad annotation agreement contradicts that declared source-name contract, but no model score or visual interpretation was used to assign a disease meaning.

## Exact remaining documentary and professional gaps

The [original data descriptor](https://www.nature.com/articles/s41597-025-05647-9) defines the published `d`/`D` terms, identifies LabelMe as the annotation source and describes Python conversion to other formats. Its Code availability section states: “These codes were intended for internal use only and are not publicly available.” The inspected Zenodo inventory and pinned source tree provide converted annotations and split/training code, but no original conversion script revision, immutable export class-order contract or conversion log tied to the artifact was recovered. This is a precise provenance gap, not evidence that a guessed inverse binding is approved.

The owner/source authors must provide the original converter/version and explicit class-order specification; identify the complete immutable training export bound to this checkpoint; resolve the two geometry discrepancies and unlabeled-background records; and provide qualified clinical/source adjudication approving any corrected class definition. A signed or otherwise attributable approval must distinguish source-term meaning from observed visual findings, disease confirmation, ICD-10 subtypes and FDI tooth numbering. No messages to source authors were sent and no approval was invented.

RF-DETR's previous missing exact export/modality/class-order evidence remains unresolved. This YOLO source audit cannot supply RF-DETR labels. Both runtime label contracts remain `UNVERIFIED`, with no clinical finding or ICD-10 bindings enabled. Fix the reference contract before deciding whether training is needed.

## Reproduce without downloading images

Use a fresh private directory and disable Git LFS even if this host lacks `git-lfs`:

```sh
GIT_LFS_SKIP_SMUDGE=1 git clone --filter=blob:none --no-checkout --depth 6 \
  https://github.com/slaks37/dental_study.git /tmp/sonri-phase3-annotation-source

git -C /tmp/sonri-phase3-annotation-source fetch --depth 6 origin \
  f02596a0227b9eaf767b955cd67196236111a3d5

git -C /tmp/sonri-phase3-annotation-source sparse-checkout init --cone
git -C /tmp/sonri-phase3-annotation-source sparse-checkout set \
  Dataset/Annotations/Darknet_YOLO Dataset/Annotations/MS_coco yolo_split/labels

git -C /tmp/sonri-phase3-annotation-source \
  -c filter.lfs.process= -c filter.lfs.required=false \
  -c filter.lfs.smudge= -c filter.lfs.clean= \
  checkout --detach f02596a0227b9eaf767b955cd67196236111a3d5

services/inference/.venv/bin/python services/evaluation/trace_label_provenance.py \
  --source-root /tmp/sonri-phase3-annotation-source \
  --checkpoint /secure/models/daath-best.pt \
  --output /tmp/phase3-label-provenance.json

services/inference/.venv/bin/python -m pytest \
  services/evaluation/tests/test_label_provenance.py -q
```

The optional checkpoint argument uses the existing inert metadata inspector; it performs no tensor/model execution. The tracer itself makes no network request, refuses a different source commit or locally modified annotations/configuration, reads text only and emits no patient filenames. Six synthetic tests verify class-name ID locality, byte provenance, ambiguous stems, missing annotation handling, malformed data rejection and preservation of the `UNVERIFIED` gate; they are software checks, not new real-image evaluation results.
