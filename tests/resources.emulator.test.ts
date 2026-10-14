import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.hoisted(() => {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
  process.env.GCLOUD_PROJECT = 'demo-drgigi-repair';
  process.env.FIRESTORE_DATABASE_ID = '(default)';
});
import { adminAuth } from '../src/lib/firebase-admin';
import { store } from '../src/server/store';
import * as records from '../app/api/records/route';
import * as appointments from '../app/api/appointments/route';
import * as preferences from '../app/api/preferences/route';
const request = (path: string, uid: string, method = 'GET', body?: unknown) => new NextRequest(`http://localhost/api/${path}`, { method, headers: { Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
beforeAll(() => {
  vi.spyOn(adminAuth, 'verifyIdToken').mockImplementation(async token => ({ uid: token, sub: token, role: 'patient', aud: 'demo-drgigi-repair', auth_time: 0, exp: 9999999999, iat: 0, iss: 'synthetic-emulator', firebase: { identities: {}, sign_in_provider: 'custom' } } as Awaited<ReturnType<typeof adminAuth.verifyIdToken>>));
});
beforeEach(async () => {
  // Emulator only, synthetic identities only. Project guard prevents accidental production cleanup.
  if (process.env.GCLOUD_PROJECT !== 'demo-drgigi-repair' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8088') throw new Error('Synthetic emulator required');
  for (const name of ['records', 'appointments', 'auditLogs', 'preferences']) {
    const snapshot = await store().collection(name).get();
    await Promise.all(snapshot.docs.map(d => d.ref.delete()));
  }
});
afterAll(() => vi.restoreAllMocks());
describe('real Firestore server transactions in isolated emulator', () => {
  it('persists, reloads, applies feedback with version conflict, and deletes atomically', async () => {
    const created = await records.POST(request('records', 'synthetic-a', 'POST', { id: 'synthetic-record', payload: { type: 'synthetic', diagnosa: 'Unreviewed test fixture' } }));
    expect(created.status).toBe(200);
    const saved = await created.json(); expect(saved.persistence).toBe('CONFIRMED');
    const loaded = await records.GET(request('records?id=synthetic-record', 'synthetic-a'));
    expect((await loaded.json()).records[0].version).toBe(1);
    expect((await records.PATCH(request('records', 'synthetic-a', 'PATCH', { id: 'synthetic-record', expectedVersion: 1, is_accurate: true }))).status).toBe(200);
    expect((await records.PATCH(request('records', 'synthetic-a', 'PATCH', { id: 'synthetic-record', expectedVersion: 1, is_accurate: false }))).status).toBe(409);
    expect((await records.DELETE(request('records?id=synthetic-record', 'synthetic-b', 'DELETE'))).status).toBe(403);
    expect((await records.DELETE(request('records?id=synthetic-record', 'synthetic-a', 'DELETE'))).status).toBe(200);
    expect((await store().collection('records').doc('synthetic-record').get()).exists).toBe(false);
    expect((await store().collection('auditLogs').get()).size).toBe(3);
  });
  it('idempotent creation produces one record and one audit event', async () => {
    const body = { id: 'synthetic-record', payload: { type: 'synthetic' } };
    const responses = await Promise.all([records.POST(request('records', 'synthetic-a', 'POST', body)), records.POST(request('records', 'synthetic-a', 'POST', body))]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect((await store().collection('auditLogs').get()).size).toBe(1);
    expect((await records.GET(request('records?role=admin&userUid=synthetic-a', 'synthetic-b'))).status).toBe(200);
    expect((await (await records.GET(request('records?role=admin&userUid=synthetic-a', 'synthetic-b'))).json()).records).toEqual([]);
  });
  it('appointment survives reload and preferences are scoped to each user', async () => {
    expect((await appointments.POST(request('appointments', 'synthetic-a', 'POST', { id: 'synthetic-apt', payload: { date: '2026-10-14T10:00:00Z', doctor: 'Synthetic doctor', patient_name: 'Synthetic patient' } }))).status).toBe(200);
    expect((await (await appointments.GET(request('appointments', 'synthetic-a'))).json()).appointments).toHaveLength(1);
    expect((await (await appointments.GET(request('appointments', 'synthetic-b'))).json()).appointments).toEqual([]);
    const prefs = { language: 'en', textSize: 'large', highContrast: true };
    expect((await preferences.POST(request('preferences', 'synthetic-a', 'POST', prefs))).status).toBe(200);
    expect((await (await preferences.GET(request('preferences', 'synthetic-a'))).json()).preferences).toEqual(prefs);
    expect((await (await preferences.GET(request('preferences', 'synthetic-b'))).json()).preferences.language).toBe('id');
  });
});
