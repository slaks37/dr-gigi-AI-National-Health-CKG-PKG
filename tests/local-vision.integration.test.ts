import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { localResearchInference } from '../src/clinical-engine/vision/adapters/local-research';
describe.skipIf(process.env.SONRI_LOCAL_MODEL_TEST !== '1')('real locally downloaded SONRI checkpoint; synthetic image only', () => {
    it('loads the actual model offline and returns real normalized output with image/artifact provenance', async () => {
        const bytes = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#eeeeee' } }).jpeg().toBuffer();
        const result = await localResearchInference(bytes);
        expect(result.artifact_sha256).toBe('9b4f611126aade449a3086cc8277831e309dfab0b6ff751a96c9af94ed69020c');
        expect(result.image_sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
        expect(result.inference_status).toBe('SUCCEEDED');
        expect(result.readiness).toBe('EXPERIMENTAL');
        expect(result.processing_ms).toBeGreaterThan(0);
        expect(Array.isArray(result.detections)).toBe(true);
    }, 110000);
});
