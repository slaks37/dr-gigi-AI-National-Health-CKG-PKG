import 'server-only';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { ResearchPredictionSchema } from './research';
const SIDE = 704;
export const CLOUD_MODEL_SHA = 'a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0';
function cloudUrl() {
    const value = process.env.SONRI_CLOUD_FUNCTION_URL;
    if (!value) throw new Error('Cloud research runtime not configured');
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.aws.neon.tech') || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid cloud research origin');
    return url;
}
export function cloudResearchConfigured() {
    try { cloudUrl(); return (process.env.SONRI_CLOUD_ORIGIN_SECRET?.length ?? 0) >= 32; } catch { return false; }
}
// torchvision tensor resize: bilinear, half-pixel centers, antialias=false.
export function normalizeRgb(rgb: Uint8Array, width: number, height: number) {
    if (rgb.length !== width * height * 3 || width < 1 || height < 1) throw new Error('Invalid RGB image');
    const out = Buffer.alloc(SIDE * SIDE * 3 * 4), means = [.485, .456, .406], std = [.229, .224, .225];
    for (let y = 0; y < SIDE; y++) {
        const sy = Math.max(0, (y + .5) * height / SIDE - .5), y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1), fy = sy - y0;
        for (let x = 0; x < SIDE; x++) {
            const sx = Math.max(0, (x + .5) * width / SIDE - .5), x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), fx = sx - x0;
            for (let c = 0; c < 3; c++) {
                const top = rgb[(y0 * width + x0) * 3 + c] * (1 - fx) + rgb[(y0 * width + x1) * 3 + c] * fx;
                const bottom = rgb[(y1 * width + x0) * 3 + c] * (1 - fx) + rgb[(y1 * width + x1) * 3 + c] * fx;
                out.writeFloatLE(((top * (1 - fy) + bottom * fy) / 255 - means[c]) / std[c], (c * SIDE * SIDE + y * SIDE + x) * 4);
            }
        }
    }
    return out;
}
export async function cloudResearchInference(image: Uint8Array, signal?: AbortSignal) {
    if (!cloudResearchConfigured()) throw new Error('Cloud research runtime not configured');
    const { data, info } = await sharp(image).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const tensor = normalizeRgb(data, info.width, info.height), imageHash = createHash('sha256').update(image).digest('hex');
    const res = await fetch(new URL('infer', cloudUrl()), { method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000), headers: { 'Content-Type': 'application/json', 'x-sonri-secret': process.env.SONRI_CLOUD_ORIGIN_SECRET! }, body: JSON.stringify({ tensor_gzip_base64: gzipSync(tensor).toString('base64'), image_sha256: imageHash, cloud_processing_authorized: true }) });
    if (!res.ok || !res.body) throw new Error('Cloud research inference unavailable');
    const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 200000) { await reader.cancel(); throw new Error('Cloud prediction size limit'); } chunks.push(value); } } finally { reader.releaseLock(); }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const prediction = ResearchPredictionSchema.parse(result.prediction);
    if (result.success !== true || result.runtime !== 'NEON_WASM_CPU' || result.clinical_use !== 'PROHIBITED' || result.label_mapping_status !== 'UNVERIFIED' || result.input_tensor_sha256 !== createHash('sha256').update(tensor).digest('hex') || prediction.image_sha256 !== imageHash || prediction.artifact_sha256 !== CLOUD_MODEL_SHA || prediction.model_id !== 'intraoral-caries-detection-ynpy9-1-rfdetr-large-t1' || prediction.model_version !== 'dataset-v1-onnx-fp32' || prediction.detections.some(d => d.class_id > 4 || d.raw_label !== `RAW_CLASS_${d.class_id}`)) throw new Error('Cloud research provenance mismatch');
    return prediction;
}
