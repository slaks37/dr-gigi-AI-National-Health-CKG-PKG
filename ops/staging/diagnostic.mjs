import { writeFileSync } from 'node:fs';
// Failure-only diagnostics, with no raw emulator logs in CI artifacts/stdout.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const token = process.env.SONRI_INFERENCE_TOKEN;
if (token) input = input.split(token).join('[REDACTED]');
const lines = input.split('\n').filter(line => /error|exception|ENOENT|EACCES|EROFS|could not|cannot|failed|fatal/i.test(line));
const errors = lines.slice(-30).map(line => line
  .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
  .replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
  .replace(/[A-Za-z0-9_=-]{48,}/g, '[REDACTED_LONG_VALUE]')
  .slice(0, 1000));
writeFileSync('ops/staging/evidence/failure-diagnostics.json', JSON.stringify({ scope: 'SANITIZED_CONTAINER_FAILURE_ERRORS_ONLY', errors }, null, 2) + '\n');
console.log(JSON.stringify({ sanitized_container_errors: errors }));
