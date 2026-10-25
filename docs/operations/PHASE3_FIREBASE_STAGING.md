# Phase 3 Firebase staging candidate — 25 October 2026

**Operational hosted staging remains BLOCKED.** The owner confirmed that a separate staging project does not yet exist. No project, billing linkage, Firestore database, identity, rules deployment or hosted case was created by this work. Existing Firebase CLI inventory visibility does not establish Application Default Credentials (ADC), an approved empty project or permission to enable billing. The two existing projects are explicitly rejected by the tooling.

## Concrete offline deliverables

`ops/firebase-staging/stage.mjs` validates a staging plan, renders an explicit named-database configuration and can bootstrap synthetic identities only after an explicit `--apply` and completed owner approval fields. `hosted-acceptance.mjs` provides the actual API acceptance client. Fourteen synthetic guard tests pass; these are local software tests, not hosted Firebase/clinical evidence.

The [plan template](../../ops/firebase-staging/plan.template.json) deliberately has `owner_approved:false` and `empty_project_approved:false`, placeholder public SDK configuration and no selected region. Approval fields record operator attestations; editing JSON is not proof of real owner, legal or clinical approval. Use only the actual owner-authorized project/origin/database/region after they are established. Neither `project-96303d5e-7aac-460d-b72` nor `gen-lang-client-0680977640` may be reused. `demo-*` projects, emulator environment variables, mismatched runtime project identifiers and unsupported public-config fields fail closed.

The current application consumes build-time `NEXT_PUBLIC_SONRI_ENVIRONMENT=research-staging` plus `NEXT_PUBLIC_SONRI_FIREBASE_CONFIG` JSON. Runtime must match `SONRI_ENVIRONMENT=research-staging`, `GCLOUD_PROJECT` and `FIRESTORE_DATABASE_ID`. Public Firebase SDK configuration is not an Admin credential. Keep the existing protected research Preview and its safety gate enabled; its origin is not a substitute for this separate staging deployment.

## Exact prerequisites before apply

The owner must approve a new, separate empty Firebase/GCP project ID, a Firestore Native database ID/location, protected application origin, cost/billing scope and an attributable approval reference/date. Provisioning and billing activation are outside this candidate. An operator then needs:

- A registered staging Firebase Web App with its actual public SDK configuration, email/password Auth enabled solely for the synthetic acceptance accounts, and the approved application's domain configured.
- Exactly the approved Firestore database in the approved region, with no collections or prior patient data. Rules/index configuration is rendered for that named database; no rules are published automatically.
- Short-lived ADC through an authorized operator login or workload federation. No long-lived service-account private key is accepted. Credential/config/token files must stay outside every Git checkout (including worktree `.git` file ancestors) in a `0700` parent directory with `0600` file permissions.
- Operator permissions to read the Web App configuration, list/get Firestore databases, list collection IDs, list/create/update Firebase Auth users and set synthetic claims. Grant only this approved staging scope; the scripts do not grant IAM roles or modify billing.
- A separately deployed research-staging application with scoped runtime identity, private inference URL/auth configuration and successful worker inventory access. Missing protected-deployment access, Firebase ADC or worker configuration remains a blocker.

The bootstrap first uses provider GET requests to compare the actual Web App configuration and exact database/project/region against the approved plan. It checks the complete small Auth inventory and empty Firestore collection inventory. Any non-synthetic user, unmarked prefix account, additional database, region mismatch, incomplete Auth listing or nonempty database aborts before account creation. The only permitted preexisting Auth identities carry the plan's synthetic prefix and `syntheticResearchIdentity:true`; no existing identity is overwritten. Auth inventory checks apply to this bootstrap action and are not inferred from the application's declared `synthetic_accounts_only` flag.

Five random-password accounts are created: patient, outsider patient, qualified-role doctor fixture, unqualified-role doctor fixture and administrator. The privileged doctor claim is expressly a research workflow fixture, not professional credential verification. Passwords are persisted privately before the first user write; partial failure attempts to disable only accounts created by that invocation. The script never deletes or sweeps provider data. Reruns with existing UIDs fail without overwriting them; use a reviewed new synthetic prefix or an explicit operator recovery procedure.

## Offline preflight and rendering

From the repository root:

