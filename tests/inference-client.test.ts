import { afterEach, describe, expect, it, vi } from 'vitest';
import { LabInputSchema, modelInventory, researchInference } from '../src/server/inference-client';
const input = { model_id: 'comparative-rfdetr', modality: 'intraoral' as const, synthetic_fixture: true as const, research_opt_in: true as const, mime_type: 'image/png' as const, data: 'YWJj' };
const output = { request_id: 'synthetic', status: 'completed', model_id: input.model_id, model_version: 'synthetic-fixture-contract-only', model_sha256: 'a'.repeat(64), modality: 'intraoral', clinical_use: 'PROHIBITED', label_verification: 'UNVERIFIED', findings: [{ kind: 'detection', class_id: 0, raw_label: 'RAW_CLASS_0', score: .1, box: [.1,.1,.3,.3] }], quality: { accepted: true }, latency_ms: 1, warnings: [] };
function configured() { vi.stubEnv('SONRI_INFERENCE_URL', 'http://127.0.0.1:8000'); vi.stubEnv('SONRI_INFERENCE_TOKEN', 'synthetic-contract-token-only'); }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('application → inference boundary', () => {
  it('never accepts patient metadata, arbitrary URLs, or omitted research acknowledgment', () => {
    for (const patch of [{ patient_id: 'patient' }, { endpoint: 'https://example.test' }, { synthetic_fixture: false }, { research_opt_in: false }]) expect(LabInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it('fails closed when service is unconfigured', async () => {
    vi.stubEnv('SONRI_INFERENCE_URL', ''); vi.stubEnv('SONRI_INFERENCE_TOKEN', '');
    await expect(modelInventory()).rejects.toThrow('INFERENCE_NOT_CONFIGURED');
  });
  it('never falls back to a worker-only call when platform identity configuration is invalid', async () => {
    configured(); vi.stubEnv('SONRI_INFERENCE_AUTH_MODE', 'GOOGLE_ADC');
    vi.stubEnv('SONRI_INFERENCE_AUDIENCE', 'https://sonri-fixture.run.app');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(modelInventory()).rejects.toThrow('Inference inventory unavailable');
    await expect(researchInference(input)).rejects.toThrow('no result has been saved');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends only bounded synthetic media and server-side authentication', async () => {
    configured(); const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(output))); vi.stubGlobal('fetch', fetcher);
    const result = await researchInference(input); expect(result.clinical_use).toBe('PROHIBITED');
    const [url, init] = fetcher.mock.calls[0]; expect(url).toBe('http://127.0.0.1:8000/v1/infer');
    expect(init.headers.Authorization).toBe('Bearer synthetic-contract-token-only'); expect([...init.body.keys()]).toEqual(['model_id', 'modality', 'research_opt_in', 'file']);
  });
  it.each([{ clinical_use: 'APPROVED' }, { label_verification: 'VERIFIED' }, { modality: 'panoramic' }, { model_id: 'wrong' }, { findings: [{ ...output.findings[0], score: 1.2 }] }, {findings:[{...output.findings[0],box:[.4,.4,.2,.2]}]}, {findings:[{...output.findings[0],box:null}]}, {model_version:''}])('rejects invalid or incorrectly promoted upstream output %j', async patch => {
    configured(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...output, ...patch }))));
    await expect(researchInference(input)).rejects.toThrow('no result has been saved');
  });
  it('hides upstream credentials and detailed error payloads', async () => {
    configured(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('PRIVATE-CREDENTIAL', { status: 503 })));
    await expect(researchInference(input)).rejects.toThrow('Inference failed or unavailable');
  });
  it('rejects malformed inventory rather than crashing the model selector', async () => {
    configured(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(modelInventory()).rejects.toThrow('Inference inventory unavailable');
  });
  it('bounds response bytes before decoding upstream JSON', async () => {
    configured(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(' '.repeat(500_001))));
    await expect(researchInference(input)).rejects.toThrow('no result has been saved');
  });
});
