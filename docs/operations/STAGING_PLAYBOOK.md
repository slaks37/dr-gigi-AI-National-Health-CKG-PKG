# Local and staging operations

This branch packages the existing Next.js/Firebase application and a separate FastAPI research service. Firestore remains authoritative. No production database migration, credential provisioning, patient-data transfer, clinical model promotion or production deployment is performed by these files.

## Application routes and identities

Start at `/sonri`, then `/login` with an account provisioned for the approved Firebase environment. Patients use `/checkup` or `/checkup-anak` and view their accessible history at `/examinations`. Administrators assign a verified clinician in `/clinical-review`; the assigned doctor records the examination and FDI odontogram, supplies evidence and confirms only a supported terminal WHO code. The report downloads as escaped HTML that can be printed to PDF. `/model-lab` is restricted to administrators and synthetic-image research; it is separate from clinical screening and does not promote raw labels into diagnoses. CBCT selection reports its unavailable state; web volume upload is disabled.

Roles come from Firebase Admin trusted claims. A clinician also needs `clinicalReviewer: true` and a case assignment. Grant claims only after professional/operator verification; the app does not verify a professional license itself. The existing Firestore database remains the system of record. Do not substitute the earlier supporting prototypes' browser storage or in-memory database fallbacks.

## Current hosted blocker

The existing Vercel project `sonri-browser-ai-research` is reserved for the research Preview. Configure `SONRI_RESEARCH_PREVIEW=1` there: authenticated account/clinical-storage API workflows fail closed, so a working public page does not establish a connected patient workflow. Do not clear that guard merely to make a demonstration appear complete. Full hosted staging identity, Firebase Admin/database, private inference and model mounts are not configured and have not passed hosted acceptance. Docker is absent on this execution host, so the supplied container build is unexecuted here. Independent clinical performance benchmarks have not run. These are separate gates from local emulator success and real model execution on synthetic images.

## Local verification

Prerequisites: Node 22–24, npm, Python 3.12, Java 21 for the Firestore emulator. Install dependencies in the repository, then run:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run test:rules
npm run build
npx playwright install chromium
npm run test:e2e
# Run last: starts isolated Auth + Firestore emulators and a separate Next build directory.
npm run test:workflow
```

`test:rules` starts the Firestore emulator against the `demo-drgigi-repair` project with synthetic fixtures. The configured emulator port is 8088. Vitest clinical integration tests stub identity verification and use synthetic accounts; they exercise persistence, role/owner boundaries, revisions and reports, and do not prove the live identity provider. Never point these tests at a real Firestore project. The separate `test:workflow` command uses `firebase.workflow-test.json` to start Auth on 127.0.0.1:9098 and Firestore on 127.0.0.1:8088 in `demo-sonri-workflow`. Playwright starts Next on 127.0.0.1:3012 with explicit nonproduction emulator flags and `.next-workflow` output. It creates synthetic patient, administrator and qualified-clinician identities with trusted emulator claims, then tests browser login, screening, assignment, odontogram/examination, clinician confirmation and report retrieval. It clears only its guarded synthetic emulator collections. Run it after the production-build smoke tests and do not run both Firestore emulator commands concurrently on port 8088. Successful emulator authentication does not establish hosted OAuth/provider configuration; the authenticated hosted workflow requires separate evidence.

The inference service can be checked independently:

```sh
cd services/inference
python3.12 -m venv .venv
.venv/bin/python -m pip install -c constraints.lock.txt -r requirements-test.txt
.venv/bin/python -m pytest -q
```

Optional ONNX dependencies are isolated in `requirements-onnx.txt`. The default registry disables every model. No ordinary unit test downloads a checkpoint or patient image. Real-checkpoint tests require an explicitly provided existing artifact and must record its SHA-256, dependency versions and synthetic-input limitations.

## Container candidate

Prerequisites: Docker Engine and Compose v2. The application Dockerfile uses Next standalone output and ships neither Python dependencies nor checkpoints. The inference image is built from its own directory. `.dockerignore` excludes secrets, private data and model formats from the app build context. Release operators should resolve the Node/Python image tags to reviewed immutable digests before promoting the candidate; the supplied tags receive upstream updates and are not immutable release identifiers.

Set `SONRI_INFERENCE_TOKEN` to a random secret of at least 32 characters through a private environment/secret manager. Use a different value for each environment and retain it only on the app server and inference worker. The Next.js environment variable is `SONRI_INFERENCE_TOKEN`; Compose passes the same secret to the Python variable `INFERENCE_API_TOKEN`. Neither is a browser variable.

```sh
# SONRI_INFERENCE_TOKEN must already be exported securely.
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

