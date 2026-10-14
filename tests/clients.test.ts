import { beforeEach, describe, it, expect, vi } from 'vitest';
const context = vi.hoisted(() => ({ user: null as null | { uid: string; getIdToken: () => Promise<string> } }));
vi.mock('../app/lib/firebase', () => ({ db: {}, auth: { get currentUser() { return context.user; } } }));
import { authenticatedFetch } from '../app/lib/apiClient';
import { clearLegacyClinicalStorage, saveRecord, updateRecord, getAllRecords } from '../app/lib/db';
import { getNearbyClinics } from '../app/actions/get-clinics';
beforeEach(() => { context.user = { uid: 'synthetic-a', getIdToken: async () => 'synthetic-token' }; vi.unstubAllGlobals(); });
describe('client persistence and privacy', () => {
  it('attaches a verified ID token and exposes HTTP storage failures', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(saveRecord({ type: 'synthetic' })).rejects.toThrow('Unavailable');
    expect((fetch.mock.calls[0][1].headers as Headers).get('authorization')).toBe('Bearer synthetic-token');
  });
  it('rejects data received after account switching', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { context.user = { uid: 'synthetic-b', getIdToken: async () => 'token-b' }; return new Response('{}'); }));
    await expect(authenticatedFetch('/api/records')).rejects.toThrow('Sesi telah berubah');
  });
  it('feedback uses the persisted ID and current version, preserving clinical fields', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ records: [{ id: 'saved-id', version: 4 }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, version: 5 })));
    vi.stubGlobal('fetch', fetch);
    await updateRecord('saved-id', { is_accurate: true });
    expect(fetch.mock.calls[0][0]).toBe('/api/records?id=saved-id');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ id: 'saved-id', is_accurate: true, expectedVersion: 4 });
  });
  it('removes unscoped legacy caches without reading or migrating another patient', async () => {
    const removeItem = vi.fn(); const getItem = vi.fn(); const setItem = vi.fn();
    vi.stubGlobal('window', {}); vi.stubGlobal('localStorage', { removeItem, getItem, setItem });
    context.user = null;
    clearLegacyClinicalStorage();
    expect(await getAllRecords()).toEqual([]);
    expect(removeItem).toHaveBeenCalledWith('drgigi_offline_records_v1');
    expect(getItem).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled();
  });
});
describe('traceable clinic referrals', () => {
  it('returns empty error when provider is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
    const result = await getNearbyClinics(-6, 106);
    expect(result.success).toBe(false); expect(result.clinics).toEqual([]);
  });
  it('returns only sourced facilities, leaving unverified metadata unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ elements: [{ id: 1, type: 'node', lat: -6, lon: 106, tags: { amenity: 'dentist', name: 'Synthetic OSM Fixture' } }] }))));
    const { clinics } = await getNearbyClinics(-6, 106);
    expect(clinics).toHaveLength(1);
    expect(clinics[0]).toMatchObject({ sourceUrl: 'https://www.openstreetmap.org/node/1', phone: '', rating: null, reviews: null, open: null });
    expect(clinics[0].tags).not.toContain('BPJS');
  });
  it('empty real results remain empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"elements":[]}')));
    expect((await getNearbyClinics(-6, 106)).clinics).toEqual([]);
  });
});
