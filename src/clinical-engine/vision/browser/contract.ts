// Browser research protocol: no clinical labels, records, uploads or cloud fallback.
export const BROWSER_MODEL = {
    id: 'intraoral-caries-detection-ynpy9-1-rfdetr-large-t1', version: 'dataset-v1-onnx-fp32',
    sha256: 'a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0', bytes: 121573930,
    side: 704, runtime: '1.30.0', cache: 'sonri-research-model-v1',
} as const;
export type Provider = 'auto' | 'webgpu' | 'wasm';
export type RawDetection = { class_id: number; raw_label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } };
export type Capabilities = { browser: string; mobile: boolean; webgpu: boolean; adapter: boolean; deviceMemoryGB: number | null; hardwareConcurrency: number; secure: boolean; wasm: boolean };
export function sufficientMemory(memoryGB: number | null) { return memoryGB === null || memoryGB >= 4; }
export function executionPlan(provider: Provider, gpu: boolean, memoryGB: number | null) {
    if (!sufficientMemory(memoryGB)) throw new Error('INSUFFICIENT_DEVICE_MEMORY');
    if (provider === 'webgpu') { if (!gpu) throw new Error('WEBGPU_UNAVAILABLE'); return ['webgpu'] as const; }
    if (provider === 'wasm') return ['wasm'] as const;
    return gpu ? ['webgpu', 'wasm'] as const : ['wasm'] as const;
}
export function normalizeRgb(rgb: Uint8Array, width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgb.length !== width * height * 3) throw new Error('INVALID_RGB');
    const side = BROWSER_MODEL.side, out = new Float32Array(side * side * 3), mean = [.485, .456, .406], std = [.229, .224, .225];
    for (let y = 0; y < side; y++) {
        const sy = Math.max(0, Math.fround(Math.fround(height / side) * (y + .5) - .5)), y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1), fy = sy - y0;
        for (let x = 0; x < side; x++) {
            const sx = Math.max(0, Math.fround(Math.fround(width / side) * (x + .5) - .5)), x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), fx = sx - x0;
            for (let c = 0; c < 3; c++) {
                const top = rgb[(y0 * width + x0) * 3 + c] * (1 - fx) + rgb[(y0 * width + x1) * 3 + c] * fx;
                const bottom = rgb[(y1 * width + x0) * 3 + c] * (1 - fx) + rgb[(y1 * width + x1) * 3 + c] * fx;
                out[c * side * side + y * side + x] = ((top * (1 - fy) + bottom * fy) / 255 - mean[c]) / std[c];
            }
        }
    }
    return out;
}
export function decode(boxes: Float32Array, logits: Float32Array, boxDims: readonly number[], logitDims: readonly number[]): RawDetection[] {
    if (boxDims.join() !== '1,300,4' || logitDims.join() !== '1,300,5' || boxes.length !== 1200 || logits.length !== 1500) throw new Error('INVALID_OUTPUT_SHAPE');
    if (!boxes.every(Number.isFinite) || !logits.every(Number.isFinite)) throw new Error('INVALID_MODEL_OUTPUT');
    const pairs = Array.from(logits, (v, i) => ({ score: 1 / (1 + Math.exp(-v)), class_id: i % 5, query: Math.floor(i / 5) })).sort((a, b) => b.score - a.score).slice(0, 300).filter(d => d.score > .25);
    if (pairs.length > 200) throw new Error('DETECTION_LIMIT');
    return pairs.map(d => {
        const [cx, cy, w, h] = boxes.slice(d.query * 4, d.query * 4 + 4);
        const box = { xmin: Math.max(0, cx - w / 2) * 1000, ymin: Math.max(0, cy - h / 2) * 1000, xmax: Math.min(1, cx + w / 2) * 1000, ymax: Math.min(1, cy + h / 2) * 1000 };
        if (w <= 0 || h <= 0 || box.xmin >= box.xmax || box.ymin >= box.ymax) throw new Error('INVALID_MODEL_OUTPUT');
        return { class_id: d.class_id, raw_label: `RAW_CLASS_${d.class_id}`, score: d.score, box };
    });
}
export async function verifyModel(bytes: Uint8Array) {
    if (bytes.byteLength !== BROWSER_MODEL.bytes) throw new Error('MODEL_SIZE_MISMATCH');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== BROWSER_MODEL.sha256) throw new Error('MODEL_CHECKSUM_MISMATCH');
    return hash;
}
export async function capabilities(): Promise<Capabilities> {
    const nav = navigator as Navigator & { deviceMemory?: number; gpu?: { requestAdapter: () => Promise<unknown> } };
    let adapter = false; try { adapter = !!(await nav.gpu?.requestAdapter()); } catch { /* unavailable device */ }
    return { browser: navigator.userAgent, mobile: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent), webgpu: !!nav.gpu, adapter, deviceMemoryGB: nav.deviceMemory ?? null, hardwareConcurrency: navigator.hardwareConcurrency || 1, secure: isSecureContext, wasm: typeof WebAssembly !== 'undefined' };
}
export type BrowserResult = {
    provider: 'webgpu' | 'wasm'; fallback_reason: string | null; model: typeof BROWSER_MODEL; fixture: string; width: number; height: number;
    detections: RawDetection[]; cache_status: string; model_read_ms: number; model_hash_ms: number; initialization_ms: number;
    preprocessing_ms: number; inference_ms: number; postprocessing_ms: number; total_ms: number;
    session_reused: boolean; preprocessing_max_absolute_diff: number; tensor_sha256: string; rgb_sha256: string;
    memory: { js_heap_bytes: number | null; peak_memory_bytes: null; note: string };
    clinical_use: 'PROHIBITED'; label_mapping_status: 'UNVERIFIED';
};