| Process | Exact environment | Purpose |
| --- | --- | --- |
| Next.js app | `SONRI_INFERENCE_URL=http://inference:8000` | Private Compose service address; use a reviewed HTTPS address outside Compose |
| Next.js app | `SONRI_INFERENCE_TOKEN` | Server-side bearer secret; never `NEXT_PUBLIC_*` |
| Python worker | `INFERENCE_API_TOKEN` | Same secret; protected routes fail closed below 32 characters |
| Python worker | `SONRI_MODEL_REGISTRY=/config/registry.json` | Read-only operator-reviewed manifest; not `SONRI_MODEL_MANIFEST` |
| Python worker | `SONRI_MODEL_ROOT=/models` | Read-only artifact root with pinned hashes |
| Research Preview | `SONRI_RESEARCH_PREVIEW=1` | Disables protected account/clinical-storage APIs; not operational staging |

The browser entry is `http://127.0.0.1:3000`. The app accesses `http://inference:8000` on an internal Compose network. The inference service has no public port or outbound network and receives a disabled registry plus an empty read-only model volume by default. It returns explicit unavailable states. A healthy HTTP endpoint confirms process liveness, not model availability, Firebase connectivity or patient-workflow acceptance.

Firebase's browser project is read from the existing tracked configuration. Set `GCLOUD_PROJECT` and `FIRESTORE_DATABASE_ID` consistently if overriding it. Container identity must receive Firebase Admin Application Default Credentials. For an authorized local/staging account, use a private Compose override to bind a service-account file read-only at `/run/secrets/firebase-admin.json` and set `GOOGLE_APPLICATION_CREDENTIALS` to that container path. Never place the file in source, the Docker image, build arguments or `NEXT_PUBLIC_*`. Prefer workload identity on hosting. No Admin credentials are included; protected persistence fails closed until valid environment identity exists.

For research model installation, create a private override that replaces the registry mount and mounts the authorized model directory at `/models:ro`. Keep the checkpoint outside Git and build contexts. Require the exact artifact hash, modality, code/model/data rights, explicit research opt-in and trusted checkpoint attestation. Patient-use approval is a separate gate. All raw class names remain unverified until reviewed metadata tied to the exact checkpoint establishes their semantics. Never enable CBCT by mounting arbitrary weights; it requires the complete verified ToothSeg bundle and a compatible authorized volume.

The containers run without root, drop capabilities, use a read-only filesystem with bounded temporary storage, and have memory ceilings. Inference runs as one worker. An HTTP timeout does not terminate native inference; the worker retains capacity while native work runs. Hosting must supply process supervision/hard deadlines and a restart strategy for hung jobs. Validate realistic concurrency and memory before accepting a staging capacity target.

## Staging acceptance

Provision an isolated Firebase staging project, permitted identity-provider settings and synthetic accounts with trusted role claims. Use a distinct inference token and approved model storage. Restrict access with the host's TLS/auth/network controls. Configure no patient traffic. Verify the complete flow: login, patient registration/consent, upload quality checks, research/unavailable model output, clinical examination, correct FDI orientation, evidence-linked candidates, independently assigned qualified clinician review, version conflicts, report/history and audit retrieval. Test cross-patient and role-denial behavior. Verify SATUSEHAT remains disabled unless permitted sandbox credentials and successful mapping/submission evidence exist.

Record the exact application commit, image digests, dependency lock hash, registry/checkpoint hashes, terminology version, nonsecret configuration references, smoke outputs and test evidence. Never store raw patient images, identification data, tokens or service-account JSON in logs or CI artifacts. No clinical performance metric can be inferred from synthetic acceptance.

## Observability, rollback and recovery

Inference logs allowlisted request IDs, route, status and latency; do not add upload bytes, filenames, EXIF, patient IDs or tokens. Monitor authentication errors, unavailable models, worker queue/capacity, timeouts, memory, response latency, Firestore failures and clinical review backlog. Alert destinations require operator configuration; no live monitoring system is claimed by this playbook.

Rollback the app and worker together to previously accepted image digests and the corresponding registry/terminology version. Disabling a model and restarting the worker is the immediate response to an artifact, licensing or output concern. In-flight drafts require explicit review; do not rewrite historical model provenance or clinician decisions. This change has no SQL/Firestore schema cutover to reverse.

Before clinical use, the data operator must choose retention/deletion periods, restrict private study storage, configure encrypted backup/export destinations, schedule Firestore backups, and execute a synthetic restore rehearsal in an isolated project. Check image/study references, consent, encounter revisions and audit continuity after restore. No backup schedule or restore has been executed here.

## Capacity and release status

Keep ML workers separate from the Next serverless deployment. The current ONNX research worker is CPU-oriented; CBCT and future GPU adapters require dedicated workers with appropriate GPU memory, storage and voxel limits. Costs depend on worker uptime, CPU/GPU memory, model storage, Firestore usage, backups and network traffic. No infrastructure purchase, quota increase or paid training is authorized by these files.

Docker commands above are operator instructions until executed on a host with Docker. Passing local software tests is separate from a successful container build, hosted staging acceptance, independent clinical validation, regulatory/privacy review and authorized production release. The CI workflow adds Python boundary tests and Compose structural validation; a workflow file is not evidence that a remote run passed.
