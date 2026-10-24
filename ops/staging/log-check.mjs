import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const contents = readFileSync(process.argv[2], 'utf8');
const token = process.env.SONRI_INFERENCE_TOKEN;
assert.ok(token && token.length >= 32);
assert.ok(!contents.includes(token), 'Worker logs must not contain the credential');
for (const forbidden of ['SYNTHETIC_NO_PATIENT_DATA', 'synthetic-wrong-token', 'Authorization:', 'Bearer ']) assert.ok(!contents.includes(forbidden));
const events = contents.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const requests = events.filter(e => e.event === 'inference_http');
assert.ok(requests.length >= 5, 'Request observability must exist');
for (const event of requests) {
  assert.deepEqual(Object.keys(event).sort(), ['event', 'latency_ms', 'request_id', 'route', 'status_code'].sort());
  assert.match(event.request_id, /^[0-9a-f]{32}$/);
  assert.ok(event.latency_ms >= 0);
}
assert.ok(requests.some(e => e.status_code === 401));
assert.ok(requests.some(e => e.status_code === 503));
writeFileSync('ops/staging/evidence/observability.json', JSON.stringify({
  scope: 'SYNTHETIC_CONTAINER_LOG_ALLOWLIST', requests: requests.length,
  fields: ['event', 'request_id', 'route', 'status_code', 'latency_ms'],
  unauthorized_observed: true, unavailable_observed: true, credential_or_upload_leak_detected: false,
}, null, 2) + '\n');
console.log(JSON.stringify({ log_allowlist: 'PASS', requests: requests.length }));
