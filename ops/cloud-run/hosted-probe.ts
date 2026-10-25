/** Read-only boundary observations. Transport fixtures never establish hosted IAM. */
export type ProbeOptions = {
  targetOrigin: string;
  approvedOrigin: string;
  approvalReference: string;
  audience: string;
  authMode: string;
  workerToken: string;
};
type Transport = (url: string, init: RequestInit) => Promise<Response>;
type Dependencies = {
  fetch: Transport;
  identityHeaders: (origin: string, token: string) => Promise<Record<string, string>>;
  executionScope?: 'TRANSPORT_FIXTURE' | 'HOSTED_HTTP_GET';
};
type Check = { name: string; result: 'PASS' | 'FAIL' | 'NOT_RUN'; http_status?: number; reason?: string };
const names = ['no_iam_no_worker_token', 'invalid_iam_valid_worker_token', 'valid_iam_no_worker_token', 'valid_iam_wrong_worker_token', 'both_credentials_valid'] as const;

export function validateProbeOptions(options: ProbeOptions): string {
  let url: URL;
  try { url = new URL(options.targetOrigin); } catch { throw new Error('APPROVED_CANONICAL_ORIGIN_REQUIRED'); }
  const cloudRunHost = url.hostname.endsWith('.run.app') && url.hostname.slice(0, -8).split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  if (url.protocol !== 'https:' || !cloudRunHost || url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password || options.targetOrigin !== url.origin || options.approvedOrigin !== url.origin || options.audience !== url.origin || !options.approvalReference.trim()) throw new Error('APPROVED_CANONICAL_ORIGIN_REQUIRED');
  if (!['GOOGLE_ADC', 'VERCEL_WIF'].includes(options.authMode)) throw new Error('HOSTED_IDENTITY_MODE_REQUIRED');
  if (options.workerToken.length < 32 || /[\r\n]/.test(options.workerToken)) throw new Error('WORKER_CREDENTIAL_REQUIRED');
  return url.origin;
}

async function boundedBody(response: Response): Promise<unknown> {
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 100_000) { await reader.cancel(); throw new Error('RESPONSE_LIMIT'); }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return undefined; }
  } finally { reader.releaseLock(); }
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function workerDenied(body: unknown): boolean {
  return object(body) && body.clinical_use === 'PROHIBITED' && body.label_verification === 'UNVERIFIED' && body.reason === 'UNAUTHORIZED' && Array.isArray(body.findings) && body.findings.length === 0 && typeof body.request_id === 'string' && /^[0-9a-f]{32}$/.test(body.request_id);
}
function inventorySafe(body: unknown): boolean {
  return object(body) && body.schema_version === '1' && body.clinical_use === 'PROHIBITED' && Array.isArray(body.models) && body.models.length > 0 && body.models.length <= 30 && body.models.every(model => object(model) && model.clinical_use === 'PROHIBITED' && model.label_verification === 'UNVERIFIED' && model.research_only === true && model.available === false);
}

export async function runHostedProbe(options: ProbeOptions, dependencies: Dependencies) {
  const origin = validateProbeOptions(options);
  const scope = dependencies.executionScope || 'TRANSPORT_FIXTURE';
  const checks: Check[] = names.map(name => ({ name, result: 'NOT_RUN' }));
  const report = {
    schema_version: '1', executed_at: new Date().toISOString(), scope,
    target_origin: origin, status: 'FAIL' as 'PASS' | 'FAIL', requests_executed: 0,
    hosted_execution: false, identity_status: 'NOT_ACQUIRED' as 'NOT_ACQUIRED' | 'ACQUIRED' | 'FAILED', clinical_use: 'PROHIBITED',
    full_hosted_iam_validation: 'NOT_ESTABLISHED', clinical_validation: 'NOT_PERFORMED',
    checks, pending_separate_checks: ['SIGNED_WRONG_AUDIENCE_TOKEN', 'VALID_BUT_UNBOUND_CALLER_IDENTITY', 'INHERITED_AND_SERVICE_IAM_POLICY_REVIEW', 'HOSTED_SECRET_ROTATION_AND_RECOVERY', 'MODEL_INFERENCE_AND_CLINICAL_VALIDATION'],
  };
  let valid: Record<string, string>;
  try {
    valid = await dependencies.identityHeaders(origin, options.workerToken);
    if (valid.Authorization !== `Bearer ${options.workerToken}` || !valid['X-Serverless-Authorization']?.startsWith('Bearer ') || valid['X-Serverless-Authorization'].length < 16 || /[\r\n]/.test(valid['X-Serverless-Authorization'])) throw new Error('Invalid identity headers');
  } catch {
    // Never send a worker-only fallback, and never copy provider exceptions to output.
    report.identity_status = 'FAILED';
    return report;
  }
  report.identity_status = 'ACQUIRED';
  const wrongToken = options.workerToken === 'synthetic-wrong-worker-token-000000000000' ? 'synthetic-wrong-worker-token-000000000001' : 'synthetic-wrong-worker-token-000000000000';
  const attempts: Record<string, string>[] = [
    {},
    { Authorization: valid.Authorization, 'X-Serverless-Authorization': 'Bearer synthetic-invalid-google-id-token' },
    { 'X-Serverless-Authorization': valid['X-Serverless-Authorization'] },
    { Authorization: `Bearer ${wrongToken}`, 'X-Serverless-Authorization': valid['X-Serverless-Authorization'] },
    valid,
  ];
  for (let index = 0; index < attempts.length; index++) {
    let response: Response;
    try {
      report.requests_executed++;
      response = await dependencies.fetch(`${origin}/v1/models`, { method: 'GET', headers: attempts[index], redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      report.hosted_execution = scope === 'HOSTED_HTTP_GET';
      const body = await boundedBody(response);
      let okay: boolean;
      if (index < 2) {
        // A worker UNAUTHORIZED response without IAM means the platform boundary was bypassed.
        okay = [401, 403].includes(response.status) && !workerDenied(body);
      } else if (index < 4) {
        // The expected worker JSON proves the valid identity reached the application boundary.
        okay = response.status === 401 && workerDenied(body);
      } else okay = response.status === 200 && inventorySafe(body);
      checks[index] = { name: names[index], result: okay ? 'PASS' : 'FAIL', http_status: response.status,
        ...(okay ? {} : { reason: index < 2 ? 'PLATFORM_DENIAL_NOT_ESTABLISHED' : index < 4 ? 'WORKER_DENIAL_NOT_ESTABLISHED' : 'RESEARCH_ONLY_UNAVAILABLE_INVENTORY_REQUIRED' }) };
      if (!okay) return report;
    } catch {
      checks[index] = { name: names[index], result: 'FAIL', reason: 'REQUEST_OR_BOUNDED_RESPONSE_FAILED' };
      return report;
    }
  }
  report.status = 'PASS';
  return report;
}
