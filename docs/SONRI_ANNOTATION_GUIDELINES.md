# SONRI Annotation Guidelines

Updated 2026-10-16. Research implementation; no clinical or production approval.

Use observable labels from `FindingLabels`, not disease-folder names or unverified ICD labels. Module 1: cavitation/enamel opacity; module 2: visible gingival changes/calculus; module 3: ulcers/patches/swellings/tongue changes; module 4: wear/fracture/discoloration/missing regions; module 5: clinician examination and modality-specific interpretation.

A dentist must define boundaries, uncertainty, occlusion, location/surface and annotation protocol before labeling. FDI requires known anatomy/orientation/dentition. Never infer depth, attachment loss, pulp status, malignancy or radiographic pathology from photos. Reviewed negatives and difficult false positives require explicit independent review.

CVAT Community self-hosted is an optional MIT annotation reference, not provisioned here. Keep annotations/data private. Export COCO after independently approved labels and frozen patient/duplicate-group splits; verify numeric coordinate transforms and masks against normalized images. Existing `src/dataset` gates and review API are reused. Current preparation path requires approved positive box annotations for every image; an explicit reviewed-negative training/export path is still required before a balanced training cohort can be claimed ready.
