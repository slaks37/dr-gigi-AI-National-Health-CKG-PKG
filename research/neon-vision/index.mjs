import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import * as ort from './ort.wasm.bundle.min.mjs';

const MODEL_ID = 'intraoral-caries-detection-ynpy9-1-rfdetr-large-t1';
const MODEL_VERSION = 'dataset-v1-onnx-fp32';
const SIDE = 704, TENSOR_BYTES = 3 * SIDE * SIDE * 4;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const response = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });
let sessionPromise, busy = false, ready = false;
const calls = [];

export function authorized(request, secret = process.env.ORIGIN_SECRET) {
  if (!secret || secret.length < 32) return false;
  const given = Buffer.from(request.headers.get('x-sonri-secret') || '');
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function readBoundedJson(request, max = 8_500_000) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new Error('INVALID_REQUEST');
  if (Number(request.headers.get('content-length') || 0) > max || !request.body) throw new Error('INVALID_REQUEST');
  const reader = request.body.getReader(); let total = 0; const chunks = [];
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > max) { await reader.cancel(); throw new Error('INVALID_REQUEST'); } chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { reader.releaseLock(); }
}

async function download(key, expectedHash, maxBytes) {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  if (!endpoint || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) throw new Error('STORAGE_CONFIGURATION_MISSING');
  const url = new URL(`${endpoint.replace(/\/$/, '')}/${process.env.MODEL_BUCKET}/${key}`);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.neon.tech')) throw new Error('INVALID_STORAGE_ORIGIN');
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = stamp.slice(0, 8), region = process.env.AWS_REGION || 'us-east-1';
  const emptyHash = hash('');
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${stamp}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = ['GET', url.pathname, '', canonicalHeaders, signedHeaders, emptyHash].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  const key1 = hmac(`AWS4${process.env.AWS_SECRET_ACCESS_KEY}`, date);
  const key2 = hmac(key1, region), key3 = hmac(key2, 's3'), key4 = hmac(key3, 'aws4_request');
  const signature = createHmac('sha256', key4).update(`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${hash(canonical)}`).digest('hex');
  const result = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60_000), headers: { 'x-amz-date': stamp, 'x-amz-content-sha256': emptyHash, Authorization: `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` } });
  if (!result.ok || !result.body || Number(result.headers.get('content-length') || 0) > maxBytes) throw new Error(`ARTIFACT_DOWNLOAD_${result.status}`);
  const reader = result.body.getReader(); const chunks = []; let total = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; total += value.length; if (total > maxBytes) { await reader.cancel(); throw new Error('ARTIFACT_SIZE_LIMIT'); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (hash(bytes) !== expectedHash) throw new Error('ARTIFACT_CHECKSUM_MISMATCH');
  return bytes;
}

async function getSession() {
  if (!sessionPromise) sessionPromise = (async () => {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmBinary = await download(process.env.WASM_KEY, process.env.WASM_SHA256, 20_000_000);
    ort.env.wasm.wasmPaths = { mjs: new URL('./ort-wasm-simd-threaded.mjs', import.meta.url).href };
    const model = await download(process.env.MODEL_KEY, process.env.MODEL_SHA256, 140_000_000);
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    if (session.inputNames.join() !== 'input' || !session.outputNames.includes('dets') || !session.outputNames.includes('labels')) throw new Error('MODEL_SCHEMA_MISMATCH');
    ready = true; return session;
  })().catch(error => { sessionPromise = undefined; ready = false; throw error; });
  return sessionPromise;
}

