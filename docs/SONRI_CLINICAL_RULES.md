# SONRI Clinical Rules

Updated 2026-10-16. Research implementation; no clinical or production approval.

Existing emergency and urgency triage remains `triage-research-1` and executes before decoding/inference. Reasoning version `oral-rules-research-2` adds structural observation reasoning without assigning disease codes. Existing symptom, gingival, mucosal, tongue, caries and pediatric rules are reused; all require clinical review.

Evidence layers remain separate: observed findings, unconfirmed clinical suspicion, required examinations and authorized clinician confirmation. Only a verified assigned independent dentist may confirm stored diagnoses with examination evidence. New structured measurements/interpretations must match the performed-exam flags; mismatches fail before persistence. These fields are persisted with existing optimistic version checking and audit review history. Radiographic interpretation does not become an AI prediction or automatic diagnosis.

Structured evidence is optional for legacy records, and a draft does not confirm disease. Raw research labels cannot be submitted as validated detector findings or override deterministic triage. Confirming clinical rules, referral thresholds, structured evidence interpretation, external ICD coverage, local regulatory workflow and clinical approval remains outstanding.
