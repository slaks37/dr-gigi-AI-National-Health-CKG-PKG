import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ headers: vi.fn(), adc: vi.fn(), pool: vi.fn(), impersonated: vi.fn(), oidc: vi.fn() }));
vi.mock('google-auth-library', () => ({
  GoogleAuth: class { getIdTokenClient = f.adc; },
  IdentityPoolClient: class { constructor(o: unknown) { f.pool(o); } },
  Impersonated: class { constructor(o: unknown) { f.impersonated(o); } },
  IdTokenClient: class { getRequestHeaders = f.headers; },
}));
vi.mock('@vercel/oidc', () => ({ getVercelOidcToken: f.oidc }));
const base = 'https://sonri-fixture-123456.asia-southeast2.run.app', token = 'synthetic-worker-token'.repeat(2);
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  f.headers.mockResolvedValue(new Headers({ authorization: 'Bearer synthetic-google-id-token' }));
  f.adc.mockResolvedValue({ getRequestHeaders: f.headers });
  f.oidc.mockResolvedValue('synthetic-vercel-subject-token');
});
afterEach(() => vi.unstubAllEnvs());
async function run() { return (await import('../src/server/inference-auth')).inferenceHeaders; }
describe('Cloud Run identity boundary', () => {
  it('preserves the existing private network mode without requesting cloud identity', async () => {
    vi.stubEnv('SONRI_INFERENCE_AUTH_MODE', 'NONE');
    expect(await (await run())('http://inference:8000', token)).toEqual({ Authorization: `Bearer ${token}` });
    expect(f.adc).not.toHaveBeenCalled(); expect(f.pool).not.toHaveBeenCalled();
  });
  it('keeps application credential distinct from audience-bound platform identity', async () => {
    vi.stubEnv('SONRI_INFERENCE_AUTH_MODE', 'GOOGLE_ADC'); vi.stubEnv('SONRI_INFERENCE_AUDIENCE', base);
    const headers = await (await run())(base, token);
    expect(headers).toEqual({ Authorization: `Bearer ${token}`, 'X-Serverless-Authorization': 'Bearer synthetic-google-id-token' });
    expect(f.adc).toHaveBeenCalledWith(base);
  });
  it('obtains Vercel subject tokens inside the supplier and uses only fixed Google endpoints', async () => {
    vi.stubEnv('SONRI_INFERENCE_AUTH_MODE', 'VERCEL_WIF'); vi.stubEnv('SONRI_INFERENCE_AUDIENCE', base);
    vi.stubEnv('SONRI_GCP_WIF_PROVIDER', 'projects/123456/locations/global/workloadIdentityPools/sonri/providers/vercel');
    vi.stubEnv('SONRI_GCP_CALLER_SERVICE_ACCOUNT', 'sonri-caller@sonri-fixture-staging.iam.gserviceaccount.com');
    const auth = await run(); await auth(base, token); await auth(base, token);
    expect(f.pool).toHaveBeenCalledTimes(1);
    const options = f.pool.mock.calls[0][0];
    expect(options.token_url).toBe('https://sts.googleapis.com/v1/token');
    expect(options.service_account_impersonation_url).toBeUndefined();
    expect(f.oidc).not.toHaveBeenCalled();
    expect(await options.subject_token_supplier.getSubjectToken()).toBe('synthetic-vercel-subject-token');
    expect(f.impersonated.mock.calls[0][0].targetPrincipal).toBe('sonri-caller@sonri-fixture-staging.iam.gserviceaccount.com');
  });
  it.each(['http://inference:8000', 'https://attacker.test', base + '/v1', base + '?x=1', base.replace('https:', 'http:')])('never sends a Google identity to invalid target %s', async url => {
    vi.stubEnv('SONRI_INFERENCE_AUTH_MODE', 'GOOGLE_ADC'); vi.stubEnv('SONRI_INFERENCE_AUDIENCE', base);
    await expect((await run())(url, token)).rejects.toThrow(); expect(f.adc).not.toHaveBeenCalled();
  });
  it('fails closed without worker fallback and suppresses credential-bearing identity errors', async () => {
    vi.stubEnv('SONRI_INFERENCE_AUTH_MODE', 'GOOGLE_ADC'); vi.stubEnv('SONRI_INFERENCE_AUDIENCE', base);
    f.adc.mockRejectedValueOnce(new Error('SECRET_PROVIDER_RESPONSE'));
    const auth = await run();
    await expect(auth(base, token)).rejects.toThrow('Inference service identity unavailable');
    expect(await auth(base, token)).toHaveProperty('X-Serverless-Authorization');
    expect(f.adc).toHaveBeenCalledTimes(2);
  });
});
