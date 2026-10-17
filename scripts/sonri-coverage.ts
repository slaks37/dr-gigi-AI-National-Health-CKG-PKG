import { writeFile } from 'node:fs/promises';
import { terminologyCoverage } from '../src/clinical-engine/terminology/coverage';
async function main() { const output = process.argv[2]; if (!output)
    throw new Error('Output JSON path required'); await writeFile(output, JSON.stringify(terminologyCoverage(), null, 2)); }
main().catch(() => { console.error('Coverage export requires a writable output path.'); process.exitCode = 1; });
