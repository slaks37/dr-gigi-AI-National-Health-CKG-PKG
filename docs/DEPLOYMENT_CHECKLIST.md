# Release and operator checklist

This branch is a draft review candidate. No production deployment or rules publication is authorized by passing tests alone.

- Review/merge the prerequisite security repair, then this stacked implementation; verify hosted CI on the exact candidate commit.
- Provision a staging Firebase project with managed Admin identity; reconcile legacy roles/records and named database configuration. Keep emulator variables out of production.
- Verify professional credentials out of band before trusted doctor + clinicalReviewer claims. Assign independent clinicians explicitly; grant SONRI datasetScopes only to authorized qualified reviewers.
- Approve clinical rules, thresholds, pediatric flow, ICD edition/inclusion-exclusion and coding gates with recorded clinical references. Never toggle approval just to bypass UI gates.
- Record documentary dataset permission/licensing scope and retention; deidentify authorized copies; establish withdrawals, patient groups, duplicate/quality audits and independent annotations.
- Validate private storage, access audit, backups, deletion, quotas, worker resource limits, recovery and codec licensing obligations on the target runtime. Do not expose tokens through public env variables.
- Run authenticated staging owner/clinician/annotation workflows using synthetic data, including conflicts, revoked roles, emergencies and error persistence. Confirm preview output and source-image nonretention.
- Prepare a frozen reviewed cohort; train/evaluate only after label and permission gates. Review weights/license, external test metrics, calibration and prospective validation before installing a detector.
- Keep SATUSEHAT, devices and clinical model providers gated until separate official-profile/sandbox validation. Obtain explicit deployment approval with rollback plan.

Developer checks do not grant clinical, legal or production approval.

## Neon research CPU, 2026-10-16

The isolated Neon function now runs the exported owner checkpoint with synthetic decoded parity verified. Model Lab can explicitly select cloud with separate image-transfer consent. This does not enable clinical screening, establish label mapping, migrate patient storage or deploy the application to production. See [research runtime and evidence](../research/neon-vision/README.md).

## Browser AI research update — 2026-10-17

Real ONNX inference now runs in the administrator Browser AI panel using a dedicated Web Worker, explicit WebGPU/WASM selection, owner-selected local model and verified optional model cache. Synthetic-only decoded parity passed on desktop Chrome. Five raw slots remain unmapped; no clinical record input or automatic Neon fallback is enabled. Existing local and Neon reference implementations are unchanged.

Current verification: 136 unit/API tests passed (one optional artifact test skipped in the default suite); nine browser smoke tests passed against the newly started local production build. Nine real synthetic inference runs and nine browser fault cases passed separately in the loopback benchmark harness; EXIF/RGB checks and cache reloads passed. TypeScript and production build passed; ESLint has no errors and retains the existing Neon style warning. The build required network access for existing Google Fonts after sandbox DNS failed. Clean installation completed; production dependency audit was clear. Full dependency audit reported seven high-severity development-tool findings in the existing braces/fast-glob/Firebase/ESLint chain; no breaking automated downgrade was applied.

No mobile physical hardware, live Firebase administrator flow on Vercel Preview, private-weight public hosting or clinical evaluation is claimed. Preview acceptance remains pending and no production deployment/merge occurred. Read [the complete browser runtime report](../research/browser-vision/README.md) and its measured evidence.
