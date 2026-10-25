import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, chmodSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { validatePlan, verifyReadiness, assertInventoryEmpty, legacyProject, privatePath, repositoryRoot, approvedFetch } from './guards.mjs';
import { render, roles } from './stage.mjs';
import { runHosted } from './hosted-acceptance.mjs';

function plan() {
  return { schema_version: 'sonri.firebase-staging-plan.v1', environment: 'research-staging', clinical_use: 'PROHIBITED', project_id: 'synthetic-isolated-stage', database_id: 'sonri-staging', approved_origin: 'https://synthetic-staging.example.test', synthetic_prefix: 'synthetic-stg-unit-only', owner_approved: true, empty_project_approved: true, owner_approval_reference: 'SYNTHETIC_TEST_ONLY', owner_approval_date: '2026-10-25', approved_region: 'asia-southeast2', public_firebase_config: { projectId: 'synthetic-isolated-stage', firestoreDatabaseId: 'sonri-staging', authDomain: 'synthetic-isolated-stage.firebaseapp.com', messagingSenderId: '123456', appId: '1:123456:web:synthetic', apiKey: 'public-config-fixture' } };
}
function readiness(p) { return { success: true, environment: 'research-staging', synthetic_accounts_only: true, project_id: p.project_id, database_id: p.database_id, clinical_use: 'PROHIBITED', source_images_retained: false, inventory: { clinical_use: 'PROHIBITED', models: [] } }; }
function accounts(p) { return { schema_version: 'sonri.private-synthetic-accounts.v1', project_id: p.project_id, database_id: p.database_id, synthetic_prefix: p.synthetic_prefix, accounts: Object.fromEntries(Object.entries(roles).map(([key, claims]) => [key, { uid: `${p.synthetic_prefix}-${key}`, email: `${p.synthetic_prefix}-${key}@example.test`, password: 'synthetic-test-only', claims: { ...claims, syntheticResearchIdentity: true }, state: 'CREATED' }])) }; }

test('explicit apply requires owner project and empty-environment approval', () => {
  const p = plan(); p.owner_approved = false;
  assert.doesNotThrow(() => validatePlan(p, { env: {} }));
  assert.throws(() => validatePlan(p, { apply: true, env: {} }), /OWNER_PROJECT_APPROVAL_REQUIRED/);
});
for (const id of [legacyProject, 'gen-lang-client-0680977640', 'demo-sonri-workflow']) test('preexisting or emulator project forbidden: ' + id, () => {
  const p = plan(); p.project_id = id;
  assert.throws(() => validatePlan(p, { env: {} }), /SEPARATE_APPROVED_PROJECT_REQUIRED/);
});
test('mismatched public/runtime project and emulator settings fail closed', () => {
  assert.throws(() => validatePlan(plan(), { env: { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8088' } }), /EMULATOR/);
  assert.throws(() => validatePlan(plan(), { env: { GCLOUD_PROJECT: 'wrong-project' } }), /PROJECT_ENVIRONMENT_MISMATCH/);
  const p = plan(); p.public_firebase_config.private_key = 'synthetic-not-a-real-key';
  assert.throws(() => validatePlan(p, { env: {} }), /PUBLIC_CONFIG_HAS_UNSUPPORTED_FIELDS/);
});
test('readiness must prove deployed project/database and prohibitions', () => {
  const p = plan(), good = readiness(p);
  assert.equal(verifyReadiness(p, good), good);
  for (const changed of [{ project_id: 'wrong-project' }, { database_id: '(default)' }, { clinical_use: 'ENABLED' }, { synthetic_accounts_only: false }, { source_images_retained: true }, { inventory: null }]) assert.throws(() => verifyReadiness(p, { ...good, ...changed }));
});
test('nonempty or untrusted inventories cannot be seeded', () => {
  assertInventoryEmpty([], [], 'synthetic-stg-unit-only');
  assert.throws(() => assertInventoryEmpty([{ uid: 'real-account' }], [], 'synthetic-stg-unit-only'), /AUTH_INVENTORY/);
  assert.throws(() => assertInventoryEmpty([{ uid: 'synthetic-stg-unit-only-admin', customClaims: {} }], [], 'synthetic-stg-unit-only'), /AUTH_INVENTORY/);
  assert.throws(() => assertInventoryEmpty([], ['patients'], 'synthetic-stg-unit-only'), /FIRESTORE_DATABASE_NOT_EMPTY/);
});
test('renderer is offline, creates explicit named-database candidate, and never overwrites', () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'sonri-staging-unit-')); chmodSync(folder, 0o700);
  try {
    const result = render(plan(), folder);
    assert.equal(result.cloud_writes, 0); assert.equal(result.hosted_tested, false);
    assert.equal(JSON.parse(readFileSync(resolve(folder, 'firebase.json'), 'utf8')).firestore[0].database, 'sonri-staging');
    assert.throws(() => render(plan(), folder), /EEXIST/);
  } finally { rmSync(folder, { recursive: true }); }
});
test('wrong deployed readiness blocks every application mutation after real-shaped synthetic sign-in', async () => {
  const p = plan(), creds = accounts(p), calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, method: options.method });
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      const input = JSON.parse(options.body);
      const account = Object.values(creds.accounts).find(a => a.email === input.email);
      const claims = { ...account.claims, aud: p.project_id, sub: account.uid };
      return new Response(JSON.stringify({ localId: account.uid, idToken: `synthetic.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.not-signed-test` }), { status: 200 });
    }
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ ...readiness(p), project_id: 'wrong-project' }), { status: 200 });
  };
  await assert.rejects(() => runHosted(p, creds, { fetcher }), /READINESS_MISMATCH/);
  assert.equal(calls.filter(call => call.url.includes('/api/') && call.method === 'POST').length, 0);
});
test('arbitrary image cannot enter the hosted worker probe', async () => {
  const p = plan(); let networkCalls = 0;
  await assert.rejects(() => runHosted(p, accounts(p), { fixture: Buffer.from('synthetic wrong bytes'), fetcher: async () => { networkCalls++; } }), /AUDITED_DETERMINISTIC_SYNTHETIC_FIXTURE_REQUIRED/);
  assert.equal(networkCalls, 0);
});


