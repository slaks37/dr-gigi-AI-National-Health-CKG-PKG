import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_MODEL, decode, executionPlan, normalizeRgb, verifyModel } from '../src/clinical-engine/vision/browser/contract';
import { BrowserResearchClient } from '../src/clinical-engine/vision/browser/client';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import manifest from '../public/research-fixtures/sonri-v1/manifest.json';
import reference from './fixtures/browser-preprocess.json';
import { ScreeningRequestSchema, SymptomsSchema } from '../src/clinical-engine/types/schema';
const floats = () => ({ boxes: new Float32Array(1200).fill(.5), logits: new Float32Array(1500).fill(-100) });
describe('browser research contract', () => {
    it('matches independently generated PyTorch non-square bilinear fixture', () => {
        const tensor = normalizeRgb(Uint8Array.from(reference.rgb), reference.width, reference.height);
        expect(tensor.length).toBe(3 * 704 * 704); reference.indices.forEach((index, i) => expect(Math.abs(tensor[index] - reference.values[i])).toBeLessThan(reference.tolerance));
    });
    it('matches PyTorch probes for all four full-resolution synthetic fixtures', async () => {
        for (const [name, entry] of Object.entries(manifest)) {
            const { data, info } = await sharp(await readFile(`public/research-fixtures/sonri-v1/${name}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
            const tensor = normalizeRgb(data, info.width, info.height);
            entry.tensor_reference.indices.forEach((index, i) => expect(Math.abs(tensor[index] - entry.tensor_reference.values[i])).toBeLessThan(.000001));
        }
    });
    it('checks memory before considering GPU, and makes fallback explicit', () => {
        expect(() => executionPlan('auto', true, 2)).toThrow('INSUFFICIENT_DEVICE_MEMORY');
        expect(executionPlan('auto', true, 8)).toEqual(['webgpu', 'wasm']); expect(executionPlan('auto', false, null)).toEqual(['wasm']);
        expect(() => executionPlan('webgpu', false, 8)).toThrow('WEBGPU_UNAVAILABLE'); expect(executionPlan('wasm', true, 8)).toEqual(['wasm']);
    });
    it('preserves all five raw slots and validates shapes/finite values/boxes', () => {
        const { boxes, logits } = floats(); logits[4] = 2; expect(decode(boxes, logits, [1, 300, 4], [1, 300, 5])[0].raw_label).toBe('RAW_CLASS_4');
        expect(() => decode(boxes, logits, [1, 4, 300], [1, 300, 5])).toThrow('INVALID_OUTPUT_SHAPE');
        logits[0] = NaN; expect(() => decode(boxes, logits, [1, 300, 4], [1, 300, 5])).toThrow('INVALID_MODEL_OUTPUT'); logits[0] = -100;
        boxes[2] = -1; expect(() => decode(boxes, logits, [1, 300, 4], [1, 300, 5])).toThrow('INVALID_MODEL_OUTPUT');
    });
    it('rejects missing/truncated and checksum-mismatched model artifacts', async () => {
        await expect(verifyModel(new Uint8Array(4))).rejects.toThrow('MODEL_SIZE_MISMATCH');
        vi.stubGlobal('crypto', { subtle: { digest: async () => new Uint8Array(32).buffer } });
        await expect(verifyModel({ byteLength: BROWSER_MODEL.bytes } as Uint8Array)).rejects.toThrow('MODEL_CHECKSUM_MISMATCH'); vi.unstubAllGlobals();
    });
    it('never accepts browser predictions as clinical detector or confirmation input', () => {
        const input = { screening_id: 'synthetic', context: 'ADULT', patient_age: 30, symptoms: SymptomsSchema.parse({}), images: [], consent_to_process: true };
        for (const field of ['browser_prediction', 'prediction', 'visual_findings', 'confirmed_icd10']) expect(ScreeningRequestSchema.safeParse({ ...input, [field]: [] }).success).toBe(false);
    });
});
class FakeWorker {
    static latest: FakeWorker; static total = 0; terminated = false; onmessage: ((event: { data: unknown }) => void) | null = null; onerror: (() => void) | null = null;
    constructor() { FakeWorker.latest = this; FakeWorker.total++; }
    postMessage() { /* transport only */ }
    terminate() { this.terminated = true; }
}
describe('interruptible browser worker lifecycle', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker); });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
    const input = { provider: 'wasm' as const, allowFallback: false, cacheModel: false, fixture: 'shapes' };
    it('blocks duplicate clicks and terminates on timeout without returning predictions', async () => {
        const client = new BrowserResearchClient(), pending = client.run(input, () => {});
        const rejection = expect(pending).rejects.toThrow('INFERENCE_TIMEOUT'); await expect(client.run(input, () => {})).rejects.toThrow('DUPLICATE_REQUEST');
        await vi.advanceTimersByTimeAsync(120001); await rejection; expect(FakeWorker.latest.terminated).toBe(true);
    });
    it('cancels a pending inference and discards late responses', async () => {
        const client = new BrowserResearchClient(), pending = client.run(input, () => {}), rejected = expect(pending).rejects.toThrow('CANCELLED');
        client.dispose(); await rejected; expect(FakeWorker.latest.terminated).toBe(true);
    });
    it('releases a broken worker and reuses a successful worker between runs', async () => {
        const client = new BrowserResearchClient(), first = client.run(input, () => {}); const worker = FakeWorker.latest;
        worker.onmessage?.({ data: { id: 1, type: 'result', result: { detections: [] } } }); await first;
        const second = client.run(input, () => {}); expect(FakeWorker.latest).toBe(worker);
        const rejected = expect(second).rejects.toThrow('BROWSER_WORKER_FAILED'); worker.onerror?.(); await rejected; expect(worker.terminated).toBe(true);
    });
});
