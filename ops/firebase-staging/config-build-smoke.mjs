import { spawn } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './guards.mjs';

const next = resolve(repositoryRoot, 'node_modules/next/dist/bin/next');
const guard = fileURLToPath(new URL('./loopback-only.cjs', import.meta.url));
const project = 'synthetic-compiled-staging';
const config = { projectId: project, appId: '1:123456789012:web:synthetic-build-smoke', apiKey: 'synthetic-public-sdk-config-no-live-key', authDomain: `${project}.firebaseapp.com`, firestoreDatabaseId: 'sonri-staging', messagingSenderId: '123456789012' };
const env = { ...process.env, SONRI_TEST_BUILD: '1', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SONRI_ENVIRONMENT: 'research-staging', NEXT_PUBLIC_SONRI_FIREBASE_CONFIG: JSON.stringify(config), SONRI_ENVIRONMENT: 'research-staging', GCLOUD_PROJECT: project, FIRESTORE_DATABASE_ID: config.firestoreDatabaseId, SONRI_RESEARCH_PREVIEW: '0', NODE_OPTIONS: `--max-old-space-size=3072 --require=${guard}` };
for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'NEXT_PUBLIC_SONRI_EMULATORS', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_ACCESS_TOKEN', 'FIREBASE_TOKEN', 'SONRI_INFERENCE_TOKEN', 'SONRI_INFERENCE_URL']) delete env[key];
const sleep = ms => new Promise(done => setTimeout(done, ms));
let server, output = '', afterOwnBuild, outboundBlocked = false;
const nextEnv = resolve(repositoryRoot, 'next-env.d.ts');
const beforeNextEnv = existsSync(nextEnv) ? readFileSync(nextEnv) : null;
function launch(args, childEnv) {
  const child = spawn(process.execPath, [next, ...args], { cwd: repositoryRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { const text = chunk.toString(); if (text.includes('SONRI_BLOCKED_OUTBOUND')) outboundBlocked = true; output = (output + text).slice(-500000); });
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(done => child.once('exit', done)), sleep(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
async function unusedPort() {
  const socket = createServer();
  await new Promise((done, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', done); });
  const port = socket.address().port;
  await new Promise(done => socket.close(done));
  return port;
}
async function probe(mode, gcloud, expected) {
  const port = await unusedPort();
  server = launch(['start', '--hostname', '127.0.0.1', '--port', String(port)], { ...env, GCLOUD_PROJECT: gcloud });
  const url = `http://127.0.0.1:${port}/api/staging-readiness`;
  let status;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error('LOOPBACK_SERVER_EXITED');
    try { status = (await fetch(url, { signal: AbortSignal.timeout(2000) })).status; break; } catch { await sleep(200); }
  }
  if (status !== 401) throw new Error('ANONYMOUS_STATUS_MISMATCH_' + mode);
  const invalid = await fetch(url, { headers: { Authorization: 'Bearer synthetic-plain-not-a-jwt' }, signal: AbortSignal.timeout(10000) });
  if (invalid.status !== expected) throw new Error('COMPILED_CONFIG_STATUS_MISMATCH_' + mode + '_' + invalid.status);
  await stop(server); server = null;
  return { mode, anonymous_status: status, malformed_token_status: invalid.status, expected_malformed_status: expected };
}
try {
  const build = launch(['build'], env);
  const timeout = setTimeout(() => build.kill('SIGKILL'), 180000);
  const code = await new Promise((done, reject) => { build.once('error', reject); build.once('exit', done); });
  clearTimeout(timeout);
  afterOwnBuild = existsSync(nextEnv) ? readFileSync(nextEnv) : null;
  if (code !== 0) throw new Error(outboundBlocked ? 'BUILD_ATTEMPTED_OUTBOUND_NETWORK_AND_WAS_BLOCKED' : 'FICTIONAL_STAGING_BUILD_FAILED');
  const probes = [await probe('runtime-project-mismatch', 'synthetic-other-project', 503), await probe('matching-compiled-staging', project, 401)];
  if (outboundBlocked) throw new Error('OUTBOUND_ATTEMPT_BLOCKED_NO_PROVIDER_REQUEST_ALLOWED');
  const result = { schema_version: 'sonri.compiled-staging-config-smoke.v1', status: 'PASSED_LOCAL_COMPILED_CONFIG_BOUNDARIES', distribution: '.next-workflow', project_id: project, probes, credentials_supplied: false, outbound_network_attempted: false, cloud_calls: 0, real_identities: false, cloud_writes: 0, hosted_staging_tested: false, clinical_validation: false };
  const generated = resolve(repositoryRoot, 'ops/firebase-staging/generated');
  mkdirSync(generated, { recursive: true });
  writeFileSync(resolve(generated, 'config-build-smoke.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({ status: 'BLOCKED', reason: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LOCAL_BUILD_OR_LOOPBACK_PROBE_FAILED', hosted_staging_tested: false }));
  process.exitCode = 1;
} finally {
  await stop(server);
  if (beforeNextEnv && afterOwnBuild && existsSync(nextEnv) && readFileSync(nextEnv).equals(afterOwnBuild) && !beforeNextEnv.equals(afterOwnBuild)) writeFileSync(nextEnv, beforeNextEnv);
}
