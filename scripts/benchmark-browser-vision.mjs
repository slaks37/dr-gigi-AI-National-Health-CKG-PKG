// Local-only benchmark harness. Uses the real panel + worker/runtime, with an isolated authorization stub.
// Production administrator authorization is tested separately; this server never serves private model weights.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
const [artifact, outputArg] = process.argv.slice(2);
if (!artifact || !outputArg) throw new Error('Usage: node scripts/benchmark-browser-vision.mjs /private/model.onnx /private/results');
const output = path.resolve(outputArg), publicRoot = path.resolve('public'); await fs.mkdir(output, { recursive: true });
console.log('Preparing isolated UI harness');
const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserResearchPanel} from './components/clinical/BrowserResearchLab'; createRoot(document.getElementById('root')).render(<BrowserResearchPanel authorize={async()=>{}}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'next-image-harness', setup(build) { build.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'image', namespace: 'harness' })); build.onLoad({ filter: /.*/, namespace: 'harness' }, () => ({ contents: `import React from 'react';export default function Image({fill,unoptimized,...props}){return React.createElement('img',{...props,style:{width:'100%',height:'100%',position:'absolute'}});}`, loader: 'js', resolveDir: process.cwd() })); } }] });
console.log('Harness compiled');
let scenario = 'normal'; const served = []; const browserRequests = []; const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sonri-browser-negative-'));
const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost'); served.push({ method: req.method, path: url.pathname });
        if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/harness.css"></head><body><p>LOCAL BENCHMARK: synthetic only, isolated authorization stub.</p><div id="root"></div><script type="module" src="/harness.mjs"></script></body></html>'); return; }
        if (url.pathname === '/harness.css') { const folder=path.resolve('.next/static/css'); const files=await fs.readdir(folder);res.setHeader('Content-Type','text/css');res.end((await Promise.all(files.filter(f=>f.endsWith('.css')).map(f=>fs.readFile(path.join(folder,f),'utf8')))).join('\n'));return;}
        if (url.pathname === '/harness.mjs') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].contents); return; }
        if (!/^\/(browser-ai\/worker\.js|ort\/1\.30\.0\/[a-zA-Z0-9.-]+|research-fixtures\/sonri-v1\/[a-zA-Z0-9.-]+)$/.test(url.pathname)) { res.writeHead(404); res.end(); return; }
        if (scenario === 'runtime404' && url.pathname.startsWith('/ort/')) { res.writeHead(404); res.end(); return; }
        let file = path.join(publicRoot, url.pathname), code;
        if (url.pathname.endsWith('original-runtime.mjs')) file = path.join(publicRoot, 'ort/1.30.0/ort.webgpu.bundle.min.mjs');
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/javascript');
        if (url.pathname === '/browser-ai/worker.js') {
            code = await fs.readFile(file, 'utf8');
            if (scenario === 'low-memory') code = `Object.defineProperty(navigator,'deviceMemory',{value:2});\n` + code;
            if (scenario === 'no-webgpu') code = `Object.defineProperty(navigator,'gpu',{value:undefined});\n` + code;
            res.end(code); return;
        }
        if (scenario === 'gpu-failure' && url.pathname.endsWith('/ort.webgpu.bundle.min.mjs')) {
            res.end(`export * from './original-runtime.mjs'; import {InferenceSession} from './original-runtime.mjs'; const create=InferenceSession.create.bind(InferenceSession); InferenceSession.create=(model,options)=>options?.executionProviders?.[0]==='webgpu'?Promise.reject(new Error('Synthetic GPU failure')):create(model,options);`); return;
        }
        res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
