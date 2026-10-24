import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// These checks must never be repointed at a real project or remote service.
assert.equal(process.env.GCLOUD_PROJECT, 'demo-sonri-workflow');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9098');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
const app = initializeApp({ projectId: 'demo-sonri-workflow' }, 'container-probe');
const auth = getAuth(app), db = getFirestore(app);
const base = 'http://127.0.0.1:3012', checks = [];
const directory = 'ops/staging/evidence';
mkdirSync(directory, { recursive: true });
const mode = process.argv[2] || 'acceptance';
const password = 'synthetic-test-password-only';
async function signIn(uid) {
  const result = await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic-emulator-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${uid}@example.test`, password, returnSecureToken: true }),
  });
  assert.equal(result.status, 200, 'Emulator sign-in must succeed');
  const body = await result.json();
  assert.equal(typeof body.idToken, 'string');
  return body.idToken;
}
async function check(name, path, status, token, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, status, `${name}: expected HTTP ${status}, received ${response.status}`);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  checks.push({ name, expected_status: status, actual_status: response.status });
  return response;
}
async function snapshot() {
  const collections = {};
  // Canonical sorted snapshots include consent, examination/review provenance and audit continuity.
  for (const name of ['records', 'patients', 'auditLogs', 'clinicalReviews', 'examinationRevisions', 'consentRecords']) {
    const docs = await db.collection(name).orderBy('__name__').get();
    collections[name] = { count: docs.size, sha256: createHash('sha256').update(JSON.stringify(docs.docs.map(d => [d.id, d.data()]))).digest('hex') };
  }
  return collections;
}
const records = await db.collection('records').where('userId', '==', 'synthetic-patient').get();
assert.equal(records.size, 1, 'Browser journey must have persisted one synthetic encounter');
const record = records.docs[0], data = record.data();
assert.equal(data.screening.screening_status, 'CLINICIAN_CONFIRMED');
assert.deepEqual(data.screening.confirmed_icd10, ['K02.9']);
assert.equal(data.screening.evidence_provenance.consent_to_process, true);
assert.equal(data.examination.teeth[0].fdi, '16');
const patient = await signIn('synthetic-patient'), admin = await signIn('synthetic-admin');
if (mode === 'acceptance') {
  for (const [uid, claims] of [['synthetic-other-patient', { role: 'patient' }], ['synthetic-unassigned-doctor', { role: 'doctor', clinicalReviewer: true }], ['synthetic-disabled-patient', { role: 'patient' }]]) {
    await auth.createUser({ uid, email: `${uid}@example.test`, password });
    await auth.setCustomUserClaims(uid, claims);
  }
  const other = await signIn('synthetic-other-patient'), doctor = await signIn('synthetic-unassigned-doctor');
  await check('anonymous denied', '/api/records', 401);
  await check('malformed token denied', '/api/records', 401, 'invalid-synthetic-token');
  await check('patient cannot list all cases', '/api/screenings?view=admin', 403, patient);
  await check('patient cannot assign clinician', '/api/clinical-assignment', 403, patient, 'POST', {});
  await check('patient cannot confirm diagnosis', '/api/clinical-review', 403, patient, 'POST', {});
  await check('patient cannot save examination', '/api/encounter-exam', 403, patient, 'POST', {});
  await check('patient cannot read audit', '/api/activity', 403, patient);
  await check('patient cannot invoke research worker', '/api/models', 403, patient);
  await check('patient cannot run research model', '/api/model-lab', 403, patient, 'POST', {});
  await check('role claim injection denied', '/api/auth/sync', 400, patient, 'POST', { role: 'admin' });
  for (const [name, path] of [['screening', '/api/screenings'], ['record', '/api/records'], ['report', '/api/clinical-report'], ['odontogram', '/api/encounter-exam']]) {
    await check(`cross-patient ${name} denied`, `${path}?id=${record.id}`, 403, other);
  }
  await check('unassigned qualified doctor denied', `/api/screenings?id=${record.id}`, 403, doctor);
  await check('missing consent denied', '/api/screenings', 400, patient, 'POST', {
    screening_id: 'synthetic-no-consent', context: 'ADULT', patient_age: 30, symptoms: {}, images: [], consent_to_process: false,
  });
  await check('stale assignment version denied', '/api/clinical-assignment', 409, admin, 'POST', {
    screening_id: record.id, clinician_uid: 'synthetic-doctor', expected_version: 0, action: 'ASSIGN',
  });
  const disabled = await signIn('synthetic-disabled-patient');
  await auth.updateUser('synthetic-disabled-patient', { disabled: true });
  await check('disabled identity denied', '/api/records', 401, disabled);
  const forbidden = await fetch('http://127.0.0.1:8088/v1/projects/demo-sonri-workflow/databases/(default)/documents/auditLogs/synthetic-forged-audit', {
    method: 'PATCH', headers: { authorization: `Bearer ${patient}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { action: { stringValue: 'CLINICAL_REVIEW' } } }),
  });
  assert.equal(forbidden.status, 403, 'Direct client audit forgery must fail Firestore rules');
  checks.push({ name: 'Firestore client cannot forge audit', actual_status: 403, expected_status: 403 });
  const inventory = await check('app reaches private inference with server credential', '/api/models', 200, admin);
  const models = (await inventory.json()).inventory;
  assert.equal(models.clinical_use, 'PROHIBITED');
  assert.ok(models.models.length > 0);
  assert.ok(models.models.every(m => !m.available && m.label_verification === 'UNVERIFIED'));
  const logs = (await db.collection('auditLogs').where('resourceId', '==', record.id).get()).docs.map(d => d.data().action);
  for (const action of ['SCREENING_CREATE', 'CLINICIAN_ASSIGN', 'ENCOUNTER_EXAM_SAVE', 'CLINICAL_REVIEW', 'REPORT_EXPORT']) assert.ok(logs.includes(action), `Missing audit action ${action}`);
  for (const name of ['consentRecords', 'clinicalReviews', 'examinationRevisions']) assert.equal((await db.collection(name).get()).size, 1);
  writeFileSync(`${directory}/recovery-baseline.json`, JSON.stringify(await snapshot(), null, 2) + '\n');
} else {
  assert.ok(['restart', 'restore'].includes(mode));
  await check(`${mode}: patient can retrieve persisted case`, `/api/screenings?id=${record.id}`, 200, patient);
  await check(`${mode}: app reaches worker`, '/api/models', 200, admin);
  assert.deepEqual(await snapshot(), JSON.parse(readFileSync(`${directory}/recovery-baseline.json`, 'utf8')), 'Persistence/audit hashes must survive recovery unchanged');
  checks.push({ name: `${mode}: all six collection counts and hashes unchanged`, result: 'PASS' });
}
const evidence = { executed_at: new Date().toISOString(), scope: 'SYNTHETIC_DOCKER_ACCEPTANCE', mode, checks,
  model_registry: 'ALL_DISABLED', real_firebase_staging: 'NOT_TESTED', clinical_validation: 'NOT_PERFORMED' };
writeFileSync(`${directory}/${mode}.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ mode, passed_checks: checks.length, scope: evidence.scope }));
await db.terminate();
