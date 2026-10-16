import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { cloudResearchConfigured, cloudResearchInference, normalizeRgb, CLOUD_MODEL_SHA } from '../src/clinical-engine/vision/adapters/neon-research';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('requires an HTTPS Neon origin and private secret', () => {
    vi.stubEnv('SONRI_CLOUD_FUNCTION_URL', 'https://evil.example/'); vi.stubEnv('SONRI_CLOUD_ORIGIN_SECRET', 's'.repeat(40)); expect(cloudResearchConfigured()).toBe(false);
    vi.stubEnv('SONRI_CLOUD_FUNCTION_URL', 'https://synthetic.aws.neon.tech/'); expect(cloudResearchConfigured()).toBe(true);
    vi.stubEnv('SONRI_CLOUD_FUNCTION_URL', 'https://synthetic.aws.neon.tech/?token=secret'); expect(cloudResearchConfigured()).toBe(false);
});
it('normalizes RGB planes in NCHW little-endian without swapping channels', () => {
    const tensor = normalizeRgb(Uint8Array.from([255, 0, 128]), 1, 1); expect(tensor.length).toBe(3 * 704 * 704 * 4);
    expect(tensor.readFloatLE(0)).toBeCloseTo((1 - .485) / .229, 5);
    expect(tensor.readFloatLE(704 * 704 * 4)).toBeCloseTo(-.456 / .224, 5);
    expect(tensor.readFloatLE(2 * 704 * 704 * 4)).toBeCloseTo((128 / 255 - .406) / .225, 5);
});
it('sends the tensor only to configured cloud and rejects changed provenance', async () => {
    vi.stubEnv('SONRI_CLOUD_FUNCTION_URL', 'https://synthetic.aws.neon.tech/'); vi.stubEnv('SONRI_CLOUD_ORIGIN_SECRET', 's'.repeat(40));
    const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#abcdef' } }).png().toBuffer();
    let corrupt = false;
    const fetcher = vi.fn(async (_url, init) => {
        const request = JSON.parse(init.body); expect(request.cloud_processing_authorized).toBe(true); expect(init.redirect).toBe('error');
        const tensor = gunzipSync(Buffer.from(request.tensor_gzip_base64, 'base64'));
        return Response.json({ success: true, runtime: 'NEON_WASM_CPU', clinical_use: 'PROHIBITED', label_mapping_status: 'UNVERIFIED', input_tensor_sha256: createHash('sha256').update(tensor).digest('hex'), prediction: { model_id: 'intraoral-caries-detection-ynpy9-1-rfdetr-large-t1', model_version: 'dataset-v1-onnx-fp32', artifact_sha256: corrupt ? '0'.repeat(64) : CLOUD_MODEL_SHA, image_sha256: request.image_sha256, input_modality: 'INTRAORAL_PHOTO', prediction_type: 'BOUNDING_BOX', processing_ms: 1, inference_status: 'SUCCEEDED', readiness: 'EXPERIMENTAL', detections: [] } });
    });
    vi.stubGlobal('fetch', fetcher);
    expect((await cloudResearchInference(image)).readiness).toBe('EXPERIMENTAL'); corrupt = true;
    await expect(cloudResearchInference(image)).rejects.toThrow('provenance mismatch');
});
