import { api, requireAdmin } from '@/src/server/security';
import { modelInventory } from '@/src/server/inference-client';
export const GET = api(async (_req, p) => {
  requireAdmin(p);
  return { success: true, inventory: await modelInventory() };
});
