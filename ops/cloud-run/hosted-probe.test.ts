import { describe, expect, it, vi } from 'vitest';
import { runHostedProbe, validateProbeOptions } from './hosted-probe';

// Fictional transport-only targets cover the current regional service-URL shape.
const base = 'https://synthetic-approved-staging-123.asia-southeast2.run.app';
const options = { targetOrigin: base, approvedOrigin: base, approvalReference: 'SYNTHETIC_FIXTURE_ONLY', audience: base, authMode: 'GOOGLE_ADC', workerToken: 'private-synthetic-worker-token-never-deployed-0001' };
const signed = 'Bearer private-synthetic-google-id-token-never-issued';
const headers = { Authorization: `Bearer ${options.workerToken}`, 'X-Serverless-Authorization': signed };
const denied = { request_id: 'a'.repeat(32), clinical_use: 'PROHIBITED', label_verification: 'UNVERIFIED', reason: 'UNAUTHORIZED', findings: [] };
const models = { schema_version: '1', clinical_use: 'PROHIBITED', models: [{ clinical_use: 'PROHIBITED', label_verification: 'UNVERIFIED', research_only: true, available: false }] };
function fixtures() {
  const responses = [new Response('<html>platform denied</html>', { status: 403 }), new Response('invalid identity', { status: 401 }), Response.json(denied, { status: 401 }), Response.json(denied, { status: 401 }), Response.json(models)];
  const transport = vi.fn(async () => responses.shift()!);
  const identityHeaders = vi.fn(async () => headers);
  return { transport, identityHeaders };
}
describe('Cloud Run boundary prober transport fixtures, no hosted IAM claim', () => {
  it('sends five GET-only checks with separated credentials and no fallback', async () => {
    const fixture = fixtures();
    const report = await runHostedProbe(options, { fetch: fixture.transport, identityHeaders: fixture.identityHeaders });
    expect(report.status).toBe('PASS'); expect(report.scope).toBe('TRANSPORT_FIXTURE');
    expect(report.hosted_execution).toBe(false); expect(report.full_hosted_iam_validation).toBe('NOT_ESTABLISHED');
    expect(report.requests_executed).toBe(5);
    expect(report.checks.every(check => check.result === 'PASS')).toBe(true);
    const calls = fixture.transport.mock.calls as unknown as [string, RequestInit][];
    for (const [url, request] of calls) {
      expect(url).toBe(`${base}/v1/models`); expect(request.method).toBe('GET'); expect(request.body).toBeUndefined();
      expect(request.redirect).toBe('error'); expect(request.cache).toBe('no-store');
    }
    expect(calls[0][1].headers).toEqual({});
    expect(new Headers(calls[1][1].headers).get('authorization')).toBe(headers.Authorization);
    expect(new Headers(calls[1][1].headers).get('x-serverless-authorization')).not.toBe(signed);
    expect(new Headers(calls[2][1].headers).has('authorization')).toBe(false);
    expect(new Headers(calls[3][1].headers).get('authorization')).not.toBe(headers.Authorization);
    expect(calls[4][1].headers).toEqual(headers);
    expect(JSON.stringify(report)).not.toContain(options.workerToken);
    expect(JSON.stringify(report)).not.toContain(signed);
    expect(report.pending_separate_checks).toContain('VALID_BUT_UNBOUND_CALLER_IDENTITY');
  });
  it('makes no transport request when identity fails and excludes provider exception content', async () => {
    const transport = vi.fn();
    const report = await runHostedProbe(options, { fetch: transport, identityHeaders: async () => { throw new Error(`provider secret ${signed} ${options.workerToken}`); } });
    expect(transport).not.toHaveBeenCalled(); expect(report.requests_executed).toBe(0); expect(report.status).toBe('FAIL');
    expect(report.identity_status).toBe('FAILED'); expect(report.checks.every(check => check.result === 'NOT_RUN')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('provider secret'); expect(JSON.stringify(report)).not.toContain(options.workerToken);
  });
  it('rejects worker-only headers instead of calling a fallback', async () => {
    const transport = vi.fn();
    await runHostedProbe(options, { fetch: transport, identityHeaders: async () => ({ Authorization: headers.Authorization }) });
    expect(transport).not.toHaveBeenCalled();
  });
  it('detects an IAM bypass when an anonymous request reaches the worker boundary', async () => {
    const transport = vi.fn(async () => Response.json(denied, { status: 401 }));
    const report = await runHostedProbe(options, { fetch: transport, identityHeaders: async () => headers });
    expect(report.status).toBe('FAIL'); expect(transport).toHaveBeenCalledTimes(1);
    expect(report.checks[0].reason).toBe('PLATFORM_DENIAL_NOT_ESTABLISHED');
  });
  it('does not confuse a second platform denial with successful worker authorization testing', async () => {
    const fixture = fixtures();
    fixture.transport.mockImplementationOnce(async () => new Response('denied', { status: 403 }))
      .mockImplementationOnce(async () => new Response('denied', { status: 403 }))
      .mockImplementationOnce(async () => new Response(`denied ${options.workerToken}`, { status: 401 }));
    const report = await runHostedProbe(options, { fetch: fixture.transport, identityHeaders: fixture.identityHeaders });
    expect(report.status).toBe('FAIL'); expect(report.checks[2].reason).toBe('WORKER_DENIAL_NOT_ESTABLISHED');
    expect(JSON.stringify(report)).not.toContain(options.workerToken);
  });
  it.each([{ ...models, models: [{ ...models.models[0], available: true }] }, { ...models, models: [{ ...models.models[0], label_verification: 'VERIFIED' }] }, { ...models, clinical_use: 'ALLOWED' }])('rejects inventory that changes research/unavailable invariants', async inventory => {
    let index = 0;
    const fixture = fixtures();
    const transport = async () => ++index === 5 ? Response.json(inventory) : fixture.transport();
    const report = await runHostedProbe(options, { fetch: transport, identityHeaders: fixture.identityHeaders });
    expect(report.status).toBe('FAIL'); expect(report.checks[4].reason).toBe('RESEARCH_ONLY_UNAVAILABLE_INVENTORY_REQUIRED');
  });
  it('caps hostile response size and redacts transport failures', async () => {
    const report = await runHostedProbe(options, { fetch: async () => new Response(options.workerToken.repeat(5000), { status: 403 }), identityHeaders: async () => headers });
    expect(report.checks[0].reason).toBe('REQUEST_OR_BOUNDED_RESPONSE_FAILED');
    expect(JSON.stringify(report)).not.toContain(options.workerToken);
  });
  it.each([base + '/path', base + '?token=private', 'http://127.0.0.1:8080', 'https://unapproved-service-as.a.run.app', base + '/', 'https://run.app', 'https://evil.run.app.example.org', 'https://bad..run.app'])('blocks noncanonical or unapproved targets before credentials or transport', async targetOrigin => {
    const fixture = fixtures();
    await expect(runHostedProbe({ ...options, targetOrigin }, { fetch: fixture.transport, identityHeaders: fixture.identityHeaders })).rejects.toThrow('APPROVED_CANONICAL_ORIGIN_REQUIRED');
    expect(fixture.transport).not.toHaveBeenCalled(); expect(fixture.identityHeaders).not.toHaveBeenCalled();
  });
  it('requires approval, matching audience and a real identity mode', () => {
    for (const patch of [{ approvedOrigin: '' }, { approvalReference: '' }, { audience: base + '/' }, { authMode: 'NONE' }, { workerToken: 'short' }]) expect(() => validateProbeOptions({ ...options, ...patch })).toThrow();
  });
  it.each(['https://synthetic-worker-as.a.run.app', 'https://synthetic-worker-123.asia-southeast2.run.app'])('accepts the exact approved canonical service origin %s', targetOrigin => {
    expect(validateProbeOptions({ ...options, targetOrigin, approvedOrigin: targetOrigin, audience: targetOrigin })).toBe(targetOrigin);
  });
});
