import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const fake = vi.hoisted(() => ({ data: new Map<string, Record<string, unknown>>(), verify: vi.fn(), fail: false, counter: 0 }));
vi.mock('../src/lib/firebase-admin', () => ({ adminAuth: { verifyIdToken: fake.verify } }));
vi.mock('../src/server/store', () => {
  const snapshot = (key: string) => ({ exists: fake.data.has(key), data: () => fake.data.get(key) });
  const collection = (name: string) => ({
    doc: (id = `synthetic-${++fake.counter}`) => ({ key: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`), set: async (data: Record<string, unknown>) => { if (fake.fail) throw new Error('PRIVATE-DB-CREDENTIAL'); fake.data.set(`${name}/${id}`, data); } }),
    orderBy: () => query(name), where: (_field: string, _op: string, uid: string) => query(name, uid),
    add: async (data: Record<string, unknown>) => { if (fake.fail) throw new Error('PRIVATE-DB-CREDENTIAL'); fake.data.set(`${name}/${++fake.counter}`, data); },
    count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
  });
  const query = (name: string, uid?: string) => {
    const q = { orderBy: () => q, limit: () => q, startAfter: () => q, get: async () => {
      if (fake.fail) throw new Error('PRIVATE-DB-CREDENTIAL');
      const docs = [...fake.data.entries()].filter(([key, d]) => key.startsWith(name + '/') && (!uid || d.userId === uid)).map(([key, data]) => ({ id: key.split('/')[1], data: () => data }));
      return { docs, size: docs.length };
    } }; return q;
  };
  return { store: () => ({ collection, runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    if (fake.fail) throw new Error('PRIVATE-DB-CREDENTIAL');
    const writes: (() => void)[] = [];
    const tx = {
      get: async (ref: { key: string }) => snapshot(ref.key),
      create: (ref: { key: string }, data: Record<string, unknown>) => writes.push(() => { fake.data.set(ref.key, data); }),
      update: (ref: { key: string }, data: Record<string, unknown>) => writes.push(() => { fake.data.set(ref.key, { ...fake.data.get(ref.key), ...data }); }),
      delete: (ref: { key: string }) => writes.push(() => { fake.data.delete(ref.key); }),
    };
    const result = await fn(tx); writes.forEach(write => write()); return result;
  } }) };
});
import * as records from '../app/api/records/route';
import * as appointments from '../app/api/appointments/route';
import * as stats from '../app/api/stats/route';
import * as activity from '../app/api/activity/route';
import * as sync from '../app/api/auth/sync/route';
import * as ai from '../app/api/gemini/analyze/route';
import * as consultation from '../app/api/gemini/consultation/route';
import * as iot from '../app/api/iot/ingest/route';
import * as satusehat from '../app/api/satusehat/sync/route';
import * as preferences from '../app/api/preferences/route';
import * as coverage from '../app/api/clinical-coverage/route';
import * as staging from '../app/api/staging-readiness/route';
function req(path: string, token?: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost/api/${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  fake.data.clear(); fake.fail = false; fake.counter = 0;
  fake.verify.mockImplementation(async (token: string) => {
    if (token === 'invalid') throw Object.assign(new Error('PRIVATE-AUTH-DATA'), { code: 'auth/invalid-id-token' });
    if (token === 'auth-outage') throw new Error('PRIVATE-AUTH-CREDENTIAL');
    return { uid: token, role: token === 'admin' ? 'admin' : token === 'doctor' ? 'doctor' : 'patient', email: `${token}@example.test` };
  });
  fake.data.set('records/b', { id: 'b', userId: 'patient-b', type: 'synthetic', version: 1, assignedClinicianUids: [] });
});
describe('API authentication', () => {
  it.each([
    ['records', records.GET, 'GET'], ['records', records.POST, 'POST'], ['records', records.PATCH, 'PATCH'], ['records', records.DELETE, 'DELETE'],
    ['appointments', appointments.GET, 'GET'], ['appointments', appointments.POST, 'POST'], ['activity', activity.GET, 'GET'], ['activity', activity.POST, 'POST'],
    ['stats', stats.GET, 'GET'], ['auth/sync', sync.POST, 'POST'], ['gemini/analyze', ai.POST, 'POST'], ['gemini/consultation', consultation.POST, 'POST'],
    ['iot/ingest', iot.POST, 'POST'], ['iot/ingest', iot.GET, 'GET'], ['satusehat/sync', satusehat.POST, 'POST'], ['preferences', preferences.POST, 'POST'], ['clinical-coverage', coverage.GET, 'GET'], ['staging-readiness', staging.GET, 'GET'],
  ] as const)('denies anonymous %s %s', async (path, handler, method) => {
    const response = await handler(req(path, undefined, method, method === 'POST' || method === 'PATCH' ? {} : undefined));
    expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('reports authentication infrastructure outages truthfully without exposing credentials', async () => {
    const response = await records.GET(req('records', 'auth-outage'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('PRIVATE-AUTH-CREDENTIAL');
  });
  it('rejects invalid token; checks revocation', async () => {
    expect((await records.GET(req('records', 'invalid'))).status).toBe(401);
    expect(fake.verify).toHaveBeenCalledWith('invalid', true);
  });
});
describe('ownership and RBAC', () => {
  it('ignores query UID and role spoofing', async () => {
    const response = await records.GET(req('records?role=admin&userUid=patient-b', 'patient-a'));
    expect((await response.json()).records).toEqual([]);
  });
  it('denies cross-patient read, update, delete and overwrite', async () => {
    expect((await records.GET(req('records?id=b', 'patient-a'))).status).toBe(403);
    expect((await records.PATCH(req('records', 'patient-a', 'PATCH', { id: 'b', is_accurate: true, expectedVersion: 1 }))).status).toBe(403);
    expect((await records.DELETE(req('records?id=b', 'patient-a', 'DELETE'))).status).toBe(403);
    expect((await records.POST(req('records', 'patient-a', 'POST', { id: 'b', payload: { type: 'synthetic' } }))).status).toBe(403);
    expect(fake.data.get('records/b')?.userId).toBe('patient-b');
  });
  it('denies unassigned doctor and administrator spoofing', async () => {
    expect((await records.GET(req('records?id=b', 'doctor'))).status).toBe(403);
    expect((await sync.POST(req('auth/sync', 'patient-a', 'POST', { role: 'admin' }))).status).toBe(400);
    expect((await stats.GET(req('stats', 'patient-a'))).status).toBe(403);
    expect((await activity.GET(req('activity', 'doctor'))).status).toBe(403);
  });
  it('creates a draft with trusted owner and append-only audit, retries idempotently', async () => {
    const body = { id: 'a', payload: { type: 'synthetic', confidence: '100%' } };
    const first = await records.POST(req('records', 'patient-a', 'POST', body));
    const saved = await first.json();
    expect(saved.persistence).toBe('CONFIRMED'); expect(saved.record.userId).toBe('patient-a');
    expect(saved.record.confidence).toBe('Belum tervalidasi'); expect(saved.record.verificationStatus).toBe('draft');
    const retry = await records.POST(req('records', 'patient-a', 'POST', body));
    expect((await retry.json()).recordId).toBe('a');
    expect([...fake.data.keys()].filter(k => k.startsWith('auditLogs/'))).toHaveLength(1);
    expect((await records.POST(req('records', 'patient-a', 'POST', { ...body, payload: { type: 'modified' } }))).status).toBe(409);
  });
  it('feedback updates only stored record with conflict check', async () => {
    expect((await records.PATCH(req('records', 'patient-b', 'PATCH', { id: 'b', is_accurate: true, expectedVersion: 0 }))).status).toBe(409);
    const result = await records.PATCH(req('records', 'patient-b', 'PATCH', { id: 'b', is_accurate: true, expectedVersion: 1 }));
    expect(result.status).toBe(200); expect(fake.data.get('records/b')?.version).toBe(2);
    expect(fake.data.get('records/b')?.type).toBe('synthetic');
  });
  it('does not claim success or leak details when persistence fails', async () => {
    fake.fail = true;
    const result = await records.POST(req('records', 'patient-a', 'POST', { id: 'a', payload: { type: 'synthetic' } }));
    expect(result.status).toBe(503); expect(await result.text()).not.toContain('PRIVATE-DB');
    expect(fake.data.has('records/a')).toBe(false);
  });
  it('cannot spoof owner, assignment, provenance or sync status', async () => {
    for (const extra of [{ userId: 'patient-b' }, { assignedClinicianUids: ['patient-a'] }, { verificationStatus: 'approved' }, { satusehatSynced: true }]) {
      const result = await records.POST(req('records', 'patient-a', 'POST', { id: 'a', payload: { type: 'synthetic', ...extra } }));
      expect([400, 403]).toContain(result.status);
    }
  });
});
describe('truthful integration status', () => {
  it('does not report a legacy deployment as isolated hosted staging', async () => {
    expect((await staging.GET(req('staging-readiness', 'patient-a'))).status).toBe(403);
    expect((await staging.GET(req('staging-readiness', 'admin'))).status).toBe(404);
  });
  it('returns code-specific evidence status and rejects absent terminology after authentication', async () => {
    const response = await coverage.GET(req('clinical-coverage?code=K02.9', 'patient-a'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.rows).toHaveLength(1); expect(data.rows[0].code).toBe('K02.9');
    expect(data.rows[0].ai_evaluated_with_actual_data.evaluated).toBe(false);
    expect(data.clinical_use).toBe('PROHIBITED');
    expect((await coverage.GET(req('clinical-coverage?code=K02.51', 'patient-a'))).status).toBe(404);
  });
  it('SATUSEHAT unconfigured never returns remote sync success', async () => {
    const response = await satusehat.POST(req('satusehat/sync', 'admin', 'POST', {}));
    expect(response.status).toBe(503);
    const body = await response.json(); expect(body.success).toBe(false); expect(body.status).toBe('NOT_CONFIGURED'); expect(body.satusehat_id).toBeUndefined();
  });
  it('local preview remains DRAFT; simulated or AI data rejected', async () => {
    const data = { mode: 'preview', patientIhsId: 'ihs-p', organizationIhsId: 'ihs-o', practitionerIhsId: 'ihs-d', encounterIhsId: 'ihs-e', measuredAt: '2026-01-01T00:00:00Z', measurements: { weight_kg: { value: 60, source: 'measured' } } };
    const response = await satusehat.POST(req('satusehat/sync', 'admin', 'POST', data));
    const body = await response.json(); expect(body.status).toBe('DRAFT'); expect(body.submitted).toBe(false);
    expect((await satusehat.POST(req('satusehat/sync', 'admin', 'POST', { ...data, measurements: { weight_kg: { value: 60, source: 'simulated' } } }))).status).toBe(400);
  });
  it('clinical AI and device paths fail closed even with a valid user', async () => {
    for (const [path, handler] of [['gemini/analyze', ai.POST], ['gemini/consultation', consultation.POST], ['iot/ingest', iot.POST]] as const) {
      const response = await handler(req(path, 'patient-a', 'POST', {}));
      expect(response.status).toBe(503); expect((await response.json()).success).toBe(false);
    }
  });
  it('settings persist and reload for the verified account', async () => {
    const data = { language: 'en', textSize: 'large', highContrast: true };
    expect((await preferences.POST(req('preferences', 'patient-a', 'POST', data))).status).toBe(200);
    expect((await (await preferences.GET(req('preferences', 'patient-a'))).json()).preferences).toEqual(data);
    expect((await (await preferences.GET(req('preferences', 'patient-b'))).json()).preferences.language).toBe('id');
  });
  it('settings cannot store integration secrets', async () => {
    expect((await preferences.POST(req('preferences', 'patient-a', 'POST', { language: 'id', textSize: 'medium', highContrast: false, clientSecret: 'synthetic' }))).status).toBe(400);
  });
});
