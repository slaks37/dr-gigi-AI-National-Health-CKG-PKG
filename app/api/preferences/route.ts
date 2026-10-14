import { api, readJson, onlyKeys, ApiError } from '@/src/server/security';
import { store } from '@/src/server/store';
export const GET = api(async (_req, p) => {
  const snap = await store().collection('preferences').doc(p.uid).get();
  return { success: true, preferences: snap.data() || { language: 'id', textSize: 'medium', highContrast: false } };
});
export const POST = api(async (req, p) => {
  const body = await readJson(req, 2048);
  onlyKeys(body, ['language', 'textSize', 'highContrast']);
  if (!['id', 'en'].includes(String(body.language)) || !['small', 'medium', 'large'].includes(String(body.textSize)) || typeof body.highContrast !== 'boolean') throw new ApiError(400, 'Invalid preferences');
  await store().collection('preferences').doc(p.uid).set(body);
  return { success: true, preferences: body, persistence: 'CONFIRMED' };
});
