import { readFileSync, statSync, realpathSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const legacyProject = JSON.parse(readFileSync(resolve(repositoryRoot, 'firebase-applet-config.json'), 'utf8')).projectId;
export const environmentKeys = ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST', 'NEXT_PUBLIC_SONRI_EMULATORS'];
export function assertNoEmulators(env = process.env) {
  if (environmentKeys.some(key => env[key])) throw new Error('EMULATOR_ENVIRONMENT_FORBIDDEN');
}
export function validatePlan(plan, { apply = false, env = process.env } = {}) {
  assertNoEmulators(env);
  const c = plan.public_firebase_config;
  if (plan.schema_version !== 'sonri.firebase-staging-plan.v1' || plan.environment !== 'research-staging' || plan.clinical_use !== 'PROHIBITED' || !c) throw new Error('STAGING_PLAN_REQUIRED');
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(plan.project_id) || [legacyProject, 'gen-lang-client-0680977640'].includes(plan.project_id) || plan.project_id.startsWith('demo-') || (plan.forbidden_project_ids || []).includes(plan.project_id)) throw new Error('SEPARATE_APPROVED_PROJECT_REQUIRED');
  if (c.projectId !== plan.project_id || c.firestoreDatabaseId !== plan.database_id || c.authDomain !== `${plan.project_id}.firebaseapp.com` || !/^\d+$/.test(c.messagingSenderId) || !c.appId?.startsWith(`1:${c.messagingSenderId}:web:`) || !c.apiKey) throw new Error('PUBLIC_FIREBASE_CONFIG_MISMATCH');
  if (!/^(\(default\)|[a-z][a-z0-9-]{2,61}[a-z0-9])$/.test(plan.database_id)) throw new Error('INVALID_DATABASE_ID');
  const allowed = new Set(['projectId','appId','apiKey','authDomain','firestoreDatabaseId','storageBucket','messagingSenderId','measurementId']);
  if (Object.keys(c).some(key => !allowed.has(key))) throw new Error('PUBLIC_CONFIG_HAS_UNSUPPORTED_FIELDS');
  const origin = new URL(plan.approved_origin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || origin.hostname === 'localhost' || origin.hostname.endsWith('.firebaseapp.com')) throw new Error('EXACT_HTTPS_STAGING_ORIGIN_REQUIRED');
  if (!/^synthetic-stg-[a-z0-9-]{3,40}$/.test(plan.synthetic_prefix)) throw new Error('SYNTHETIC_PREFIX_REQUIRED');
  if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== plan.project_id) throw new Error('ADC_PROJECT_ENVIRONMENT_MISMATCH');
  if (apply && origin.hostname.endsWith('.invalid')) throw new Error('REAL_APPROVED_STAGING_ORIGIN_REQUIRED');
  if (apply && (plan.owner_approved !== true || plan.empty_project_approved !== true || !plan.owner_approval_reference || !/^\d{4}-\d{2}-\d{2}$/.test(plan.owner_approval_date || '') || !plan.approved_region)) throw new Error('OWNER_PROJECT_APPROVAL_REQUIRED');
  return plan;
}
export function verifyReadiness(plan, body) {
  if (body?.success !== true || body.environment !== 'research-staging' || body.project_id !== plan.project_id || body.database_id !== plan.database_id || body.clinical_use !== 'PROHIBITED' || body.synthetic_accounts_only !== true || body.source_images_retained !== false) throw new Error('DEPLOYED_PROJECT_READINESS_MISMATCH');
  if (!body.inventory || body.inventory.clinical_use !== 'PROHIBITED' || !Array.isArray(body.inventory.models) || body.inventory.models.some(model => !model || model.clinical_use !== 'PROHIBITED' || model.label_verification !== 'UNVERIFIED')) throw new Error('PRIVATE_WORKER_INVENTORY_REQUIRED');
  return body;
}
export function privatePath(path, { mustExist = true } = {}) {
  const absolute = resolve(path);
  const candidate = mustExist ? realpathSync(absolute) : resolve(realpathSync(dirname(absolute)), absolute.split('/').at(-1));
  const local = relative(repositoryRoot, candidate);
  const outsideRepository = local === '..' || local.startsWith('..' + sep) || isAbsolute(local);
  if (!outsideRepository) throw new Error('PRIVATE_FILE_MUST_BE_OUTSIDE_GIT');
  for (let ancestor = dirname(candidate);;) {
    if (existsSync(resolve(ancestor, '.git'))) throw new Error('PRIVATE_FILE_MUST_BE_OUTSIDE_GIT');
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  const directory = statSync(dirname(candidate));
  if ((directory.mode & 0o077) !== 0) throw new Error('PRIVATE_PARENT_DIRECTORY_MUST_BE_0700');
  if (mustExist && ((statSync(candidate).mode & 0o077) !== 0 || !statSync(candidate).isFile())) throw new Error('PRIVATE_FILE_MUST_BE_0600');
  return candidate;
}
export function readPrivateJson(path) { return JSON.parse(readFileSync(privatePath(path), 'utf8')); }
export function writeNewPrivate(path, value) {
  const target = privatePath(path, { mustExist: false });
  writeFileSync(target, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return target;
}
export function createPrivateDirectory(path) { mkdirSync(path, { recursive: true, mode: 0o700 }); privatePath(resolve(path, '.placeholder'), { mustExist: false }); }
export function assertInventoryEmpty(users, collectionIds, prefix) {
  if (collectionIds.length) throw new Error('FIRESTORE_DATABASE_NOT_EMPTY');
  if (users.some(user => !user.uid.startsWith(prefix + '-') || user.customClaims?.syntheticResearchIdentity !== true)) throw new Error('AUTH_INVENTORY_NOT_EMPTY_OR_APPROVED_SYNTHETIC');
}
export async function approvedFetch(plan, path, { token, protectionBypass, body, method = 'GET', fetcher = fetch } = {}) {
  if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('://')) throw new Error('API_PATH_REQUIRED');
  const response = await fetcher(new URL(path, plan.approved_origin).href, { method, redirect: 'error', signal: AbortSignal.timeout(90000), cache: 'no-store', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(protectionBypass ? { 'x-vercel-protection-bypass': protectionBypass } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const content = await response.text();
  if (content.length > 1000000) throw new Error('BOUNDED_API_RESPONSE_REQUIRED');
  let data; try { data = JSON.parse(content); } catch { data = null; }
  return { status: response.status, data };
}
