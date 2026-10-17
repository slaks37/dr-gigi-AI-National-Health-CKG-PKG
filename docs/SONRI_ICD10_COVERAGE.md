# SONRI Icd10 Coverage

Updated 2026-10-16. Research implementation; no clinical or production approval.

The existing catalog contains 124 entries, covering the fifteen K00–K14 categories plus selected subcodes. Existing source/version metadata is retained; official titles were not replaced with inferred titles. `terminology/coverage.ts` derives a per-code capability matrix and `npm run vision:coverage -- /private/path/coverage.json` exports it. Model Lab exposes the same matrix.

Terminology is not diagnosis capability. Clinical review remains PENDING for all entries. Inclusion/exclusion rules remain REFERENCE_REQUIRED. All entries support recording clinician evidence; radiography support means clinician interpretation, never photo-model interpretation. K02.9 has a deterministic candidate rule based on supported cavitation; no code has an evaluated clinical visual model in this application. Symptom workflows span all modules but are not represented as condition-specific validated questionnaires.

[WHO ICD-10 2019 source](https://icd.who.int/browse10/2019/en#/K00-K14). Catalog source provenance predates this run and remains subject to full independent coding review. Missing: verified injury/infection/neoplasm categories outside K00–K14 and complete inclusion/exclusion/differential evidence requirements. These were not invented or auto-normalized. Existing confirmation gate accepts only supported specific WHO subcodes; broad categories cannot be confirmed as diagnosis codes.

See `SONRI_ICD10_COVERAGE.json` for all rows.
