# AI clinical validation — REQUIRES_REVIEW

## Current behavior

Clinical photo/video analysis and AI consultation return 503 REQUIRES_REVIEW after authentication. Agnes is a retired, server-only, fail-closed adapter. There is no environment-variable bypass. No model request, speculative model retry, fabricated result or clinical confidence is generated.

Dental display helpers define INVALID_IMAGE, LOW_QUALITY, NO_TEETH_VISIBLE, REVIEW_REQUIRED, NO_VISIBLE_FINDINGS, FINDINGS_PRESENT and PROCESSING_ERROR. Missing/malformed/non-dental output cannot qualify for the cautious NO_VISIBLE_FINDINGS message. Empty findings do not establish dental health. These helpers are defensive presentation logic, not a validated image-quality classifier.

Unvalidated rPPG, disease-risk predictions and spinal overlays are disabled. No simulated waveform, Cobb angle or hardcoded vital signs is represented as measured. Photo height/weight autofill is disabled. Legacy anthropometry output defaults are removed; any manual BMI display identifies manually entered values and requires positive height and weight. Pediatric Z-score visualization remains disabled.

New stored notes are draft/user-entered, with server creator/time/version and no calibrated confidence. Feedback does not approve a diagnosis. SATUSEHAT preview rejects estimated/simulated values and diagnosis-code fields. There is no approved clinical review/diagnosis-signoff workflow yet.

## BLOCKED acceptance items

- Labeled oral-image dataset, blur/brightness/oral-region quality gate and measured localization benchmark.
- Server-controlled clinical protocol, shared strict provider response schemas and independent qualified-clinician review.
- Validated anthropometric reference implementation and prerequisites for pediatric Z-scores.
- Real rPPG acquisition/processing, physiological benchmarks and device validation.
- Versioned, clinician/coder-reviewed ICD-10 mapping table. Legacy generic K02.2 usage was removed from disabled prompts; no replacement definitive code is inferred.
- Approved provider model/account, per-attempt/total deadline, cancellation, appropriate transient retry, shared quotas and data-processing governance.
- Secure source-image storage/lifecycle and audited draft/reviewed/approved/rejected workflow.

These items must be implemented and validated before any clinical route can be enabled. This PR establishes a safe restricted application, not clinical production readiness.

## Source verification

The current official [Gemini model catalogue](https://ai.google.dev/gemini-api/docs/models) was inspected on 14 October 2026. Listed model existence does not prove account entitlement or medical validity. No provider account request was executed. The [WHO ICD-10 browser](https://icd.who.int/browse10/2019/en) is the reference entry point for the future reviewed terminology table; this run did not obtain a complete reviewed mapping.
