import { api, readJson, onlyKeys, requireAdmin, ApiError } from '@/src/server/security';
import { store } from '@/src/server/store';
import { FieldValue } from 'firebase-admin/firestore';
export const POST = api(async (req, p) => {
  const body = await readJson(req, 2048);
  onlyKeys(body, ['module', 'action']);
  if (typeof body.module !== 'string' || typeof body.action !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.module) || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.action)) throw new ApiError(400, 'Invalid activity');
  // Client events cannot masquerade as authoritative clinical/audit events.
  await store().collection('clientEvents').add({ actorUid: p.uid, module: body.module, action: body.action, source: 'client-unverified', timestamp: FieldValue.serverTimestamp() });
  return { success: true };
});
export const GET = api(async (_req, p) => {
  requireAdmin(p);
  const logs = await store().collection('auditLogs').orderBy('timestamp', 'desc').limit(100).get();
  return { success: true, logs: logs.docs.map(d => d.data()) };
});
