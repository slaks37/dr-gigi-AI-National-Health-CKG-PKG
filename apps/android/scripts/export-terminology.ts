import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ICD_CATALOG, TERMINOLOGY_METADATA } from '../../../src/clinical-engine/terminology/catalog';
import { EXAMINATION_LABELS, EXAMINATION_WORKFLOW_VERSION, workflowForCode } from '../../../src/clinical-engine/terminology/workflows';

const target = fileURLToPath(new URL('../app/src/main/assets/terminology.v1.json', import.meta.url));
const source = readFileSync(fileURLToPath(new URL('../../../src/clinical-engine/terminology/who-icd10-2010.json', import.meta.url)));
const payload = {
  schema_version: 'sonri.android-terminology.v1', generator_version: '1',
  source_catalog_sha256: createHash('sha256').update(source).digest('hex'),
  terminology: TERMINOLOGY_METADATA, workflow_version: EXAMINATION_WORKFLOW_VERSION,
  examination_labels: EXAMINATION_LABELS, clinical_use: 'PROHIBITED',
  ai_supported_codes: 0, ai_evaluated_codes: 0, clinically_validated_codes: 0,
  entries: ICD_CATALOG.map(entry => ({ ...entry, workflow: workflowForCode(entry.code) })),
};
if (payload.entries.filter(e => e.kind === 'TERMINAL').length !== 108 || payload.entries.filter(e => e.kind === 'CATEGORY').length !== 15) throw new Error('Catalog coverage changed');
const output = JSON.stringify(payload, null, 2) + '\n';
const checksum = createHash('sha256').update(output).digest('hex') + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output || readFileSync(target + '.sha256', 'utf8') !== checksum) throw new Error('Android terminology snapshot stale');
} else {
  mkdirSync(fileURLToPath(new URL('../app/src/main/assets/', import.meta.url)), { recursive: true });
  writeFileSync(target, output); writeFileSync(target + '.sha256', checksum);
}
console.log(JSON.stringify({ terminal_codes: 108, categories: 15, sha256: checksum.trim(), clinical_use: 'PROHIBITED' }));
