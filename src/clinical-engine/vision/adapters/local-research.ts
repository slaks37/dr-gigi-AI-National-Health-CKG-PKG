import 'server-only';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ResearchPredictionSchema } from './research';
export function localResearchConfigured() { return ['SONRI_RESEARCH_PYTHON', 'SONRI_RESEARCH_MANIFEST', 'SONRI_RESEARCH_ARTIFACT'].every(k => !!process.env[k] && path.isAbsolute(process.env[k]!)); }
export async function localResearchInference(image: Uint8Array, signal?: AbortSignal) {
    if (!localResearchConfigured())
        throw new Error('Local research runtime not configured');
    const python = process.env.SONRI_RESEARCH_PYTHON!, manifest = process.env.SONRI_RESEARCH_MANIFEST!, artifact = process.env.SONRI_RESEARCH_ARTIFACT!;
    await Promise.all([access(python), access(manifest), access(artifact)]);
    const metadata = JSON.parse(await readFile(manifest, 'utf8'));
    const dir = await mkdtemp(path.join(tmpdir(), 'sonri-lab-'));
    try {
        const input = path.join(dir, 'image.jpg'), output = path.join(dir, 'predictions.json');
        await writeFile(input, image, { mode: 0o600 });
        signal?.throwIfAborted();
        await new Promise<void>((resolve, reject) => {
            const child = spawn(python, [path.join(process.cwd(), 'research/oral-vision/run_local.py'), '--manifest', manifest, '--artifact', artifact, '--image', input, '--output', output, '--timeout', '90'], { shell: false, stdio: 'ignore', env: { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', MPLCONFIGDIR: dir, HF_HOME: dir, OMP_NUM_THREADS: '2', PYTHONNOUSERSITE: '1' } });
            const stop = () => { child.kill('SIGKILL'); };
            const timer = setTimeout(stop, 95000);
            signal?.addEventListener('abort', stop, { once: true });
            if (signal?.aborted)
                stop();
            const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
            child.once('error', () => { cleanup(); reject(new Error('Research runtime unavailable')); });
            child.once('close', code => { cleanup(); if (code === 0 && !signal?.aborted)
                resolve();
            else
                reject(new Error('Research inference failed or timed out')); });
        });
        const raw = await readFile(output, 'utf8');
        if (raw.length > 200000)
            throw new Error('Prediction limit exceeded');
        const result = ResearchPredictionSchema.parse(JSON.parse(raw));
        if (result.model_id !== metadata.model_id || result.model_version !== metadata.model_version || result.artifact_sha256 !== metadata.artifact_sha256 || result.image_sha256 !== createHash('sha256').update(image).digest('hex') || result.detections.some(d => metadata.class_labels[String(d.class_id)] !== d.raw_label))
            throw new Error('Research provenance mismatch');
        return result;
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    }
}
