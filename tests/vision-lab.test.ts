import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
const fake = vi.hoisted(() => ({ uid: 'synthetic-admin', configured: true, infer: vi.fn() }));
vi.mock('../src/lib/firebase-admin', () => ({ adminAuth: { verifyIdToken: async () => ({ uid: fake.uid, role: 'admin' }) } }));
vi.mock('../src/clinical-engine/vision/adapters/local-research', () => ({ localResearchConfigured: () => fake.configured, localResearchInference: fake.infer }));
import { POST } from '../app/api/vision-lab/route';
const req = (body: unknown) => new NextRequest('http://localhost/api/vision-lab', { method: 'POST', headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function input() { const bytes = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#eeeeee' } }).png().toBuffer(); return { image: { mime_type: 'image/png', data: bytes.toString('base64') }, image_use_authorized: true }; }
beforeEach(() => { fake.uid = 'synthetic-' + crypto.randomUUID(); fake.configured = true; fake.infer.mockReset(); });
describe('research-only local inference API', () => {
    it('requires explicit image-use permission and rejects fabricated request fields', async () => { expect((await POST(req({ ...await input(), image_use_authorized: false }))).status).toBe(400); expect((await POST(req({ ...await input(), artifact_path: '/untrusted/path' }))).status).toBe(400); expect(fake.infer).not.toHaveBeenCalled(); });
    it('rejects corrupt media without calling model', async () => { expect((await POST(req({ image: { mime_type: 'image/png', data: 'AAAA' }, image_use_authorized: true }))).status).toBe(400); expect(fake.infer).not.toHaveBeenCalled(); });
    it('returns research provenance and normalized image only, without clinical confirmation', async () => { fake.infer.mockResolvedValue({ inference_status: 'SUCCEEDED', readiness: 'EXPERIMENTAL', detections: [] }); const response = await POST(req(await input())); expect(response.status).toBe(200); const result = await response.json(); expect(result.clinical_use).toBe('PROHIBITED'); expect(result.oral_region_status).toBe('NOT_ASSESSED'); expect(result.source_images_retained).toBe(false); expect(result.normalized_image.mime_type).toBe('image/jpeg'); expect(result.confirmed_icd10).toBeUndefined(); expect(response.headers.get('cache-control')).toContain('no-store'); });
    it('blocks concurrent inference and releases its worker after model failure', async () => { let fail: (e: Error) => void = () => { }; fake.infer.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; })); const running = POST(req(await input())); await vi.waitFor(() => expect(fake.infer).toHaveBeenCalled()); expect((await POST(req(await input()))).status).toBe(429); fail(new Error('PRIVATE-INTERNAL-DETAIL')); const response = await running; expect(response.status).toBe(503); expect(await response.text()).not.toContain('PRIVATE-INTERNAL-DETAIL'); fake.infer.mockResolvedValue({ detections: [] }); expect((await POST(req(await input()))).status).toBe(200); });
    it('rate limits repeated administrator attempts', async () => { fake.configured = false; for (let i = 0; i < 5; i++)
        expect((await POST(req(await input()))).status).toBe(503); expect((await POST(req(await input()))).status).toBe(429); });
});
