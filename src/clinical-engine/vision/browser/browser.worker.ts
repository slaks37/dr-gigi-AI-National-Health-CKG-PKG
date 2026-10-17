import { BROWSER_MODEL, capabilities, decode, executionPlan, normalizeRgb, verifyModel, type BrowserResult, type Provider } from './contract';
import type * as Ort from 'onnxruntime-web';
type Command = { id: number; action: 'run'; file?: File; provider: Provider; allowFallback: boolean; cacheModel: boolean; fixture: 'shapes' | 'flat' | 'noise' | 'gradient' };
let session: Ort.InferenceSession | null = null, ort: typeof Ort | null = null, selected: 'webgpu' | 'wasm' | null = null, busy = false;
const cacheKey = () => new URL(`/__sonri-model-cache/${BROWSER_MODEL.sha256}`, self.location.origin).href;
const sha = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), b => b.toString(16).padStart(2, '0')).join('');
const publish = (id: number, state: string, extra = {}) => self.postMessage({ id, type: 'status', state, ...extra });
async function model(command: Command) {
    let bytes: Uint8Array, cacheStatus = 'DISABLED'; const start = performance.now();
    const cache = command.cacheModel && 'caches' in self ? await caches.open(BROWSER_MODEL.cache).catch(() => null) : null;
    if (command.file) {
        if (command.file.size !== BROWSER_MODEL.bytes) throw new Error('MODEL_SIZE_MISMATCH');
        publish(command.id, 'READING_LOCAL_MODEL', { loaded: 0, total: command.file.size });
        bytes = new Uint8Array(command.file.size); const reader = command.file.stream().getReader(); let offset = 0, lastProgress = 0;
        try { while (true) { const { value, done } = await reader.read(); if (done) break; bytes.set(value, offset); offset += value.length; if (offset - lastProgress >= 4_000_000 || offset === command.file.size) { publish(command.id, 'READING_LOCAL_MODEL', { loaded: offset, total: command.file.size }); lastProgress = offset; } } } finally { reader.releaseLock(); }
    } else {
        const cached = await cache?.match(cacheKey());
        if (!cached || cached.headers.get('Content-Length') !== String(BROWSER_MODEL.bytes)) { if (cached) await cache?.delete(cacheKey()); throw new Error('LOCAL_MODEL_REQUIRED'); }
        if (!cached.body) throw new Error('LOCAL_MODEL_REQUIRED');
        bytes = new Uint8Array(BROWSER_MODEL.bytes); const reader = cached.body.getReader(); let offset = 0;
        try { while (true) { const { value, done } = await reader.read(); if (done) break; if (offset + value.length > bytes.length) { await reader.cancel(); throw new Error('MODEL_SIZE_MISMATCH'); } bytes.set(value, offset); offset += value.length; } if (offset !== bytes.length) throw new Error('MODEL_SIZE_MISMATCH'); }
        catch (error) { await cache?.delete(cacheKey()); throw error; } finally { reader.releaseLock(); }
        cacheStatus = 'HIT_UNVERIFIED'; publish(command.id, 'VERIFYING_CACHE');
    }
    const readMs = performance.now() - start, hashStart = performance.now();
    try { await verifyModel(bytes); } catch (e) { await cache?.delete(cacheKey()); throw e; }
    const hashMs = performance.now() - hashStart;
    if (cacheStatus === 'HIT_UNVERIFIED') cacheStatus = 'HIT_VERIFIED';
    else if (cache) {
        try { await cache.put(cacheKey(), new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { 'Content-Length': String(bytes.byteLength), 'Content-Type': 'application/octet-stream' } })); cacheStatus = 'STORED_VERIFIED'; }
        catch { cacheStatus = 'QUOTA_OR_STORAGE_UNAVAILABLE'; }
    } else if (command.cacheModel) cacheStatus = 'STORAGE_UNAVAILABLE';
    return { bytes, cacheStatus, readMs, hashMs };
}
async function fixture(name: Command['fixture']) {
    if (!['shapes', 'flat', 'noise', 'gradient'].includes(name)) throw new Error('INVALID_FIXTURE');
    const res = await fetch(`/research-fixtures/sonri-v1/${name}.png`, { cache: 'no-store', redirect: 'error' });
    if (!res.ok) throw new Error('FIXTURE_ASSET_UNAVAILABLE');
    const blob = await res.blob();
    const references = await fetch('/research-fixtures/sonri-v1/manifest.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('FIXTURE_REFERENCE_UNAVAILABLE'); return r.json(); });
    const reference = references[name];
    if (!reference || await sha(new Uint8Array(await blob.arrayBuffer())) !== reference.sha256) throw new Error('FIXTURE_CHECKSUM_MISMATCH');
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    try {
        const { width, height } = bitmap; const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx || width > 1024 || height > 1024) throw new Error('IMAGE_DECODER_UNAVAILABLE');
        ctx.drawImage(bitmap, 0, 0); const rgba = ctx.getImageData(0, 0, width, height).data, rgb = new Uint8Array(width * height * 3);
        for (let i = 0; i < width * height; i++) { rgb[i * 3] = rgba[i * 4]; rgb[i * 3 + 1] = rgba[i * 4 + 1]; rgb[i * 3 + 2] = rgba[i * 4 + 2]; }
        canvas.width = canvas.height = 1; return { rgb, width, height, reference };
    } finally { bitmap.close(); }
}
async function run(command: Command): Promise<BrowserResult> {
    const totalStart = performance.now(), cap = await capabilities();
    if (!cap.secure || !cap.wasm || typeof OffscreenCanvas === 'undefined') throw new Error('BROWSER_UNSUPPORTED');
    const plan = executionPlan(command.provider, cap.adapter, cap.deviceMemoryGB);
    let reused = !!session && (command.provider === 'auto' || command.provider === selected), cacheStatus = 'SESSION_REUSED', readMs = 0, hashMs = 0, initializationMs = 0, fallbackReason: string | null = null;
    if (!reused) {
        if (session) { await session.release(); session = null; selected = null; }
        const loaded = await model(command); cacheStatus = loaded.cacheStatus; readMs = loaded.readMs; hashMs = loaded.hashMs;
        // Load only after deliberate interaction, inside the worker. Never imported during SSR.
        if (!ort) { const runtimePath = '/ort/1.30.0/ort.webgpu.bundle.min.mjs'; ort = await import(/* webpackIgnore: true */ runtimePath) as typeof Ort; ort.env.wasm.numThreads = 1; ort.env.wasm.wasmPaths = new URL('/ort/1.30.0/', self.location.origin).href; ort.env.wasm.proxy = false; }
        const initStart = performance.now();
        for (const provider of plan) {
            if (provider === 'wasm' && fallbackReason && !command.allowFallback) throw new Error('WEBGPU_INITIALIZATION_FAILED');
            publish(command.id, `INITIALIZING_${provider.toUpperCase()}`);
            try {
                session = await ort.InferenceSession.create(loaded.bytes, { executionProviders: [provider], graphOptimizationLevel: 'all' }); selected = provider; break;
            } catch (error) {
                // Memory failure must not trigger another expensive allocation.
                if (/memory|allocation|out of bounds/i.test(String(error))) throw new Error('RESOURCE_LIMIT');
                if (provider !== 'webgpu') throw new Error('WASM_INITIALIZATION_FAILED');
                fallbackReason = 'WEBGPU_INITIALIZATION_FAILED';
            }
        }
        initializationMs = performance.now() - initStart;
        if (!session || !selected) throw new Error(fallbackReason || 'INITIALIZATION_FAILED');
        if (session.inputNames.join() !== 'input' || session.outputNames.join() !== 'dets,labels') { await session.release(); session = null; throw new Error('MODEL_SCHEMA_MISMATCH'); }
    }
    if (!session || !ort || !selected) throw new Error('INITIALIZATION_FAILED');
    publish(command.id, 'PREPROCESSING_SYNTHETIC_FIXTURE'); const preStart = performance.now();
    const image = await fixture(command.fixture), values = normalizeRgb(image.rgb, image.width, image.height);
    const rgbHash = await sha(image.rgb), tensorHash = await sha(new Uint8Array(values.buffer));
    if (rgbHash !== image.reference.rgb_sha256) throw new Error('FIXTURE_RGB_MISMATCH');
    let maxTensorDiff = 0;
    image.reference.tensor_reference.indices.forEach((index: number, i: number) => { maxTensorDiff = Math.max(maxTensorDiff, Math.abs(values[index] - image.reference.tensor_reference.values[i])); });
    if (!Number.isFinite(maxTensorDiff) || maxTensorDiff > .0001) throw new Error('PREPROCESSING_PARITY_FAILED');
    const preprocessingMs = performance.now() - preStart;
    publish(command.id, 'RUNNING_INFERENCE'); const tensor = new ort.Tensor('float32', values, [1, 3, 704, 704]); let outputs: Ort.InferenceSession.OnnxValueMapType | null = null;
    try {
        const inferenceStart = performance.now(); outputs = await session.run({ input: tensor }); const inferenceMs = performance.now() - inferenceStart;
        const postStart = performance.now();
        if (!(outputs.dets?.data instanceof Float32Array) || !(outputs.labels?.data instanceof Float32Array)) throw new Error('INVALID_OUTPUT_TYPE');
        const detections = decode(outputs.dets.data, outputs.labels.data, outputs.dets.dims, outputs.labels.dims);
        const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
        return { provider: selected, fallback_reason: fallbackReason, model: BROWSER_MODEL, fixture: command.fixture, width: image.width, height: image.height, detections, cache_status: cacheStatus, model_read_ms: readMs, model_hash_ms: hashMs, initialization_ms: initializationMs, preprocessing_ms: preprocessingMs, inference_ms: inferenceMs, postprocessing_ms: performance.now() - postStart, total_ms: performance.now() - totalStart, session_reused: reused, preprocessing_max_absolute_diff: maxTensorDiff, rgb_sha256: rgbHash, tensor_sha256: tensorHash, memory: { js_heap_bytes: perf.memory?.usedJSHeapSize ?? null, peak_memory_bytes: null, note: 'Peak GPU/WASM/process memory cannot be measured by this browser API. JS heap sample only, when available.' }, clinical_use: 'PROHIBITED', label_mapping_status: 'UNVERIFIED' };
    } finally { tensor.dispose(); if (outputs) for (const value of Object.values(outputs)) if ('dispose' in value) value.dispose(); }
}
self.onmessage = async (event: MessageEvent<Command | { id: number; action: 'clear-cache' }>) => {
    const command = event.data;
    if (busy) { self.postMessage({ id: command.id, type: 'error', error: 'WORKER_BUSY' }); return; }
    busy = true;
    try {
        if (command.action === 'clear-cache') { if ('caches' in self) await caches.delete(BROWSER_MODEL.cache); self.postMessage({ id: command.id, type: 'cleared' }); }
        else { const result = await run(command); self.postMessage({ id: command.id, type: 'result', result }); }
    } catch (error) {
        const message = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'BROWSER_INFERENCE_FAILED';
        // Broken sessions are not reused after failure; caller terminates the worker.
        self.postMessage({ id: command.id, type: 'error', error: message });
    } finally { busy = false; }
};
