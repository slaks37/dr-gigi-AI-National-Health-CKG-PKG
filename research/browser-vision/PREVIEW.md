# Isolated research Preview acceptance

The base browser implementation is commit `4be9d21`. No model training or repeat desktop inference benchmark is part of this deployment acceptance patch.

The dedicated Vercel project is `sonri-browser-ai-research`, project ID `prj_o2Ct5lziTqam7E9Axi8BtgHz2yhB`, under `slaks37s-projects`. The stable research Preview alias is `https://sonri-browser-ai-preview-slaks37s-projects.vercel.app/admin/vision-lab`. A URL and successful build alone do not establish acceptance; verify its actual deployment target, commit and real administrator flow before reporting a pass.

Vercel classified the first deployment as production despite an explicit Preview flag. It was canceled before alias assignment. The owner subsequently explicitly approved a bootstrap production deployment on this new research project only; the existing SONRI production project was not changed. Future changes must be deployed as Preview and the returned target checked. Do not promote the Preview.

## Keyless authentication and patient isolation

Only the Preview environment receives `SONRI_RESEARCH_PREVIEW=1`, `SONRI_GCP_WIF_AUDIENCE` and `SONRI_GCP_AUTH_SERVICE_ACCOUNT`. The latter two are resource identifiers, not credentials. OIDC exchanges short-lived Vercel tokens using the official Vercel and Google SDKs. Personal Firebase CLI refresh tokens and service-account private keys must never be deployed.

The configured GCP pool is `sonri-vercel-preview`, provider `vercel`, service account `sonri-preview-auth`, custom role `sonriPreviewTokenVerifier`. Its only application permission is `firebaseauth.users.get`, needed for the mandatory revoked/disabled-user check in `verifyIdToken(token, true)`. The provider requires all three claims:

```
assertion.owner_id == 'team_SCDxbr7VMTFUyI60ki7xaNmg'
&& assertion.project_id == 'prj_o2Ct5lziTqam7E9Axi8BtgHz2yhB'
&& assertion.environment == 'preview'
```

Service-account impersonation permits only subject `owner:slaks37s-projects:project:sonri-browser-ai-research:environment:preview`. No Firestore permission, account mutation permission or private key is granted to this service identity. The owner approved these exact persistent resources and bindings before configuration. Revoke the dedicated binding/provider when the experiment ends.

With this flag, the shared API wrapper allows only GET `/api/vision-lab`, POST `/api/vision-lab/browser`, and POST `/api/auth/sync`; all still require server-verified Firebase authentication. The sync endpoint returns the verified role without writing a profile. Patient, dataset, clinical, SATUSEHAT, Gemini and server/cloud inference requests are refused. The flag fails closed outside `VERCEL_ENV=preview`. Existing ADC configuration and ordinary routes remain unchanged when the flag is unset. The already unavailable IoT endpoint remains unavailable.

The owner-requested account was verified by its existing Firebase UID, matching verified Google email and enabled status before setting only its `role=admin` custom claim. Other claims were preserved, and the result was read back. This is a real Firebase claim, not a browser allowlist; the operator must refresh their token/sign in again. Admin permission does not constitute clinical reviewer qualification.

## Acceptance evidence and remaining gates

The first keyless Preview exposed a hosted-only initialization failure: `jwks-rsa` synchronously requires ESM-only `jose` through Firebase Admin. Vercel's instrumented CommonJS loader returned `ERR_REQUIRE_ESM`, including on `/api/auth/sync`. The failure was independently reproduced by importing the built routes with Node's `--no-experimental-require-module`. `transpilePackages` now bundles `firebase-admin`, `jwks-rsa` and `jose`; no cryptographic dependency is downgraded and no verification is removed. CI executes `npm run test:server-imports` after build to retain this runtime constraint as a regression check. Hosted verification is still required after any such packaging change.

The original commit's first true Preview served its Worker and all ten runtime/manifest assets over HTTPS with SHA256 matching the generated local build. That is static delivery evidence, not a new model benchmark. Its first Google login failed with `auth/unauthorized-domain`. Only the stable Preview alias was then appended to Firebase authorizedDomains, preserving the 24 previous domains. The keyless patch must still be verified in the deployed Preview with a real administrator before acceptance.

Physical Android Chrome and iPhone Safari are available according to the owner, but results remain NOT_TESTED until actual-device JSON and observations are received. The existing panel exports `sonri-browser-benchmark.json`. Record model/OS/browser, cold and reused-session timings, cache reload, stop/clear, failures and unmeasurable peak memory as null. No responsive emulation may replace hardware evidence.

RAW_CLASS_0 through RAW_CLASS_4 remain UNVERIFIED. The authenticated Roboflow dataset UI lists Caries, Cavity, Crack and Tooth. Hosted sample JSON exposed Caries class_id 0 and Tooth class_id 3, but these IDs do not establish the five checkpoint output slots. The original checkpoint contains `model` and `args`, no class-name metadata, and a five-row class head. Current RF-DETR remapping code is not proof of the original training version. Obtain the exact training export categories plus label-remapping/class_names metadata tied to the checkpoint before applying any names. Clinical use remains PROHIBITED.

References: [Vercel first-deploy issue](https://github.com/vercel/vercel/issues/17069), [Vercel GCP OIDC](https://vercel.com/docs/oidc/gcp), [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims), [RF-DETR dataset implementation](https://github.com/roboflow/rf-detr/blob/develop/src/rfdetr/datasets/coco.py).