console.log('Loopback harness listening');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { browser: browser.version(), device: { platform: os.platform(), architecture: os.arch(), total_memory_bytes: os.totalmem() }, automation: 'installed desktop Google Chrome, headless, no device emulation', authorization: 'isolated local panel harness stub; production API authorization checked separately', model_bytes: 121573930, model_download_ms: null, model_download_note: 'Local file only; no model network download or public artifact hosting', runs: [], failures: [], network: [], mobile: { android_chrome: 'NOT_TESTED', iphone_safari: 'NOT_TESTED', low_memory_hardware: 'NOT_TESTED' } };
console.log('Desktop Chrome started');
let page;
async function open() { const context = await browser.newContext(); page = await context.newPage(); page.setDefaultTimeout(30000); page.on('request', req => { const u = new URL(req.url()); browserRequests.push({ method: req.method(), origin: u.origin, path: u.pathname }); }); page.on('pageerror', error=>console.log('Harness page error:',String(error).slice(0,500))); page.on('console', message=>{if(message.type()==='error')console.log('Browser console:',message.text().slice(0,400));}); await page.goto(origin); console.log('Panel navigation complete'); await page.getByText('WebGPU API:', { exact: false }).waitFor(); return context; }
async function ready(file = artifact) { if (file) await page.locator('input[type=file]').setInputFiles(file); await page.getByLabel('Saya berwenang memakai bobot ini', { exact: false }).check(); }
async function exportLatest() { const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Unduh benchmark sintetis' }).click(); const saved = await download; const bytes = await fs.readFile(await saved.path()); return JSON.parse(bytes); }
async function run(provider, fixture = 'shapes') {
    await page.getByLabel('Eksekusi', { exact: true }).selectOption(provider); await page.getByLabel('Fixture sintetis', { exact: true }).selectOption(fixture);
    await page.getByRole('button', { name: 'Jalankan Browser AI', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Inferensi penelitian selesai.' }).waitFor();
    console.log('Inference complete:',provider,fixture); const data = await exportLatest(); report.capabilities = data.capabilities; const row = data.results.at(-1);
    if (fixture === 'shapes') {
        const golden = JSON.parse(await fs.readFile('public/research-fixtures/sonri-v1/pytorch-shapes.json', 'utf8'));
        let score = 0, box = 0; const matched = new Set();
        for (const d of row.detections) {
            const candidates = golden.scores.map((value, index) => ({ index, cost: matched.has(index) || golden.classes[index] !== d.class_id ? Infinity : Math.abs(value - d.score) })).sort((a,b) => a.cost-b.cost);
            const index = candidates[0]?.index; if (index === undefined || candidates[0].cost === Infinity) throw new Error('Decoded class mismatch'); matched.add(index);
            score = Math.max(score, Math.abs(d.score - golden.scores[index])); Object.values(d.box).forEach((value, j) => { box = Math.max(box, Math.abs(value/1000 - golden.boxes[index][j]/704)); });
        }
        row.parity = { passed: row.detections.length === golden.scores.length && score < .0001 && box < .0001, max_score_diff: score, max_normalized_box_diff: box };
    } else row.parity = { passed: row.detections.length === 0, reference_detections: 0 };
    if (!row.parity.passed) throw new Error('Decoded parity failed'); report.runs.push(row); return row;
}
try {
    let context = await open();
    report.orientation = await page.evaluate(async()=>{const ref=await fetch('/research-fixtures/sonri-v1/orientation-reference.json').then(r=>r.json());const blob=await fetch('/research-fixtures/sonri-v1/orientation-6.jpg').then(r=>r.blob());const bitmap=await createImageBitmap(blob,{imageOrientation:'from-image',premultiplyAlpha:'none',colorSpaceConversion:'none'});const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);let max=0;for(const p of ref.probes){const rgb=ctx.getImageData(p.x,p.y,1,1).data;for(let c=0;c<3;c++)max=Math.max(max,Math.abs(rgb[c]-p.rgb[c]));}const result={width:bitmap.width,height:bitmap.height,max_channel_diff:max,passed:bitmap.width===ref.width&&bitmap.height===ref.height&&max<=ref.max_channel_difference};bitmap.close();return result;});
    if(!report.orientation.passed)throw new Error('Synthetic EXIF orientation mismatch');
    if (!process.argv.includes('--orientation-only')) {
    await ready(); await page.getByLabel('Simpan hanya model terverifikasi', { exact: false }).check();
    for (const provider of ['webgpu', 'wasm']) { for (let i = 0; i < 2; i++) await run(provider); }
    await page.screenshot({ path: path.join(output, 'browser-ai-overlay.png'), fullPage: true });
    for (const fixture of ['flat', 'noise', 'gradient']) await run('webgpu', fixture);
    await page.screenshot({ path: path.join(output, 'browser-ai-real-results.png'), fullPage: true });
    await page.reload(); await ready(null); await page.getByLabel('Simpan hanya model terverifikasi', { exact: false }).check(); const warm = await run('wasm'); report.cache_reload = { verified: warm.cache_status === 'HIT_VERIFIED', model_read_ms: warm.model_read_ms, model_hash_ms: warm.model_hash_ms };
    await page.reload(); await ready(null); await page.getByLabel('Simpan hanya model terverifikasi', { exact: false }).check(); const gpuWarm = await run('webgpu'); report.cache_reload_gpu = { verified: gpuWarm.cache_status === 'HIT_VERIFIED', model_read_ms: gpuWarm.model_read_ms, model_hash_ms: gpuWarm.model_hash_ms };
    await page.getByRole('button', { name: 'Hapus cache model' }).click(); await page.getByRole('status').filter({ hasText: 'Cache model dihapus.' }).waitFor(); report.cache_clear = await page.evaluate(async () => !(await caches.keys()).includes('sonri-research-model-v1'));
    await context.close();
    for (const test of ['runtime404', 'low-memory', 'no-webgpu', 'gpu-failure', 'gpu-no-fallback']) {
        scenario = test === 'gpu-no-fallback' ? 'gpu-failure' : test; context = await open(); await ready(); if (test === 'gpu-failure') await page.getByLabel('Izinkan fallback CPU', { exact: false }).check();
        await page.getByRole('button', { name: 'Jalankan Browser AI', exact: true }).click();
        if (test === 'no-webgpu' || test === 'gpu-failure') { await page.getByRole('status').filter({ hasText: 'Inferensi penelitian selesai.' }).waitFor(); const row = (await exportLatest()).results.at(-1); report.failures.push({ test, status: 'PASSED', actual_provider: row.provider, fallback_reason: row.fallback_reason }); }
        else { await page.getByRole('alert').filter({ hasText: /INSUFFICIENT_DEVICE_MEMORY|BROWSER_INFERENCE_FAILED|WEBGPU_INITIALIZATION_FAILED/ }).waitFor(); report.failures.push({ test, status: 'PASSED', message: await page.getByRole('alert').last().innerText() }); }
        await context.close();
    }
    scenario = 'normal'; context = await open();
    const corrupt = path.join(temp, 'corrupt.onnx'); await fs.copyFile(artifact, corrupt); const handle = await fs.open(corrupt, 'r+'); const byte = Buffer.alloc(1); await handle.read(byte,0,1,0); byte[0] ^= 255; await handle.write(byte,0,1,0); await handle.close();
    await ready(corrupt); await page.getByRole('button', { name: 'Jalankan Browser AI', exact: true }).click(); await page.getByRole('alert').filter({hasText:'MODEL_CHECKSUM_MISMATCH'}).waitFor(); report.failures.push({test:'corrupt-local-model',status:'PASSED'}); await context.close();
    context = await open(); await ready(null); await page.getByLabel('Simpan hanya model terverifikasi',{exact:false}).check();
    await page.evaluate(async()=>{const c=await caches.open('sonri-research-model-v1'); await c.put('/__sonri-model-cache/a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0',new Response(new Uint8Array([1,2]),{headers:{'Content-Length':'121573930'}}));});
    await page.getByRole('button', { name: 'Jalankan Browser AI', exact: true }).click(); await page.getByRole('alert').filter({hasText:'MODEL_SIZE_MISMATCH'}).waitFor(); report.failures.push({test:'corrupt-truncated-cache',status:'PASSED'}); await context.close();
    context = await open(); await ready(); await page.getByRole('button', { name: 'Jalankan Browser AI', exact: true }).click(); await page.evaluate(()=>window.dispatchEvent(new Event('pagehide'))); await page.getByRole('status').filter({hasText:'BROWSER_INTERRUPTED'}).waitFor(); if (await page.getByTestId('browser-detection').count()) throw new Error('Interrupted inference displayed stale detections'); report.failures.push({test:'browser-interrupted',status:'PASSED'}); await context.close();
    context = await open(); await ready(); await page.getByRole('button', { name: 'Jalankan Browser AI', exact: true }).click(); await page.getByRole('button', { name: 'Batalkan dan lepas sesi' }).click(); await page.getByRole('status').filter({ hasText: 'Dibatalkan' }).waitFor(); report.failures.push({ test: 'cancel', status: 'PASSED' }); await context.close();
    }
} catch(error) { await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{}); console.log('Panel state:',await page?.locator('body').innerText().catch(()=>'')); throw error; } finally { report.network = served; report.browser_requests = browserRequests; report.no_photo_or_model_uploads = browserRequests.every(r=>r.method==='GET'); report.no_cloud_inference = browserRequests.every(r=>r.origin===origin); await fs.rm(temp,{recursive:true,force:true}); await fs.writeFile(path.join(output, 'browser-benchmark.json'), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify({ runs: report.runs.length, orientation: report.orientation, failures: report.failures, cache: report.cache_reload, cache_clear: report.cache_clear }));
