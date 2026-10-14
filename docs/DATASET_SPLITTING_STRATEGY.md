# Frozen dataset split strategy

`src/dataset/split.ts` unions patient groups, exact hashes, duplicate groups and near-duplicate groups transitively before assigning components with a reproducible seeded 70/15/15 split. No patient or duplicate component can cross partitions. Ratios are targets; component sizes affect actual counts.

Exclude files without documented training permission, independent reviewed labels, accepted quality, hashes, patient grouping or duplicate audit. Do not replace unknown patient IDs with random per-image IDs, since that conceals leakage. Perceptual distance is a screening aid, not proof of duplication; reviewers adjudicate near matches.

Freeze dataset, ontology, image hashes, reviewed annotation versions/geometry, reviewer provenance, seed and approval reference in the manifest. Training preparation rejects empty splits and images without independently approved box annotations. Hold out test data from hyperparameter selection. Validate site/time/device subgroups and out-of-distribution behavior before clinical approval.

No real SONRI split has been produced; only synthetic unit fixtures exercise the implementation.
