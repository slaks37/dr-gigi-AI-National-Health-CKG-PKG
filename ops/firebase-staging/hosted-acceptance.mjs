import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePlan, verifyReadiness, approvedFetch, readPrivateJson, privatePath, writeNewPrivate } from './guards.mjs';
import { roles } from './stage.mjs';

export function validateAccounts(plan, credentials) {
  if (credentials.schema_version !== 'sonri.private-synthetic-accounts.v1' || credentials.project_id !== plan.project_id || credentials.database_id !== plan.database_id || credentials.synthetic_prefix !== plan.synthetic_prefix) throw new Error('SYNTHETIC_CREDENTIAL_SCOPE_MISMATCH');
  if (!credentials.accounts || Object.keys(credentials.accounts).length !== Object.keys(roles).length || Object.keys(credentials.accounts).some(role => !(role in roles))) throw new Error('ONLY_BOOTSTRAPPED_SYNTHETIC_IDENTITIES_ALLOWED');
  for (const role of Object.keys(roles)) {
    const a = credentials.accounts?.[role];
    if (!a || a.uid !== `${plan.synthetic_prefix}-${role}` || a.email !== `${a.uid}@example.test` || !a.password || a.claims?.syntheticResearchIdentity !== true || a.claims.role !== roles[role].role || (a.claims.clinicalReviewer === true) !== (roles[role].clinicalReviewer === true) || a.state !== 'CREATED') throw new Error('ONLY_BOOTSTRAPPED_SYNTHETIC_IDENTITIES_ALLOWED');
  }
}
async function signIn(plan, account, fetcher) {
  const response = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(plan.public_firebase_config.apiKey)}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password, returnSecureToken: true }) });
  if (!response.ok) throw new Error('SYNTHETIC_SIGN_IN_FAILED');
  const value = await response.json();
  let claims; try { claims = JSON.parse(Buffer.from(value.idToken.split('.')[1], 'base64url').toString()); } catch { throw new Error('PROVIDER_ID_TOKEN_REQUIRED'); }
  if (value.localId !== account.uid || claims.aud !== plan.project_id || claims.sub !== account.uid || claims.syntheticResearchIdentity !== true || claims.role !== account.claims.role || (claims.clinicalReviewer === true) !== (account.claims.clinicalReviewer === true)) throw new Error('SYNTHETIC_ID_TOKEN_PROJECT_OR_CLAIM_MISMATCH');
  return value.idToken;
}
export async function runHosted(plan, credentials, { fetcher = fetch, protectionBypass, fixture, modelId } = {}) {
  validatePlan(plan, { apply: true }); validateAccounts(plan, credentials);
  if (fixture && createHash('sha256').update(fixture).digest('hex') !== '2fd5e924a70199af7eafe3892c09b2dc92bfa8e5251439a0816d2307b7e32445') throw new Error('AUDITED_DETERMINISTIC_SYNTHETIC_FIXTURE_REQUIRED');
  const tokens = { invalid: 'synthetic-invalid-token' };
  for (const [role, account] of Object.entries(credentials.accounts)) tokens[role] = await signIn(plan, account, fetcher);
  const checks = [];
  const call = (role, path, body, method) => approvedFetch(plan, path, { token: tokens[role], protectionBypass, fetcher, body, method: method || (body ? 'POST' : 'GET') });
  const readiness = await call('admin', '/api/staging-readiness');
  if (readiness.status !== 200) throw new Error('STAGING_READINESS_UNAVAILABLE_NO_CASE_WRITES');
  verifyReadiness(plan, readiness.data); // Every app mutation happens strictly after this check.
  async function expect(name, role, path, body, status, method) {
    const response = await call(role, path, body, method);
    checks.push({ check: name, expected_status: status, actual_status: response.status, passed: response.status === status });
    if (response.status !== status) throw new Error('HOSTED_CHECK_FAILED_' + name.toUpperCase());
    return response.data;
  }
  await expect('anonymous_denied', 'anonymous', '/api/screenings', undefined, 401);
  await expect('patient_cannot_read_readiness', 'patient', '/api/staging-readiness', undefined, 403);
  await expect('patient_cannot_read_audit', 'patient', '/api/activity', undefined, 403);
  const id = `${plan.synthetic_prefix}-case`;
  const screening = { screening_id: id, context: 'ADULT', patient_age: 30, symptoms: {}, images: [], consent_to_process: true };
  await expect('processing_consent_required', 'patient', '/api/screenings', { ...screening, consent_to_process: false }, 400);
  const created = await expect('create_synthetic_case', 'patient', '/api/screenings', screening, 200);
  if (created.recordId !== id || created.persistence !== 'CONFIRMED' || created.version !== 1 || created.screening.confirmed_icd10.length) throw new Error('SYNTHETIC_SCREENING_CONTRACT_FAILED');
  const retried = await expect('idempotent_creation_retry', 'patient', '/api/screenings', screening, 200);
  if (retried.version !== 1) throw new Error('IDEMPOTENCY_VERSION_CHANGED');
  await expect('other_patient_denied', 'outsider', '/api/screenings?id=' + id, undefined, 403);
  await expect('unassigned_doctor_denied', 'doctor', '/api/screenings?id=' + id, undefined, 403);
  const assignment = { screening_id: id, clinician_uid: credentials.accounts.doctor.uid, expected_version: 1, action: 'ASSIGN' };
  await expect('patient_cannot_assign', 'patient', '/api/clinical-assignment', assignment, 403);
  await expect('unqualified_doctor_cannot_be_assigned', 'admin', '/api/clinical-assignment', { ...assignment, clinician_uid: credentials.accounts.unqualified.uid }, 403);
  await expect('administrator_assigns_doctor', 'admin', '/api/clinical-assignment', assignment, 200);
  await expect('stale_assignment_rejected', 'admin', '/api/clinical-assignment', assignment, 409);
  const examination = { dentition: 'PERMANENT', orientation_known: true, medical_history: 'SYNTHETIC fixture only', medications_allergies: 'SYNTHETIC fixture only', extraoral: 'SYNTHETIC', mucosa: 'SYNTHETIC', periodontal: 'Not assessed: synthetic fixture', clinical_notes: 'No real patient or clinical validation', teeth: [{ fdi: '16', status: 'FINDING', surfaces: ['OCCLUSAL'], observation: 'SYNTHETIC odontogram fixture' }], consent_confirmed: true, consent_version: 'sonri-exam-consent-1' };
  const exam = { screening_id: id, expected_version: 2, examination };
  await expect('patient_cannot_record_exam', 'patient', '/api/encounter-exam', exam, 403);
  await expect('exam_consent_required', 'doctor', '/api/encounter-exam', { ...exam, examination: { ...examination, consent_confirmed: false } }, 400);
  const saved = await expect('doctor_records_odontogram', 'doctor', '/api/encounter-exam', exam, 200);
  if (saved.version !== 3 || saved.examination.teeth[0].fdi !== '16') throw new Error('ODONTOGRAM_PERSISTENCE_CONTRACT_FAILED');
  await expect('stale_exam_write_rejected', 'doctor', '/api/encounter-exam', exam, 409);
  const review = { screening_id: id, expected_version: 3, decision: 'APPROVED', note: 'SYNTHETIC reviewer workflow fixture; no clinical claim', findings: [], confirmed_icd10: ['K02.9'], clinical_evidence: ['SYNTHETIC direct examination fixture; not actual care'], examinations: { clinical_exam: true, radiography: false, vitality_test: false, periodontal_exam: false, histopathology: false }, orientation_known: true, anatomical_context_known: true };
  await expect('patient_cannot_confirm_diagnosis', 'patient', '/api/clinical-review', review, 403);
  await expect('review_evidence_required', 'doctor', '/api/clinical-review', { ...review, clinical_evidence: [] }, 400);
  const reviewed = await expect('assigned_doctor_reviews_fixture', 'doctor', '/api/clinical-review', review, 200);
  if (reviewed.version !== 4 || reviewed.screening.confirmed_icd10.join() !== 'K02.9') throw new Error('REVIEW_PERSISTENCE_CONTRACT_FAILED');
  await expect('stale_review_rejected', 'doctor', '/api/clinical-review', review, 409);
  await expect('invalid_token_denied', 'invalid', '/api/screenings?id=' + id, undefined, 401);
  const recovered = await expect('valid_session_can_reread_after_rejections', 'patient', '/api/screenings?id=' + id, undefined, 200);
  if (recovered.version !== 4) throw new Error('DURABLE_CASE_VERSION_MISMATCH');
  const report = await expect('report_exports_saved_odontogram', 'doctor', '/api/clinical-report?id=' + id, undefined, 200);
  if (report.report?.clinical_validation !== 'NOT_ESTABLISHED' || report.report.examination?.teeth[0]?.fdi !== '16') throw new Error('REPORT_SAFETY_OR_ODONTOGRAM_MISMATCH');
  await expect('other_patient_cannot_export_report', 'outsider', '/api/clinical-report?id=' + id, undefined, 403);
  const activity = await expect('administrator_reads_audit', 'admin', '/api/activity', undefined, 200);
  const logs = activity.logs.filter(log => log.resourceId === id);
  for (const action of ['SCREENING_CREATE', 'CLINICIAN_ASSIGN', 'ENCOUNTER_EXAM_SAVE', 'CLINICAL_REVIEW', 'REPORT_EXPORT']) if (!logs.some(log => log.action === action)) throw new Error('EXPECTED_AUDIT_EVENT_MISSING');
  if (logs.filter(log => log.action === 'SCREENING_CREATE').length !== 1) throw new Error('DUPLICATE_SCREENING_CREATE_AUDIT');
  const lab = { model_id: modelId || 'intraoral-yolo', modality: 'intraoral', synthetic_fixture: true, research_opt_in: true, mime_type: 'image/png', data: fixture ? fixture.toString('base64') : 'AA==' };
  await expect('patient_cannot_invoke_worker', 'patient', '/api/model-lab', lab, 403);
  await expect('worker_requires_synthetic_attestation', 'admin', '/api/model-lab', { ...lab, synthetic_fixture: false }, 400);
  let worker = 'NOT_RUN_SYNTHETIC_FIXTURE_REQUIRED';
  if (fixture && modelId) {
    const inference = await expect('admin_runs_explicit_synthetic_fixture', 'admin', '/api/model-lab', lab, 200);
    if (inference.result?.clinical_use !== 'PROHIBITED' || inference.result.label_verification !== 'UNVERIFIED' || inference.persistence !== 'CONFIRMED') throw new Error('WORKER_SAFETY_CONTRACT_FAILED');
    worker = 'SYNTHETIC_WORKER_REQUEST_COMPLETED';
  }
  return { schema_version: 'sonri.hosted-acceptance.v1', status: 'HOSTED_SYNTHETIC_API_WORKFLOW_COMPLETED', project_id: plan.project_id, database_id: plan.database_id, clinical_use: 'PROHIBITED', clinical_validation: false, real_patients: false, checks, worker_execution: worker, provider_outage_restart_restore_tested: false, browser_flow_tested: false, operational_staging_accepted: false };
}
async function main() {
  const { values } = parseArgs({ options: { plan: { type: 'string' }, accounts: { type: 'string' }, apply: { type: 'boolean', default: false }, report: { type: 'string' }, 'protection-token-file': { type: 'string' }, 'synthetic-fixture': { type: 'string' }, 'model-id': { type: 'string' } } });
  if (!values.plan) throw new Error('PLAN_FILE_REQUIRED');
  const plan = validatePlan(JSON.parse(readFileSync(values.plan, 'utf8')), { apply: values.apply });
  if (!values.apply) { console.log(JSON.stringify({ status: 'OFFLINE_ACCEPTANCE_PLAN_ONLY', cloud_writes: 0, hosted_tested: false })); return; }
  if (!values.accounts || !values.report) throw new Error('PRIVATE_ACCOUNTS_AND_REPORT_REQUIRED');
  const credentials = readPrivateJson(values.accounts);
  const protectionBypass = values['protection-token-file'] ? readFileSync(privatePath(values['protection-token-file']), 'utf8').trim() : undefined;
  const fixture = values['synthetic-fixture'] ? readFileSync(privatePath(values['synthetic-fixture'])) : undefined;
  const result = await runHosted(plan, credentials, { protectionBypass, fixture, modelId: values['model-id'] });
  writeNewPrivate(values.report, result);
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length, worker_execution: result.worker_execution, clinical_validation: false }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(JSON.stringify({ status: 'BLOCKED', reason: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'HOSTED_PROVIDER_OR_CONFIGURATION_FAILURE', hosted_completion_claimed: false })); process.exitCode = 1; });
