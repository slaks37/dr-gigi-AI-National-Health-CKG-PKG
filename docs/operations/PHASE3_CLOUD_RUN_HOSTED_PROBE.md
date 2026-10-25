# Read-only hosted Cloud Run boundary probe

`ops/cloud-run/hosted-probe.ts` implements five GET-only boundary checks. `hosted-probe-cli.ts` reuses the application's actual server-only `inferenceHeaders` identity adapter. It makes no deployment, resource, IAM-policy, billing, model-inference, upload or database-write request. Running it against a real service can still incur ordinary request/startup charges, so use it only with the owner's explicitly approved staging origin and access.

No hosted execution was performed while implementing this prober. Its tests use controlled HTTP transport fixtures and label reports `TRANSPORT_FIXTURE`; they cannot establish Google IAM or workload-federation success. A separate Docker port-contract pass is also not hosted IAM evidence.

## Run only after target/access approval

Provide server environment variables through an approved secure channel. Do not paste tokens into shell commands or source. Required values are the canonical worker origin in `SONRI_INFERENCE_URL`, the same exact origin in `SONRI_INFERENCE_AUDIENCE` and `SONRI_CLOUD_RUN_PROBE_APPROVED_ORIGIN`, a nonsecret owner approval-record reference in `SONRI_CLOUD_RUN_PROBE_APPROVAL_REFERENCE`, the server-only `SONRI_INFERENCE_TOKEN`, and `SONRI_INFERENCE_AUTH_MODE=GOOGLE_ADC` or `VERCEL_WIF`. WIF also needs the provider/caller identity variables documented in `PHASE3_CLOUD_RUN_CANDIDATE.md`. Neither a local approval-reference string nor a placeholder URL creates human approval.

Use the canonical HTTPS `*.run.app` service origin with no trailing slash, credentials, path, query, fragment or explicit port. Both current regional and earlier canonical Cloud Run hostname shapes are supported. Custom domains and localhost are rejected. The exact approved-origin equality check prevents changing the target after approval.

```sh
node --conditions=react-server --import tsx ops/cloud-run/hosted-probe-cli.ts
```

`--conditions=react-server` permits the server-only import in this CLI; it does not alter the deployed app. The CLI stores a sanitized report at ignored `ops/cloud-run/generated/hosted-boundary.json`, creates it with mode 0600 and prints only scope, status and request count. Any blocked configuration replaces an older report with a `NOT_EXECUTED` record so a stale pass cannot be mistaken for the current attempt. Exit status is nonzero for blocked or failed checks. Reports never include headers, tokens, upstream exception text or response bodies.

## What each request establishes

The prober first acquires the real Google identity header. If identity acquisition fails or the adapter returns only a worker credential, it sends **zero HTTP requests**; it never falls back to shared-token-only invocation. It then executes, in order, stopping on a failed check:

| Credentials sent to `GET /v1/models` | Expected observation |
| --- | --- |
| No IAM header, no worker credential | Platform 401/403; a recognizable worker `UNAUTHORIZED` JSON response is a failure because it indicates the request reached the worker without platform authentication |
| Deliberately invalid IAM header, valid worker credential | Platform 401/403; no worker-only retry |
| Valid IAM header, no worker credential | Worker 401 with bounded JSON containing `clinical_use=PROHIBITED`, `label_verification=UNVERIFIED`, empty findings, `UNAUTHORIZED` and a valid request ID |
| Valid IAM header, deliberately wrong worker credential | Same worker-boundary 401 evidence |
| Both valid credentials | HTTP200 and version1 inventory, with every model research-only, `UNVERIFIED`, clinically prohibited and unavailable in this default staging candidate |

The worker-denial JSON checks distinguish passing the Google boundary from repeatedly receiving a platform denial. The final check intentionally rejects an enabled/available model because this candidate ships a disabled registry; changing that expectation requires a separately reviewed model deployment and acceptance change.

All requests disable redirects, have a 15-second deadline, use `Cache-Control` request behavior `no-store` and read at most 100,000 response bytes. No response text is copied into reports. Failed checks record only a fixed reason code and HTTP status. Tests cover header separation, identity failure, absence of a fallback, platform-bypass detection, worker-vs-platform denial, model safety invariants, oversized responses, target approval and canonical URL validation.

```sh
npx vitest run --config ops/cloud-run/vitest.config.mts
```

Even a real five-check pass records `full_hosted_iam_validation=NOT_ESTABLISHED`. Independently test a valid Google-signed token with the wrong audience and a valid but unbound caller identity, inspect service/inherited IAM policy, and verify hosted secret rotation and recovery. These remain explicit pending checks. This probe does not establish complete managed Firebase staging, real checkpoint inference, disease-label semantics or clinical validation.
