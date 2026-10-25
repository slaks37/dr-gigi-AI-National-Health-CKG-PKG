# Phase 3 private Cloud Run worker candidate

This candidate is prepared for owner review. No Google Cloud resource, billing account, API enablement, bucket, secret, service-account binding, image upload or Cloud Run deployment has been executed by these scripts. The renderer has no deploy option and never invokes a cloud CLI or API. Existing Compose behavior and the protected Vercel research Preview are preserved. Clinical use remains prohibited.

## Reviewable files and local checks

`ops/cloud-run/render.py` accepts only explicit nonsecret configuration keys, emits a Cloud Run service JSON document (JSON is a YAML subset) and a separate review plan, and rejects plaintext secret fields, mutable image tags, unpinned secret versions, merged caller/worker identities and unsupported worker profiles. `ops/cloud-run/staging.example.json` is a template; its image digest must be replaced by an actually built and reviewed artifact. It intentionally cannot render unchanged. Generated files and private `*.local.json` configurations are ignored by Git.

```sh
PYTHONPYCACHEPREFIX=/tmp/sonri-cloud-run-pycache python3 -m unittest discover -s ops/cloud-run -p 'test_*.py' -v
python3 ops/cloud-run/costs.py
# First replace the template's project, service-account and image references.
python3 ops/cloud-run/render.py --config ops/cloud-run/staging.local.json --output ops/cloud-run/generated/review
# On an approved Docker host; builds/executes a local image, not a Cloud Run deployment:
bash ops/cloud-run/smoke.sh
```

The unit checks cover invalid credentials/configuration boundaries, immutable references, read-only model mount requirements, port handling and regional free-credit arithmetic. The Docker smoke starts the same Cloud Run image twice, on ports 8080 and 8091, with no external network or published host port. It checks nonroot execution, liveness, missing-token denial, authenticated inventory and every model unavailable. Its artifact is `ops/cloud-run/generated/port-contract.ndjson`. The first record links the actual Docker image ID to the actual checkout SHA, requested branch-head SHA and GitHub event SHA. Pull-request checkouts may test a merge commit; the fields retain that distinction. A dirty-worktree flag prevents treating a modified local build as an exact committed-source build. A passed port test does not establish Google IAM, WIF, managed secret access, a model mount, model inference or hosted staging success.

## Fixed initial operating envelope

| Setting | ONNX default | Optional YOLO CPU |
| --- | --- | --- |
| Build target | `onnx-cpu` | `yolo-cpu` |
| CPU / memory | 1 vCPU / 2 GiB | 2 vCPU / 4 GiB |
| Min / max service instances | 0 / 1 | 0 / 1 |
| Container request concurrency | 1 | 1 |
| Request timeout | 120 seconds | 120 seconds |
| HTTP port | `$PORT`, default 8080 | `$PORT`, default 8080 |
| Worker process count | 1 | 1 |
| Billing | Request-based, startup CPU boost disabled | Same |
| Models enabled in image | None | None |

The default Docker target is deliberately ONNX. YOLO must be selected explicitly and its configuration requires an operator license-review reference. The optional image installs CPU PyTorch wheels and has no GPU request. Building either image does not train a model. Existing `services/inference/Dockerfile` remains the Compose worker on port 8000; the new entrypoint is isolated in `services/inference/cloud_run_entrypoint.py`. For manual local builds use `docker build --file ops/cloud-run/Dockerfile --target onnx-cpu --tag sonri-inference-cloud-run:local services/inference`.

The manifest uses current service-level scaling annotations; it does not rely on legacy revision-level minimum-instance configuration. Cloud Run's maximum is a scaling control and can briefly be exceeded during exceptional scaling/replacement behavior. It is not a billing ceiling. Request billing also charges startup and graceful shutdown time. Liveness/startup probes use the existing `/healthz`, which proves only process liveness. These contracts follow [Cloud Run container configuration](https://docs.cloud.google.com/run/docs/configuring/services/containers), [request billing](https://docs.cloud.google.com/run/docs/configuring/billing-settings), [minimum instances](https://docs.cloud.google.com/run/docs/configuring/min-instances), [maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances) and [health checks](https://docs.cloud.google.com/run/docs/configuring/healthchecks).

The current Python inference boundary has an engineering timeout of 90 seconds. An HTTP timeout does not terminate a running native thread. The existing capacity guard retains its single slot while work actually runs. Request-based CPU can be throttled after a response; do not use this as background-job hosting. Before enabling any checkpoint, separately test actual cold-start time, peak memory, single-job duration, cancellation/hung-native-work recovery and safe process replacement. The disabled-model container acceptance does not establish these properties.

## Two authentication layers

The receiving service keeps the Cloud Run Invoker IAM check explicitly enabled. Bind `roles/run.invoker` only on the dedicated worker service for the staging app's caller service account. The worker runtime identity is different and receives only the approved secret/model-read permissions. Never add `allUsers` or `allAuthenticatedUsers`; audit inherited/project-wide invoker permissions as well as service bindings. The renderer records intended IAM requirements but makes no IAM mutation. [Cloud Run documents the IAM check separately from application authentication](https://docs.cloud.google.com/run/docs/authenticating/public).

