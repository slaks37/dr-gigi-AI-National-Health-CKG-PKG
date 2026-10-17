import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = `${directory}/${entry.name}`;
        if (entry.isDirectory()) await inspect(file);
        else if (/\.(onnx|pt|pth|safetensors|onnx\.data)$/i.test(entry.name) || (await stat(file)).size >= 100_000_000) throw new Error('Restricted or oversized model artifact found in public assets');
    }
}
await inspect('public');
const root = 'node_modules/onnxruntime-web', version = '1.30.0';
if (JSON.parse(await readFile(`${root}/package.json`, 'utf8')).version !== version) throw new Error('ONNX Runtime version mismatch');
const target = `public/ort/${version}`; await mkdir(target, { recursive: true });
const files = ['ort.webgpu.bundle.min.mjs', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.jspi.mjs', 'ort-wasm-simd-threaded.jspi.wasm'];
const hashes = {};
for (const file of files) { await copyFile(`${root}/dist/${file}`, `${target}/${file}`); hashes[file] = createHash('sha256').update(await readFile(`${target}/${file}`)).digest('hex'); }
await copyFile('research/browser-vision/ONNXRUNTIME_LICENSE', `${target}/LICENSE.txt`);
await writeFile(`${target}/integrity.json`, JSON.stringify({ version, hashes }, null, 2));
await mkdir('public/browser-ai', { recursive: true });
await build({ entryPoints: ['src/clinical-engine/vision/browser/browser.worker.ts'], outfile: 'public/browser-ai/worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true });
console.log('Browser worker/runtime prepared; no model weights included.');
