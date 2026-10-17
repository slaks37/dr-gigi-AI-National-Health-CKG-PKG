import { expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const user = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../src/lib/firebase-admin', () => ({ adminAuth: { verifyIdToken: async () => ({ uid: 'synthetic', role: user.role }) } }));
import { POST } from '../app/api/vision-lab/browser/route';
const request = (body: unknown, auth = true) => new NextRequest('http://localhost/api/vision-lab/browser', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer synthetic' } : {}) }, body: JSON.stringify(body) });
it('requires server-verified administrator and explicit synthetic research permission', async () => {
    const body = { research_authorized: true, synthetic_only: true };
    expect((await POST(request(body, false))).status).toBe(401);
    for (const role of ['patient', 'doctor']) { user.role = role; expect((await POST(request(body))).status).toBe(403); }
    user.role = 'admin'; expect((await POST(request({ ...body, synthetic_only: false }))).status).toBe(400);
    expect((await POST(request({ ...body, prediction: [] }))).status).toBe(400);
    const response = await POST(request(body)); expect(response.status).toBe(200); expect((await response.json()).artifacts).toBe('LOCAL_FILE_ONLY'); expect(response.headers.get('cache-control')).toContain('no-store');
});
