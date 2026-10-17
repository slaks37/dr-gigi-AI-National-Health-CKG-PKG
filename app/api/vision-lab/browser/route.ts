import { z } from 'zod';
import { api, readJson, requireAdmin } from '@/src/server/security';
import { parse } from '@/src/clinical-engine/validation/parse';
export const runtime = 'nodejs';
const Permission = z.strictObject({ research_authorized: z.literal(true), synthetic_only: z.literal(true) });
export const POST = api(async (request, principal) => {
    requireAdmin(principal);
    parse(Permission, await readJson(request, 1024));
    // No model credentials/URLs, image uploads, prediction acceptance or patient writes.
    return { success: true, experiment: 'BROWSER_AI', artifacts: 'LOCAL_FILE_ONLY', fixture_policy: 'SYNTHETIC_ONLY', clinical_use: 'PROHIBITED' };
});
