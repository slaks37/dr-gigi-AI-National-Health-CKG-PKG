# Clinical engine architecture

`src/clinical-engine/types/schema.ts` defines strict schemas for symptoms, quality, observed findings, candidate conditions, triage, provenance, review and screening. Seventeen symptoms are YES/NO/UNKNOWN; missing answers remain UNKNOWN. Unknown danger questions produce insufficient evidence, never a healthy classification.

`core/triage-engine.ts` evaluates danger signs first. `core/image-quality.ts` performs bounded file checks and normalization. `vision/interface.ts` exposes oral-region, tooth and observable-finding adapters; the default adapter explicitly reports UNAVAILABLE. `core/pipeline.ts` binds outputs to the correct image index, validates provenance/geometry, enforces deadlines and invokes `rules/rules.ts`. `core/explanation.ts` explains the structured result without another model.

Observed findings, clinical suspicions and confirmed diagnoses are separate arrays/fields. Research rules cannot populate confirmed diagnoses. Confirmation requires an independent assigned doctor with trusted `clinicalReviewer` claim, verified patient linkage, actual examination evidence, supported terminology and optimistic record version. The credential claim must be provisioned by an operator after professional verification; this repository does not certify anyone's license.

Pediatric nonemergency submissions require an owned child profile and an affirmative guardian declaration. Unlinked pediatric emergencies retain null patient subject rather than incorrectly identifying the account holder as the child. No raw image is retained in the medical record.

All rules remain `clinicalApproval: PENDING`; provenance explicitly reports that clinical rule approval and calibrated confidence are unavailable.
