import 'server-only';
import { ApiError } from './security';
import { z } from 'zod';
import { inferenceHeaders } from './inference-auth';

export const LabInputSchema = z.strictObject({
  model_id: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/),
  modality: z.enum(['intraoral', 'panoramic', 'cbct']),
  synthetic_fixture: z.literal(true), research_opt_in: z.literal(true),
  mime_type: z.enum(['image/png', 'image/jpeg']),
  data: z.string().max(3_600_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
const InventorySchema = z.object({
  schema_version: z.string().max(20), clinical_use: z.literal('PROHIBITED'),
  models: z.array(z.object({
    id: z.string().min(1).max(100), version: z.string().max(200),
    modality: z.enum(['intraoral', 'panoramic', 'cbct']), available: z.boolean(),
    reason: z.string().max(500).nullable(), architecture: z.string().max(200),
    clinical_use: z.literal('PROHIBITED'), label_verification: z.literal('UNVERIFIED'),
    runtime_status: z.enum(['NOT_PROBED', 'EXECUTED', 'FAILED']).optional(),
  })).max(30),
});
const ResearchResultSchema = z.object({
  request_id: z.string().min(1).max(128), status: z.literal('completed'),
  model_id: z.string().min(1).max(100), model_version: z.string().min(1).max(200),
  model_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  modality: z.enum(['intraoral', 'panoramic', 'cbct']),
  clinical_use: z.literal('PROHIBITED'), label_verification: z.literal('UNVERIFIED'),
  findings: z.array(z.object({
    kind: z.enum(['detection', 'classification', 'segmentation_area']),
    class_id: z.number().int().nonnegative(), raw_label: z.string().max(100), score: z.number().min(0).max(1),
    box: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]).nullable().optional(),
    area_fraction: z.number().min(0).max(1).optional(),
  }).superRefine((f, ctx) => {
    if (f.kind === 'detection' && (!f.box || f.box[0] >= f.box[2] || f.box[1] >= f.box[3])) ctx.addIssue({ code: 'custom', message: 'Detection requires a positive-area bounding box' });
    if (f.kind === 'segmentation_area' && f.area_fraction === undefined) ctx.addIssue({ code: 'custom', message: 'Segmentation requires area fraction' });
  })).max(1000),
  quality: z.record(z.string(), z.unknown()), latency_ms: z.number().nonnegative(), warnings: z.array(z.string().max(500)).max(30),
});
async function boundedJson(response: Response) {
  if (!response.body) throw new Error('empty upstream');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 500_000) { await reader.cancel(); throw new Error('upstream too large'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}
function serviceConfig() {
  const base = process.env.SONRI_INFERENCE_URL;
  const token = process.env.SONRI_INFERENCE_TOKEN;
  if (!base || !token) throw new ApiError(503, 'INFERENCE_NOT_CONFIGURED');
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', 'inference'].includes(url.hostname)))) throw new ApiError(503, 'Invalid inference configuration');
  return { base: base.replace(/\/$/, ''), token };
}
export async function modelInventory() {
  const { base, token } = serviceConfig();
  try {
    const response = await fetch(`${base}/v1/models`, { headers: await inferenceHeaders(base, token), signal: AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('upstream');
    return InventorySchema.parse(await boundedJson(response));
  } catch { throw new ApiError(503, 'Inference inventory unavailable'); }
}
export async function researchInference(input: z.infer<typeof LabInputSchema>) {
  const { base, token } = serviceConfig();
  const form = new FormData();
  form.set('model_id', input.model_id); form.set('modality', input.modality);
  form.set('research_opt_in', 'true');
  form.set('file', new Blob([Buffer.from(input.data, 'base64')], { type: input.mime_type }), 'synthetic-fixture');
  try {
    const response = await fetch(`${base}/v1/infer`, { method: 'POST', body: form, headers: await inferenceHeaders(base, token), signal: AbortSignal.timeout(60_000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('upstream');
    const body = ResearchResultSchema.parse(await boundedJson(response));
    // A research response can never be promoted to a clinical observation.
    if (body.model_id !== input.model_id || body.modality !== input.modality) throw new Error('contract');
    return body;
  } catch { throw new ApiError(503, 'Inference failed or unavailable; no result has been saved'); }
}
