import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validatePlan, privatePath, writeNewPrivate, createPrivateDirectory, repositoryRoot, assertInventoryEmpty, readPrivateJson } from './guards.mjs';

export const roles = { patient: { role: 'patient' }, outsider: { role: 'patient' }, doctor: { role: 'doctor', clinicalReviewer: true }, unqualified: { role: 'doctor' }, admin: { role: 'admin' } };
export function render(plan, directory) {
  validatePlan(plan);
  createPrivateDirectory(directory);
  const publicConfig = JSON.stringify(plan.public_firebase_config);
  // Environment maps for operator tooling, not executable shell fragments.
  writeNewPrivate(resolve(directory, 'build-env.json'), { NEXT_PUBLIC_SONRI_ENVIRONMENT: 'research-staging', NEXT_PUBLIC_SONRI_FIREBASE_CONFIG: publicConfig });
  writeNewPrivate(resolve(directory, 'runtime-env.json'), { SONRI_ENVIRONMENT: 'research-staging', GCLOUD_PROJECT: plan.project_id, FIRESTORE_DATABASE_ID: plan.database_id });
  writeNewPrivate(resolve(directory, 'firebase.json'), { firestore: [{ database: plan.database_id, rules: 'firestore.rules', indexes: 'firestore.indexes.json' }] });
  writeNewPrivate(resolve(directory, 'firestore.indexes.json'), { indexes: [], fieldOverrides: [] });
  const rules = resolve(directory, 'firestore.rules'); privatePath(rules, { mustExist: false }); copyFileSync(resolve(repositoryRoot, 'firestore.rules'), rules);
  return { status: 'OFFLINE_CANDIDATE_RENDERED', project_id: plan.project_id, cloud_writes: 0, hosted_tested: false };
}
export async function bootstrap(plan, output, env = process.env) {
  validatePlan(plan, { apply: true, env });
  privatePath(output, { mustExist: false });
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credential = readPrivateJson(env.GOOGLE_APPLICATION_CREDENTIALS);
    if (credential.type === 'service_account' || credential.private_key) throw new Error('LONG_LIVED_SERVICE_ACCOUNT_KEYS_FORBIDDEN');
  }
  const [{ initializeApp, applicationDefault, deleteApp }, { getAuth }, { getFirestore }, { GoogleAuth }] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/auth'), import('firebase-admin/firestore'), import('google-auth-library')]);
  const google = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  if (google.constructor?.name === 'JWT' || google.key || google.keyFile) throw new Error('LONG_LIVED_SERVICE_ACCOUNT_KEYS_FORBIDDEN');
  const remoteConfig = (await google.request({ url: `https://firebase.googleapis.com/v1beta1/projects/${plan.project_id}/webApps/${encodeURIComponent(plan.public_firebase_config.appId)}/config` })).data;
  for (const key of ['projectId', 'appId', 'apiKey', 'authDomain', 'messagingSenderId']) if (remoteConfig[key] !== plan.public_firebase_config[key]) throw new Error('PROVIDER_WEB_APP_CONFIG_MISMATCH');
  const databases = (await google.request({ url: `https://firestore.googleapis.com/v1/projects/${plan.project_id}/databases` })).data.databases || [];
  if (databases.length !== 1 || databases[0].name !== `projects/${plan.project_id}/databases/${plan.database_id}` || databases[0].locationId !== plan.approved_region) throw new Error('PROVIDER_DATABASE_SCOPE_MISMATCH');
  const app = initializeApp({ credential: applicationDefault(), projectId: plan.project_id }, 'sonri-private-staging-bootstrap');
  const auth = getAuth(app), db = getFirestore(app, plan.database_id);
  const created = [];
  try {
    const listing = await auth.listUsers(1000);
    if (listing.pageToken) throw new Error('AUTH_INVENTORY_INCOMPLETE');
    assertInventoryEmpty(listing.users, (await db.listCollections()).map(item => item.id), plan.synthetic_prefix);
    const accounts = Object.fromEntries(Object.entries(roles).map(([role, claims]) => [role, { uid: `${plan.synthetic_prefix}-${role}`, email: `${plan.synthetic_prefix}-${role}@example.test`, password: randomBytes(32).toString('base64url'), claims: { ...claims, syntheticResearchIdentity: true }, state: 'PLANNED' }]));
    const state = { schema_version: 'sonri.private-synthetic-accounts.v1', project_id: plan.project_id, database_id: plan.database_id, synthetic_prefix: plan.synthetic_prefix, accounts };
    const target = writeNewPrivate(output, state);
    for (const account of Object.values(accounts)) {
      await auth.createUser({ uid: account.uid, email: account.email, password: account.password, displayName: 'SONRI synthetic staging fixture' });
      created.push(account.uid);
      await auth.setCustomUserClaims(account.uid, account.claims);
      account.state = 'CREATED';
      writeFileSync(target, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    }
    return { status: 'SYNTHETIC_IDENTITIES_CREATED', project_id: plan.project_id, created_accounts: created.length, hosted_workflow_tested: false, clinical_use: 'PROHIBITED' };
  } catch (error) {
    await Promise.allSettled(created.map(uid => auth.updateUser(uid, { disabled: true })));
    throw error;
  } finally { await deleteApp(app); }
}
async function main() {
  const { values } = parseArgs({ options: { plan: { type: 'string' }, render: { type: 'string' }, apply: { type: 'boolean', default: false }, 'accounts-output': { type: 'string' } } });
  if (!values.plan) throw new Error('PLAN_FILE_REQUIRED');
  const plan = validatePlan(JSON.parse(readFileSync(values.plan, 'utf8')), { apply: values.apply });
  if (values.apply) {
    if (!values['accounts-output']) throw new Error('PRIVATE_ACCOUNTS_OUTPUT_REQUIRED');
    console.log(JSON.stringify(await bootstrap(plan, values['accounts-output'])));
  } else if (values.render) console.log(JSON.stringify(render(plan, values.render)));
  else console.log(JSON.stringify({ status: 'OFFLINE_PREFLIGHT_ONLY', project_id: plan.project_id, owner_project_approval_recorded: plan.owner_approved === true, adc_verified: false, cloud_writes: 0, hosted_tested: false }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(JSON.stringify({ status: 'BLOCKED', reason: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PROVIDER_OR_CONFIGURATION_ERROR_REVIEW_PRIVATE_OPERATOR_LOGS', cloud_success_claimed: false })); process.exitCode = 1; });
