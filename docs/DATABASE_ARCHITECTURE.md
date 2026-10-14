# Database architecture

Firestore remains authoritative. New server-only collections: `clinicalReviews`, `datasetEntries`, `datasetAnnotations`, `datasetLabelReviews`, `screeningQuotas`. `records` contains a versioned top-level `screening` and matching `json_output.screening`. Source bytes, private Drive filenames and access tokens are not stored in screening records.

Screenings are authenticated, owner-scoped, idempotent on canonical normalized request hash and quota limited. An id reused for different content is rejected. Review, assignment and annotation writes use transactions and expected versions; conflicts require reload. Independent clinical reviews retain prior screening and review evidence for audit. Sensitive audit evidence is privileged clinical data, not a public log.

Server roles derive from verified ID token claims. Assigned qualified clinicians may read their cases; administrators may assign independently verified reviewers. Direct browser access to internal review/dataset/quota collections is denied by rules. Legacy record writes reject forged structured confirmation fields. Existing patient profile access remains owner protected.

No SQL migration, production database edit, rule deployment or live credential provisioning was executed. Retention/deletion policies, backups, credential verification, legacy role reconciliation and production migration remain operator decisions in the deployment checklist.
