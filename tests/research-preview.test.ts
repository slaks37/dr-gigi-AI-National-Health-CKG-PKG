import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const fake = vi.hoisted(() => ({ verify: vi.fn(), store: vi.fn(), exchange: vi.fn(), token: vi.fn(), fromJSON: vi.fn() }));
vi.mock('../src/lib/firebase-admin', () => ({ adminAuth: { verifyIdToken: fake.verify } }));
vi.mock('../src/server/store', () => ({ store: fake.store }));
vi.mock('@vercel/oidc', () => ({ getVercelOidcToken: fake.token }));
vi.mock('google-auth-library', () => ({ ExternalAccountClient: { fromJSON: fake.fromJSON } }));
import { api } from '../src/server/security';
import { POST as sync } from '../app/api/auth/sync/route';
import { POST as authorizeBrowser } from '../app/api/vision-lab/browser/route';
import { previewCredential } from '../src/server/preview-credential';
const req = (path: string, method = 'GET', body?: unknown) => new NextRequest(`https://research.example${path}`, { method, headers: { Authorization: 'Bearer actual-verification-is-mocked-only-in-unit-tests', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => {
  vi.stubEnv('SONRI_RESEARCH_PREVIEW', '1'); vi.stubEnv('VERCEL_ENV', 'preview');
  fake.verify.mockResolvedValue({ uid: 'unit-test-user', role: 'admin' });
  fake.store.mockImplementation(() => { throw new Error('PATIENT_STORE_MUST_NOT_BE_TOUCHED'); });
});
afterEach(() => vi.unstubAllEnvs());
it('denies patient data, clinical mutations and cloud inference even to an administrator', async () => {
  const handler = vi.fn(); const route = api(handler);
  for (const path of ['/api/records', '/api/appointments', '/api/screenings', '/api/dataset/import', '/api/clinical-review', '/api/clinical-assignment', '/api/satusehat/sync', '/api/gemini/analyze', '/api/vision-lab']) {
    const response = await route(req(path, 'POST', {})); expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toContain('no-store');
  }
  expect((await route(req('/api/records'))).status).toBe(503);
  expect(handler).not.toHaveBeenCalled(); expect(fake.verify).not.toHaveBeenCalled(); expect(fake.store).not.toHaveBeenCalled();
});
it('verifies the real role and revocation before allowing browser research or a non-persistent profile sync', async () => {
  const response = await sync(req('/api/auth/sync', 'POST', {}));
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ profile_persisted: false, user: { role: 'admin' } });
  expect(fake.verify).toHaveBeenCalledWith(expect.any(String), true); expect(fake.store).not.toHaveBeenCalled();
  const input = { research_authorized: true, synthetic_only: true };
  fake.verify.mockResolvedValue({ uid: 'unit-test-user', role: 'patient' }); expect((await authorizeBrowser(req('/api/vision-lab/browser', 'POST', input))).status).toBe(403);
  fake.verify.mockRejectedValue({ code: 'auth/id-token-revoked' }); expect((await authorizeBrowser(req('/api/vision-lab/browser', 'POST', input))).status).toBe(401);
  fake.verify.mockRejectedValue({ code: 'auth/insufficient-permission' }); expect((await authorizeBrowser(req('/api/vision-lab/browser', 'POST', input))).status).toBe(503);
});
it('fails closed if the research flag is mistakenly placed on production', async () => {
  vi.stubEnv('VERCEL_ENV', 'production'); const handler = vi.fn();
  expect((await api(handler)(req('/api/vision-lab'))).status).toBe(503); expect(handler).not.toHaveBeenCalled(); expect(fake.verify).not.toHaveBeenCalled();
  expect(() => previewCredential()).toThrow('RESEARCH_PREVIEW_ENVIRONMENT_REQUIRED');
});
it('uses only the constrained GCP federation configuration and temporary tokens', async () => {
  vi.stubEnv('SONRI_GCP_WIF_AUDIENCE', '//iam.googleapis.com/projects/543319592327/locations/global/workloadIdentityPools/sonri-vercel-preview/providers/vercel');
  vi.stubEnv('SONRI_GCP_AUTH_SERVICE_ACCOUNT', 'sonri-preview-auth@project-96303d5e-7aac-460d-b72.iam.gserviceaccount.com');
  fake.fromJSON.mockReturnValue({ getAccessToken: fake.exchange, credentials: { expiry_date: Date.now() + 60000 } });
  fake.exchange.mockResolvedValue({ token: 'unit-test-temporary-token' });
  expect(await previewCredential().getAccessToken()).toMatchObject({ access_token: 'unit-test-temporary-token', expires_in: expect.any(Number) });
  expect(fake.fromJSON).toHaveBeenCalledWith(expect.objectContaining({ token_url: 'https://sts.googleapis.com/v1/token' }));
  await fake.fromJSON.mock.calls[0][0].subject_token_supplier.getSubjectToken({ audience: 'google-sts-audience' });
  expect(fake.token).toHaveBeenCalledWith();
  vi.stubEnv('SONRI_GCP_AUTH_SERVICE_ACCOUNT', 'untrusted@example.com'); expect(() => previewCredential()).toThrow('RESEARCH_PREVIEW_AUTH_NOT_CONFIGURED');
});
