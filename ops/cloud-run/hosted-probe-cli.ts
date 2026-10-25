import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { inferenceHeaders } from '../../src/server/inference-auth';
import { runHostedProbe, validateProbeOptions } from './hosted-probe';

const output = 'ops/cloud-run/generated/hosted-boundary.json';
async function save(report: unknown) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
}
async function main() {
  const options = {
    targetOrigin: process.env.SONRI_INFERENCE_URL || '',
    approvedOrigin: process.env.SONRI_CLOUD_RUN_PROBE_APPROVED_ORIGIN || '',
    approvalReference: process.env.SONRI_CLOUD_RUN_PROBE_APPROVAL_REFERENCE || '',
    audience: process.env.SONRI_INFERENCE_AUDIENCE || '',
    authMode: process.env.SONRI_INFERENCE_AUTH_MODE || '',
    workerToken: process.env.SONRI_INFERENCE_TOKEN || '',
  };
  validateProbeOptions(options);
  const report = await runHostedProbe(options, { fetch, identityHeaders: inferenceHeaders, executionScope: 'HOSTED_HTTP_GET' });
  try { await save(report); } catch {
    console.error(JSON.stringify({ scope: report.scope, status: 'FAIL', requests_executed: report.requests_executed, reason: 'REPORT_WRITE_FAILED' }));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ scope: report.scope, status: report.status, requests_executed: report.requests_executed, full_hosted_iam_validation: report.full_hosted_iam_validation }));
  if (report.status !== 'PASS') process.exitCode = 1;
}
main().catch(async () => {
  // Configuration, identity and transport exceptions may contain sensitive values.
  const report = { scope: 'NOT_EXECUTED', status: 'BLOCKED', requests_executed: 0, reason: 'APPROVED_CONFIG_OR_IDENTITY_REQUIRED_NO_COMPLETION_CLAIM' };
  // Replace any earlier report so an old pass cannot be mistaken for this attempt.
  await save(report).catch(() => undefined);
  console.error(JSON.stringify(report));
  process.exitCode = 1;
});
