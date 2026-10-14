# Observable oral annotation guidelines

Annotate visible cavitation, enamel opacity, discoloration, possible calculus, gingival inflammation/recession, ulcers, swelling, mucosal patches, tooth wear/fracture, visible missing-tooth region, tongue appearance or uncertain lesion. These are observations, not definitive diseases.

Use normalized 0–1000 bounding boxes or polygons against the correctly oriented image. Boxes must have positive extent and remain in bounds. Identify image index/hash and anonymous patient group. Record uncertainty and occlusion. Never fabricate boxes for unseen structures.

FDI is nullable. Require known orientation, anatomical context and appropriate primary/permanent/mixed dentition before numbering. Do not guess tooth number from a cropped image or apply adult quadrants to primary teeth. The UI uses a local image canvas; each save is versioned and independently reviewed.

Do not infer caries depth, pulp vitality, periodontitis stage, periapical pathology, cancer or systemic disease from a single photo. Those need clinical examination and, where appropriate, further tests. Uncertain lesions remain uncertain and are referred for examination.