test('inside-repository child beginning with two dots is not an outside private path', () => {
  const folder = mkdtempSync(resolve(repositoryRoot, '..private-guard-test-')); chmodSync(folder, 0o700);
  try {
    assert.throws(() => privatePath(resolve(folder, 'credentials.json'), { mustExist: false }), /PRIVATE_FILE_MUST_BE_OUTSIDE_GIT/);
  } finally { rmSync(folder, { recursive: true }); }
});
for (const marker of ['directory', 'file']) test('private credentials under another Git ancestor are refused: ' + marker, () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'sonri-other-git-test-')); chmodSync(folder, 0o700);
  try {
    if (marker === 'directory') mkdirSync(resolve(folder, '.git'));
    else writeFileSync(resolve(folder, '.git'), 'gitdir: /synthetic/nonexistent-fixture\n');
    const privateFolder = resolve(folder, 'private'); mkdirSync(privateFolder, { mode: 0o700 });
    assert.throws(() => privatePath(resolve(privateFolder, 'credentials.json'), { mustExist: false }), /PRIVATE_FILE_MUST_BE_OUTSIDE_GIT/);
  } finally { rmSync(folder, { recursive: true }); }
});
test('worker readiness rejects unsafe inventory or any promoted model label', () => {
  const p = plan(), good = readiness(p);
  const model = { id: 'synthetic-test-model', clinical_use: 'PROHIBITED', label_verification: 'UNVERIFIED' };
  assert.doesNotThrow(() => verifyReadiness(p, { ...good, inventory: { clinical_use: 'PROHIBITED', models: [model] } }));
  for (const inventory of [
    { models: [] },
    { clinical_use: 'ENABLED', models: [] },
    { clinical_use: 'PROHIBITED', models: [{ ...model, clinical_use: 'ENABLED' }] },
    { clinical_use: 'PROHIBITED', models: [{ ...model, label_verification: 'VERIFIED' }] },
    { clinical_use: 'PROHIBITED', models: [null] },
  ]) assert.throws(() => verifyReadiness(p, { ...good, inventory }), /PRIVATE_WORKER_INVENTORY_REQUIRED/);
});

test('extra identities or altered synthetic roles abort before any provider sign-in', async () => {
  const p = plan(); let calls = 0;
  const fetcher = async () => { calls++; throw new Error('UNEXPECTED_PROVIDER_CALL'); };
  const extra = accounts(p); extra.accounts.unapproved = { uid: 'unapproved' };
  const wrongRole = accounts(p); wrongRole.accounts.patient.claims.role = 'admin';
  const wrongReview = accounts(p); wrongReview.accounts.unqualified.claims.clinicalReviewer = true;
  for (const credentials of [extra, wrongRole, wrongReview]) {
    await assert.rejects(() => runHosted(p, credentials, { fetcher }), /ONLY_BOOTSTRAPPED_SYNTHETIC_IDENTITIES_ALLOWED/);
  }
  assert.equal(calls, 0);
});

test('oversized streamed API responses are cancelled at the byte bound', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(500000));
      controller.enqueue(new Uint8Array(500001));
    },
    cancel() { cancelled = true; },
  });
  await assert.rejects(() => approvedFetch(plan(), '/api/staging-readiness', {
    fetcher: async () => new Response(stream, { status: 200 }),
  }), /BOUNDED_API_RESPONSE_REQUIRED/);
  assert.equal(cancelled, true);
});
