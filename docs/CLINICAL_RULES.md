# Deterministic research rules

Rule version: `triage-research-1`; clinical approval PENDING. YES difficulty breathing/swallowing triggers emergency guidance before images. Facial swelling, pus/drainage, limited opening, swelling with fever or severe reported pain triggers urgent evaluation. Persistent lesion over 21 days prompts examination. Unknown danger answers remain inconclusive. Routine review is not a declaration of health.

Primary references: [NHS dental abscess](https://www.nhs.uk/conditions/dental-abscess/) and [NHS mouth ulcers](https://www.nhs.uk/conditions/mouth-ulcers/). The specific operational thresholds and combinations in this prototype require clinician sign-off and local pathway review; these references do not certify the entire engine.

Nine reasoning families cover visible caries suspicion, enamel change, gingival appearance, periodontal concern, pulpal symptoms, infection concern, oral lesions, tongue appearance and pediatric context. They combine explicit symptoms and supported observed findings. Candidate codes remain separate from confirmed codes. No missing symptom is silently NO. Numeric confidence is not fabricated, and no model fallback generates findings.

Current deterministic explanations disclose missing evidence and examination needs. Versioned rule changes require clinical review and regression tests against emergency, unknown, pediatric, ambiguous and contraindicated cases.
