#!/usr/bin/env bash
# Isolated demo project, synthetic data only. No credentials from cloud are needed.
set -euo pipefail
cd "$(dirname "$0")/../.."
export SONRI_APP_PORT=3012 GCLOUD_PROJECT=demo-sonri-workflow
export COMPOSE_PARALLEL_LIMIT=1
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9098 FIRESTORE_EMULATOR_HOST=127.0.0.1:8088
# A random ephemeral shared container token. Never enable shell tracing here.
export SONRI_INFERENCE_TOKEN="${SONRI_INFERENCE_TOKEN:-$(openssl rand -hex 32)}"
compose=(docker compose -p sonri-phase2-synthetic -f compose.yaml -f ops/staging/compose.test.yaml)
mkdir -p ops/staging/evidence
private_log=$(mktemp)
cleanup() {
  result=$?
  if [[ $result -ne 0 ]]; then
    "${compose[@]}" ps > ops/staging/evidence/failed-services.txt || true
    # Raw emulator logs may include synthetic sign-in tokens: redact error-only lines.
    "${compose[@]}" logs --no-log-prefix firebase app inference | node ops/staging/diagnostic.mjs || true
  fi
  rm -f "$private_log"
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
"${compose[@]}" config --quiet
"${compose[@]}" build
"${compose[@]}" up --detach --wait --wait-timeout 240
worker_id=$("${compose[@]}" ps --quiet inference)
docker inspect --format '{{json .NetworkSettings.Ports}}' "$worker_id" | node -e '
let input=""; process.stdin.on("data",d=>input+=d); process.stdin.on("end",()=>{
  const ports=JSON.parse(input); if(Object.values(ports).some(value=>value!==null)) process.exit(1);
  require("fs").writeFileSync("ops/staging/evidence/network.json",JSON.stringify({inference_published_ports:false,scope:"SYNTHETIC_DOCKER_NETWORK"},null,2)+"\n");
});'
"${compose[@]}" exec -T inference python - < ops/staging/worker-probe.py > ops/staging/evidence/worker-boundary.json
npx playwright test --config ops/staging/playwright.config.ts
node -e 'const r=JSON.parse(require("fs").readFileSync("ops/staging/evidence/browser.json","utf8")); if(r.stats.expected!==1 || r.stats.unexpected!==0 || r.stats.skipped!==0) throw new Error("Synthetic browser evidence incomplete")'
node ops/staging/probe.mjs acceptance
"${compose[@]}" restart app inference
"${compose[@]}" up --detach --wait --wait-timeout 180
node ops/staging/probe.mjs restart
# Export only demo emulator data into a private named volume; never publish it.
"${compose[@]}" exec -T firebase firebase emulators:export /state/snapshot --force --project demo-sonri-workflow --config /app/ops/staging/firebase.json > /dev/null
"${compose[@]}" stop app firebase
"${compose[@]}" up --detach --force-recreate --no-deps --wait --wait-timeout 180 firebase
"${compose[@]}" up --detach --wait --wait-timeout 180 app
node ops/staging/probe.mjs restore
"${compose[@]}" logs --no-log-prefix inference > "$private_log"
node ops/staging/log-check.mjs "$private_log"
"${compose[@]}" images --format json > ops/staging/evidence/container-images.json
node -e 'require("fs").writeFileSync("ops/staging/evidence/run.json",JSON.stringify({commit:process.env.GITHUB_SHA||"LOCAL_UNCOMMITTED",executed_at:new Date().toISOString(),scope:"SYNTHETIC_DOCKER_COMPOSE_ACCEPTANCE",status:"PASS",real_firebase_staging:"NOT_TESTED",model_registry:"ALL_DISABLED",clinical_validation:"NOT_PERFORMED"},null,2)+"\n")'
