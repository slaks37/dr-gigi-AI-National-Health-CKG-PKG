# Dataset consent and privacy

The user states that SONRI patient permissions and dataset licensing were verified and evidence is available. This is recorded as **USER_ATTESTED_VERIFIED**. The title/number/date of that evidence, per-file applicability, training scope and retention period have not been supplied; they are not invented by the implementation or treated as documentary proof.

Engineering metadata discovery was read only. No patient image bytes were downloaded, sent to a model provider, committed or trained. Folder/file personal names are excluded from public artifacts. Source IDs remain in a private 0600 inventory within a 0700 directory outside the repository.

For training eligibility, an authorized operator must link a permission evidence reference and document scope for each applicable data group, then mark DOCUMENTED_VERIFIED and TRAINING_APPROVED. A revoked/prohibited/unknown permission blocks training. Consent claims cannot substitute for clinical annotation review or patient-level leakage prevention.

Production requires an approved retention schedule, withdrawal/deletion process, access audit, encryption/backups, secure authorized storage and reviewer credential verification. No default legal retention period is guessed. The current annotation UI accepts a locally authorized file only after its SHA matches imported metadata; it does not automatically expose Drive patient images.
