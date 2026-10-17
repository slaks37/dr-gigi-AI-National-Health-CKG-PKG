import { readFile, writeFile } from 'node:fs/promises';
import { evaluateDetections } from '../src/clinical-engine/vision/evaluation/detection';
async function main() { const [input, output] = process.argv.slice(2); if (!input || !output)
    throw new Error('Input and private output required'); const data = JSON.parse(await readFile(input, 'utf8')); const reports = [0.1, 0.25, 0.5, 0.75, 0.9].map(t => evaluateDetections(data, t)); await writeFile(output, JSON.stringify(reports, null, 2), { mode: 0o600 }); console.log('De-identified threshold report written. No model trained or approved.'); }
main().catch(() => { console.error('Benchmark blocked: approved evaluation manifest and private output required.'); process.exitCode = 1; });
