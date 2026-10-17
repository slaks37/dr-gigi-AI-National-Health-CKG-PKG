import { api, readJson, onlyKeys } from '@/src/server/security';
import { store } from '@/src/server/store';
import { researchPreviewEnabled } from '@/src/server/research-preview';
export const POST = api(async (req, p) => {
  const body = await readJson(req, 4096);
  onlyKeys(body, []);
  if (researchPreviewEnabled()) return { success: true, user: { uid: p.uid, role: p.role }, profile_persisted: false, research_preview: true };
  // Roles are never read from user-editable profile documents.
  await store().collection('users').doc(p.uid).set({ uid: p.uid, email: p.email || null, lastActive: new Date().toISOString() }, { merge: true });
  return { success: true, user: { uid: p.uid, role: p.role } };
});
