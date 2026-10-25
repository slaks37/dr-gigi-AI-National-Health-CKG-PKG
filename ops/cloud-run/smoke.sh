#!/usr/bin/env bash
# Docker-only Cloud Run PORT compatibility check. Does not contact Google Cloud.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p ops/cloud-run/generated
export INFERENCE_API_TOKEN
INFERENCE_API_TOKEN=$(openssl rand -hex 32)
container_name=""
cleanup() {
  result=$?
  if [[ -n "$container_name" ]]; then docker rm --force "$container_name" >/dev/null 2>&1 || true; fi
  exit "$result"
}
trap cleanup EXIT
docker build --file ops/cloud-run/Dockerfile --target onnx-cpu --tag sonri-cloud-run-contract:local services/inference
: > ops/cloud-run/generated/port-contract.ndjson
SONRI_CLOUD_RUN_LOCAL_IMAGE_ID=$(docker image inspect --format '{{.Id}}' sonri-cloud-run-contract:local)
SONRI_CLOUD_RUN_CHECKOUT_SHA=$(git rev-parse HEAD)
SONRI_CLOUD_RUN_SOURCE_DIRTY=$(git status --porcelain --untracked-files=normal)
export SONRI_CLOUD_RUN_LOCAL_IMAGE_ID SONRI_CLOUD_RUN_CHECKOUT_SHA SONRI_CLOUD_RUN_SOURCE_DIRTY
python3 - <<'PYTHON' >> ops/cloud-run/generated/port-contract.ndjson
import json
import os
import re
from datetime import datetime, timezone

image = os.environ['SONRI_CLOUD_RUN_LOCAL_IMAGE_ID']
checkout = os.environ['SONRI_CLOUD_RUN_CHECKOUT_SHA']
head = os.environ.get('SONRI_TESTED_HEAD_SHA') or checkout
assert re.fullmatch(r'sha256:[0-9a-f]{64}', image)
assert re.fullmatch(r'[0-9a-f]{40}', checkout)
assert re.fullmatch(r'[0-9a-f]{40}', head)
print(json.dumps({'record_type': 'BUILD_SOURCE_LINKAGE', 'scope': 'LOCAL_DOCKER_BUILD_ONLY',
                  'executed_at_utc': datetime.now(timezone.utc).isoformat(),
                  'image_id': image, 'image_tag': 'sonri-cloud-run-contract:local',
                  'build_target': 'onnx-cpu', 'source_checkout_sha': checkout,
                  'requested_branch_head_sha': head,
                  'github_event_sha': os.environ.get('GITHUB_SHA'),
                  'source_worktree_dirty': bool(os.environ['SONRI_CLOUD_RUN_SOURCE_DIRTY']),
                  'registry_push_performed': False, 'cloud_run_deployment_performed': False}))
PYTHON
for worker_port in 8080 8091; do
  container_name="sonri-cloud-run-contract-$$-$worker_port"
  docker run --detach --name "$container_name" --network none --read-only --memory 2g --cpus 1 \
    --cap-drop ALL --security-opt no-new-privileges:true \
    --tmpfs /tmp:rw,noexec,nosuid,size=128m,uid=10001,gid=10001 \
    --env "PORT=$worker_port" --env INFERENCE_API_TOKEN sonri-cloud-run-contract:local >/dev/null
  docker exec --interactive "$container_name" python - <<'PYTHON' >> ops/cloud-run/generated/port-contract.ndjson
import importlib.metadata
import json
import os
import time
import urllib.error
import urllib.request

assert os.getuid() == 10001
base = 'http://127.0.0.1:' + os.environ['PORT']
for attempt in range(60):
    try:
        health = json.load(urllib.request.urlopen(base + '/healthz', timeout=2))
        break
    except (OSError, urllib.error.URLError):
        time.sleep(1)
else:
    raise RuntimeError('Worker did not become healthy')
assert health['clinical_use'] == 'PROHIBITED'
try:
    urllib.request.urlopen(base + '/v1/models', timeout=3)
    raise AssertionError('Anonymous worker access unexpectedly permitted')
except urllib.error.HTTPError as error:
    assert error.code == 401
request = urllib.request.Request(base + '/v1/models', headers={'Authorization': 'Bearer ' + os.environ['INFERENCE_API_TOKEN']})
inventory = json.load(urllib.request.urlopen(request, timeout=3))
assert inventory['models'] and all(not model['available'] for model in inventory['models'])
assert inventory['clinical_use'] == 'PROHIBITED'
print(json.dumps({'scope': 'DOCKER_CLOUD_RUN_PORT_CONTRACT_ONLY', 'port': int(os.environ['PORT']),
                  'health': 'PASS', 'anonymous_denial': 'PASS', 'protected_inventory': 'PASS',
                  'onnxruntime_version': importlib.metadata.version('onnxruntime'),
                  'uid': os.getuid(), 'models': 'ALL_UNAVAILABLE', 'cloud_iam_tested': False,
                  'billable_cloud_actions_executed': False, 'clinical_validation': 'NOT_PERFORMED'}))
PYTHON
  docker rm --force "$container_name" >/dev/null
  container_name=""
done
cat ops/cloud-run/generated/port-contract.ndjson