The server request must send both headers:

```text
Authorization: Bearer <environment-specific worker shared secret>
X-Serverless-Authorization: Bearer <short-lived Google-signed ID token>
```

The first is checked by the existing FastAPI boundary. The second is checked by Cloud Run; its `aud` must equal the canonical receiving HTTPS `*.run.app` service root. A Firebase user ID token, OAuth access token or worker shared secret cannot replace the Google service ID token. When both headers are present the platform checks `X-Serverless-Authorization`, leaving application `Authorization` available to the worker. See [official service-to-service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).

The application adapter uses server-only configuration:

| Variable | Intended setting |
| --- | --- |
| `SONRI_INFERENCE_URL` | Canonical worker HTTPS service origin |
| `SONRI_INFERENCE_TOKEN` | Environment-specific secret; equals worker `INFERENCE_API_TOKEN`; at least 32 characters |
| `SONRI_INFERENCE_AUTH_MODE` | `GOOGLE_ADC` on a trusted Google workload, or `VERCEL_WIF` for a reviewed external Vercel workload; default `NONE` is only the existing shared-token/private Compose contract |
| `SONRI_INFERENCE_AUDIENCE` | Exact canonical HTTPS `*.run.app` root, matching the inference URL origin |
| `SONRI_GCP_WIF_PROVIDER` | For WIF: full `projects/NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` resource |
| `SONRI_GCP_CALLER_SERVICE_ACCOUNT` | For WIF: approved caller service-account email |

For Google ADC, attach the intended caller identity to the application workload. For external Vercel invocation, the owner must provision a restricted workload identity federation provider with issuer/audience and exact organization/project/environment subject restrictions, and permit only that principal to impersonate the caller account for short-lived ID tokens. A broad provider condition or repository-name-only trust is insufficient evidence. The WIF configuration and an actual hosted token exchange must be tested after approval; mocked adapter checks cannot establish live federation.

The candidate uses ingress `all` because an external authenticated app needs to reach the HTTPS endpoint. This makes the endpoint internet-routable **with IAM enforced**, not anonymously invocable. If private-network-only ingress is required, choose and review the compatible application network path first; changing ingress to `internal` without that path will break external callers. No paid load balancer or VPC connector is included.

## Secrets and model files

The renderer accepts a numeric version of a Secret Manager secret for `INFERENCE_API_TOKEN`, never its value. The owner creates/rotates it through a secure channel and grants `roles/secretmanager.secretAccessor` on that secret only to the worker runtime identity. The application stores the same environment-specific value in its own approved server secret store. No secret goes into build arguments, the image, a browser variable, test artifact or command-line output. Keyless workload identity is the preferred caller mechanism.

The image contains only the repository's disabled example registry and an empty `/models`. To add artifacts later, provide all of: private same-region model bucket, version-pinned reviewed registry secret, nonsecret authorization record reference and license-review reference. The renderer mounts the bucket at `/models` through a read-only GCS Fuse volume and the registry secret at `/config/registry.json`; the worker account needs object viewer on that bucket and accessor on the specific registry secret. Use immutable object names, generation-aware source records and the worker's exact SHA-256 checks. Do not assume a mutable bucket path is an immutable checkpoint reference. [Cloud Run documents read-only Cloud Storage mounts](https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts).

Resource sizes are initial candidates. The ONNX image does not make YOLO/PyTorch checkpoints operational, and neither profile makes panoramic/CBCT models operational without their contracts, dependencies, rights, real execution and separate evaluation evidence. Mounting weights never grants clinical approval. Keep class semantics unverified where unresolved.

## Required approval and owner handoff

Before any billable provisioning or deployment, the owner must approve a concrete project ID, region, billing account, expected workload/cost scenario, alert recipients/thresholds, application caller identity/trust policy, worker identity, image digest and secret references. Merely filling `billing_approval_reference` in a local JSON file is not user authorization. This implementation does not perform the final cloud action even when that field is present.

The authorized operator then needs Cloud Run/API/Artifact Registry/Secret Manager availability in that isolated project, a built linux/amd64 digest in the same approved registry, necessary service-account deployment permissions and service-scoped invoker policy. Do not enable billing/APIs or create resources as a troubleshooting side effect. Resolve the owner approval first. Configure no patient traffic, no training, no GPU and no production domain/traffic changes.

After approved provisioning, record the actual deployed service URL/revision/image digest, confirm min0/max1 and request billing, inspect IAM policy, and run these hosted checks: absent ID token denied by platform, wrong/unbound identity denied, mismatched audience denied, valid IAM plus missing/wrong worker token denied, both valid credentials succeed for health/inventory, model states remain truthful, and logs contain no credentials or uploads. Then run the synthetic app/Firebase workflow and recovery acceptance against the separately approved managed staging resources. The existing Vercel research guard remains `1` throughout; operational staging uses a different deployment/project configuration.
