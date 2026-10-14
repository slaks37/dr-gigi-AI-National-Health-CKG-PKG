# Dataset labeling protocol

Folder names are weak source hints, never verified diagnosis. Use the controlled observable-finding ontology. Record image hash/version, anonymous patient group, geometry, anatomical region, uncertainty, visibility and reviewer provenance. Preserve original labels alongside independent corrected labels.

An author submits an annotation on imported metadata with matching SHA-256. A separate qualified scoped reviewer accepts, corrects, rejects or marks uncertainty. Author/reviewer equality is rejected; approved annotations cannot be silently edited. Any new annotation invalidates image-level independent approval. Mark image review complete only when every image annotation has independent approved review.

Document actual clinical evidence separately from visible appearance. Consensus or adjudication must resolve disagreements; aggregate disagreement reporting is a future operational analysis, not a measured rate in this snapshot. No self-approved folder labels, fabricated annotations or patient-name-derived grouping.

Training preparation requires documented permissions, accepted image quality, complete duplicate audit, patient grouping and independent labels. Reviewers must approve class sufficiency thresholds and provide a reference before a frozen manifest is exported.
