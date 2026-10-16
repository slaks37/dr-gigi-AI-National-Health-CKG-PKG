# SONRI Dataset Audit

Updated 2026-10-16. Research implementation; no clinical or production approval.

Read-only authorized Drive metadata audit of owner-supplied root, 2026-10-16. Recursive traversal reached 40 descendant folders. Capped 1,000-item listings were supplemented with provider-owned pagination tokens through the final page for both large image folders; IDs were deduplicated. No patient image content was downloaded.

Verified inventory: 3,520 images (3,340 JPEG, 150 HEIF, 30 PNG) and one QuickTime video. Raw patient-identifying filenames were observed; names/IDs are not included in public deliverables.

Root permission currently includes `anyone / writer`. This is a privacy/integrity exposure requiring owner remediation before dataset sharing/training. Sharing permissions were not changed. Inherited/individual permissions were not exhaustively audited.

Weak folder-name hints only (not ground truth): {"CARIES": 29, "PERIODONTAL": 4, "MUCOSA": 2, "STRUCTURE": 2, "CLINICAL": 5, "UNMAPPED": 3478}. Most images sit under unmapped generic dataset folders. Counts do not establish disease labels, positives, negatives, patient identity, or authorized training use. Per finding category, candidate counts remain UNKNOWN pending image/annotation audit. All five modules: verified permission count 0, independently reviewed annotation count 0, independently confirmed patient count UNKNOWN, usable positive/negative counts UNKNOWN, uncertain count UNKNOWN. Zero verified eligible means no eligibility has been established, not proof that no eligible image exists.

Pixel dimensions, corruption, EXIF, perceptual duplication, near duplicates, actual quality, consent/license, annotations and patient grouping were not checked because only metadata was retrieved. Patient-level leakage cannot yet be excluded. All modules remain DATASET_BLOCKED for training/evaluation. Existing local inventory/preparation tools are retained for authorized private processing.