```sh
node ops/firebase-staging/stage.mjs --plan ops/firebase-staging/plan.template.json
node ops/firebase-staging/hosted-acceptance.mjs --plan ops/firebase-staging/plan.template.json
node --test ops/firebase-staging/guards.test.mjs

# After replacing placeholders with owner-approved public configuration:
node ops/firebase-staging/stage.mjs --plan /secure/private/staging-plan.json \
  --render /secure/private/rendered-firebase-staging
```

The renderer produces `build-env.json`, `runtime-env.json`, `firebase.json`, current Firestore rules and an empty index candidate for the approved database. Environment maps are JSON for operator deployment tooling; do not shell-source them. Renderer output is exclusively created and never overwritten. Review the rules and index candidate before any separately authorized deployment. No production database export, clone, emulator repointing or patient migration is part of this flow.

## Explicit synthetic bootstrap and hosted acceptance

Only after actual infrastructure/approval/ADC exist:

```sh
node ops/firebase-staging/stage.mjs --plan /secure/private/staging-plan.json \
  --apply --accounts-output /secure/private/synthetic-accounts.json

node ops/firebase-staging/hosted-acceptance.mjs \
  --plan /secure/private/staging-plan.json \
  --accounts /secure/private/synthetic-accounts.json \
  --apply --report /secure/private/hosted-api-evidence.json
```

Auth bootstrap is provider-scoped and does not require an already-created application administrator. The hosted client signs in the bootstrap identities with Firebase's REST endpoint, checks the token's project/UID/synthetic-role contract, and then calls administrator-only `GET /api/staging-readiness`. **No application case mutation happens until** that response matches the approved project ID and database ID, `environment:research-staging`, `clinical_use:PROHIBITED`, `synthetic_accounts_only:true`, `source_images_retained:false`, and private worker inventory structure. A different deployment, research Preview, redirect or incomplete readiness response aborts. Server-side signature/revocation checks remain authoritative; client token-claim checks do not replace them.

Optional Vercel Deployment Protection access is read from `--protection-token-file /secure/private/protection-token`; the client does not remove protection. Requests stay on the approved HTTPS origin, refuse redirects and never print passwords, Firebase ID tokens, provider credentials, response bodies or protection tokens.

The client exercises anonymous/other-patient/unassigned/unqualified denial; processing and exam consent; patient case creation and idempotent retry; administrator assignment; odontogram persistence; stale-version conflict handling; synthetic doctor review; invalid-token denial followed by a valid durable read; report safety/odontogram content; and expected audit actions. The synthetic `K02.9` review exercises storage/authorization only and cannot establish model capability, clinical validation or full ICD-10 evidence coverage.

Worker authorization and synthetic-attestation negative checks are included. Actual positive worker execution is optional and otherwise explicitly recorded `NOT_RUN_SYNTHETIC_FIXTURE_REQUIRED`. Supply `--synthetic-fixture` plus `--model-id` to test it. The file must match the existing deterministic 704×704 geometric fixture SHA-256 `2fd5e924a70199af7eafe3892c09b2dc92bfa8e5251439a0816d2307b7e32445`; arbitrary images are rejected before any request. Generate it locally with the existing `synthetic_fixture()` helper in `services/inference/smoke_pretrained.py`, save outside Git with mode `0600`, and keep clinical use prohibited.

An API workflow result never claims that browser acceptance, provider outages, process restart, backup/restore, clinical review or operational staging acceptance passed. The result explicitly leaves those fields false. The client performs no outage injection or destructive restore. Those need the approved operational host, protected browser access, recovery configuration and a reviewed maintenance window; the separate container/workload tests do not prove hosted Firebase recovery.

## Evidence and current blockers

Actual executions in this scope: offline preflight, offline acceptance-plan output, renderer guard tests, refusal of wrong deployed readiness before any application POST, fixed-project/region/credential/privacy guards, and JavaScript syntax/lint checks. No Firebase bootstrap `--apply`, hosted API workflow, browser test, cloud deployment or Firestore restore was run. No hosted result JSON is fabricated.

The next concrete owner inputs are the approved empty project/database/region/cost scope and protected origin, actual Web App configuration, scoped ADC/workload access and private worker deployment. The absence of those inputs leaves apply and hosted acceptance blocked while the executable candidate remains reviewable.

Primary API references: [Firebase Admin setup and ADC](https://firebase.google.com/docs/admin/setup), [Admin user management](https://firebase.google.com/docs/auth/admin/manage-users), [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth), and [Firestore database management and region selection](https://cloud.google.com/firestore/docs/manage-databases). Provider capabilities described here are requirements; they are not evidence that this project's infrastructure has been provisioned.
