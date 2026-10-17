import { z } from 'zod';
import { api, ApiError, readJson, requireAdmin } from '@/src/server/security';
import { MODULES } from '@/src/clinical-engine/modules/catalog';
import { installedModels } from '@/src/clinical-engine/vision/registry';
import { terminologyCoverage } from '@/src/clinical-engine/terminology/coverage';
import { ImageInputSchema } from '@/src/clinical-engine/types/schema';
import { validateImage } from '@/src/clinical-engine/core/image-quality';
import { localResearchConfigured, localResearchInference } from '@/src/clinical-engine/vision/adapters/local-research';
import { cloudResearchConfigured, cloudResearchInference } from '@/src/clinical-engine/vision/adapters/neon-research';
import { parse } from '@/src/clinical-engine/validation/parse';
export const runtime = 'nodejs';
export const maxDuration = 120;
// In-process limits supplement admin authentication; each local worker admits one model run.
let running = false;
const attempts = new Map<string, number[]>();
const RequestSchema = z.strictObject({ image: ImageInputSchema, image_use_authorized: z.literal(true), runtime: z.enum(['LOCAL', 'NEON_CLOUD']).default('LOCAL'), cloud_processing_authorized: z.boolean().optional() });
export const GET = api(async (_req, p) => {
    requireAdmin(p);
    return { success: true, modules: MODULES.map(m => ({ ...m, readiness: m.id === 'CARIES' ? 'INFERENCE_TESTED' : 'ARCHITECTURE_READY', model_status: m.id === 'CARIES' ? 'RESEARCH_ONLY' : 'UNAVAILABLE' })), models: installedModels, research_artifacts: [{ model_id: 'intraoral-caries-detection-ynpy9-1-rfdetr-large-t1', version: 'dataset-v1', license: 'Apache-2.0', artifact_sha256: '9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c', runtime_test: 'SYNTHETIC_INPUT_ONLY', clinical_approval: 'PENDING' }], coverage: terminologyCoverage(), metrics: null, clinical_approval: 'PENDING', cloud_inference_status: cloudResearchConfigured() ? 'NEON_RESEARCH_CONFIGURED' : 'NOT_CONFIGURED', label_mapping_status: 'UNVERIFIED', inference_status: localResearchConfigured() ? 'LOCAL_RESEARCH_CONFIGURED' : 'NOT_CONFIGURED' };
});
export const POST = api(async (req, p) => {
    requireAdmin(p);
    const now = Date.now();
    for (const [uid, rows] of attempts)
        if (!rows.some(t => t > now - 60000))
            attempts.delete(uid);
    const recent = (attempts.get(p.uid) ?? []).filter(t => t > now - 60000);
    if (recent.length >= 5 || (!attempts.has(p.uid) && attempts.size >= 1000))
        throw new ApiError(429, 'Research rate limit exceeded');
    attempts.set(p.uid, [...recent, now]);
    const input = parse(RequestSchema, await readJson(req, 4100000));
    const cloud = input.runtime === 'NEON_CLOUD';
    if (cloud && input.cloud_processing_authorized !== true) throw new ApiError(400, 'Explicit Neon cloud processing authorization required');
    if (cloud ? !cloudResearchConfigured() : !localResearchConfigured())
        throw new ApiError(503, 'Requested research runtime not configured');
    if (running)
        throw new ApiError(429, 'Research worker busy');
    running = true;
    try {
        const prepared = await validateImage(input.image, 0);
        if (!prepared.normalized)
            throw new ApiError(400, 'Invalid or unsupported image');
        const prediction = await (cloud ? cloudResearchInference : localResearchInference)(prepared.normalized, req.signal);
        return { success: true, runtime: input.runtime, label_mapping_status: 'UNVERIFIED', prediction, image_quality: prepared.quality, normalized_image: { mime_type: 'image/jpeg', data: Buffer.from(prepared.normalized).toString('base64') }, clinical_use: 'PROHIBITED', oral_region_status: 'NOT_ASSESSED', source_images_retained: false };
    }
    finally {
        running = false;
    }
});