export function decode(boxes, logits, threshold = 0.25) {
  if (boxes.length !== 1200 || logits.length !== 1500) throw new Error('MODEL_SCHEMA_MISMATCH');
  // Preserve every real output slot, exactly matching PyTorch predict(). No guessed background or disease mapping.
  const selected = Array.from(logits, (v, i) => { if (!Number.isFinite(v)) throw new Error('INVALID_MODEL_OUTPUT'); return { score: 1 / (1 + Math.exp(-v)), class_id: i % 5, query: Math.floor(i / 5) }; }).sort((a, b) => b.score - a.score).slice(0, 300).filter(d => d.score > threshold);
  if (selected.length > 200) throw new Error('DETECTION_LIMIT');
  return selected.map(d => {
    const [cx, cy, w, h] = boxes.slice(d.query * 4, d.query * 4 + 4);
    if (![cx, cy, w, h].every(Number.isFinite) || w <= 0 || h <= 0) throw new Error('INVALID_MODEL_OUTPUT');
    const box = { xmin: Math.max(0, cx - w / 2) * 1000, ymin: Math.max(0, cy - h / 2) * 1000, xmax: Math.min(1, cx + w / 2) * 1000, ymax: Math.min(1, cy + h / 2) * 1000 };
    if (box.xmin >= box.xmax || box.ymin >= box.ymax) throw new Error('INVALID_MODEL_OUTPUT');
    return { class_id: d.class_id, raw_label: `RAW_CLASS_${d.class_id}`, score: d.score, box };
  });
}

export default {
  async fetch(request) {
    // Authenticate before body parsing, model downloads, initialization or inference.
    if (!authorized(request)) return response({ success: false, error: 'Unauthorized' }, 401);
    const pathname = new URL(request.url).pathname;
    if (request.method === 'GET' && pathname === '/health') return response({ success: true, runtime: 'NEON_WASM_CPU', model_loaded: ready, clinical_approval: 'PENDING', label_mapping_status: 'UNVERIFIED' });
    if (request.method !== 'POST' || !['/infer', '/self-test'].includes(pathname)) return response({ success: false, error: 'Not found' }, 404);
    const now = Date.now(); while (calls.length && calls[0] < now - 60_000) calls.shift();
    if (busy || calls.length >= 5) return response({ success: false, error: 'Research rate/concurrency limit' }, 429);
    calls.push(now); busy = true;
    try {
      const started = performance.now(); let tensorBytes, imageHash;
      if (pathname === '/self-test') { tensorBytes = gunzipSync(await readFile(new URL('./fixture.f32.gz', import.meta.url)), { maxOutputLength: TENSOR_BYTES }); imageHash = hash(tensorBytes); }
      else {
        const input = await readBoundedJson(request);
        if (!input || Object.keys(input).some(k => !['tensor_gzip_base64', 'image_sha256', 'cloud_processing_authorized'].includes(k)) || input.cloud_processing_authorized !== true || !/^[a-f0-9]{64}$/.test(input.image_sha256) || typeof input.tensor_gzip_base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.tensor_gzip_base64)) throw new Error('INVALID_REQUEST');
        tensorBytes = gunzipSync(Buffer.from(input.tensor_gzip_base64, 'base64'), { maxOutputLength: TENSOR_BYTES }); imageHash = input.image_sha256;
      }
      if (tensorBytes.length !== TENSOR_BYTES) throw new Error('INVALID_TENSOR');
      const copied = new Uint8Array(tensorBytes); const floats = new Float32Array(copied.buffer);
      for (const n of floats) if (!Number.isFinite(n) || n < -3 || n > 3) throw new Error('INVALID_TENSOR');
      const session = await getSession();
      const output = await session.run({ input: new ort.Tensor('float32', floats, [1, 3, SIDE, SIDE]) });
      const detections = decode(output.dets.data, output.labels.data);
      return response({ success: true, runtime: 'NEON_WASM_CPU', label_mapping_status: 'UNVERIFIED', clinical_use: 'PROHIBITED', source_images_retained: false, input_tensor_sha256: hash(tensorBytes), memory_rss_bytes: process.memoryUsage().rss, prediction: { model_id: MODEL_ID, model_version: MODEL_VERSION, artifact_sha256: process.env.MODEL_SHA256, image_sha256: imageHash, input_modality: 'INTRAORAL_PHOTO', prediction_type: 'BOUNDING_BOX', processing_ms: performance.now() - started, inference_status: 'SUCCEEDED', readiness: 'EXPERIMENTAL', detections } });
    } catch (error) {
      const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'INFERENCE_FAILED';
      return response({ success: false, error: code }, code.startsWith('INVALID_') ? 400 : 503);
    } finally { busy = false; }
  }
};
