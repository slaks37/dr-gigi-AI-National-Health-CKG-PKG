import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { authenticatedFetch } from './apiClient';

export enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write' }
export function handleFirestoreError(_error: unknown, _operation: OperationType, _path: string | null): never {
  throw new Error('Penyimpanan tidak berhasil. Periksa koneksi dan izin akun, lalu coba lagi.');
}
export function generateSecureId(prefix = 'id'): string { return `${prefix}_${crypto.randomUUID()}`; }
function signedIn() {
  if (!auth.currentUser) throw new Error('Harap masuk akun. Penyimpanan medis offline dinonaktifkan untuk melindungi privasi.');
  return auth.currentUser;
}
export function clearLegacyClinicalStorage() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('drgigi_offline_records_v1');
    localStorage.removeItem('drgigi_offline_patients_v1');
  }
}
export async function recordAppUsage(module: string, action: string, _details?: unknown) {
  if (!auth.currentUser) return;
  await authenticatedFetch('/api/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module, action }) });
}
export async function syncUserProfileToDb(_user: unknown) {
  const res = await authenticatedFetch('/api/auth/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  return res.json();
}
// Firestore is authoritative. SQL legacy data is quarantined pending an operator-reviewed migration.
// Clinical mutations are single server transactions with an append-only audit event.
export async function saveRecord(record: Record<string, unknown>) {
  const user = signedIn();
  const id = typeof record.id === 'string' ? record.id : generateSecureId('rec');
  record.id = id; // Retain the same ID after a lost response so retry is idempotent.
  const payload = { ...record };
  delete payload.version;
  const res = await authenticatedFetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, payload: { ...payload, id, userId: user.uid } }) });
  const saved = await res.json();
  record.id = saved.recordId;
  record.version = saved.version;
  return saved.recordId as string;
}
export async function updateRecord(id: string, updates: Record<string, unknown>) {
  signedIn();
  if (Object.keys(updates).some(k => k !== 'is_accurate')) throw new Error('Hanya umpan balik yang didukung.');
  const current = await authenticatedFetch(`/api/records?id=${encodeURIComponent(id)}`);
  const { records } = await current.json();
  const res = await authenticatedFetch('/api/records', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_accurate: updates.is_accurate, expectedVersion: records[0].version ?? 0 }) });
  return res.json();
}
async function listAll(kind: 'records' | 'appointments') {
  if (!auth.currentUser) return [];
  const uid = auth.currentUser.uid;
  const results: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  do {
    const res = await authenticatedFetch(`/api/${kind}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const body = await res.json();
    if (auth.currentUser?.uid !== uid) throw new Error('Sesi berubah; muat ulang.');
    results.push(...body[kind]);
    cursor = body.nextCursor;
  } while (cursor);
  return results;
}
export async function getAllRecords(_role?: string | null): Promise<any[]> { return listAll('records'); }
export async function deleteRecord(id: string) { await authenticatedFetch(`/api/records?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function saveAppointment(appointment: Record<string, unknown>) {
  const user = signedIn();
  const id = typeof appointment.id === 'string' ? appointment.id : generateSecureId('apt');
  const res = await authenticatedFetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, payload: { ...appointment, id, userId: user.uid } }) });
  return res.json();
}
export async function getAllAppointments(_role?: string | null): Promise<any[]> { return listAll('appointments'); }
export async function deleteAppointment(id: string) { await authenticatedFetch(`/api/appointments?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function getAllUsers(role?: string | null) {
  if (!auth.currentUser || role !== 'admin') return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => d.data());
}
export async function savePatient(patient: Record<string, unknown>) {
  const user = signedIn();
  const id = typeof patient.id === 'string' ? patient.id : generateSecureId('pat');
  await setDoc(doc(db, 'patients', id), { ...patient, id, userId: user.uid, createdAt: new Date().toISOString() });
  return id;
}
export async function getAllPatients(_role?: string | null): Promise<any[]> {
  if (!auth.currentUser) return [];
  const user = auth.currentUser;
  const snap = await getDocs(query(collection(db, 'patients'), where('userId', '==', user.uid)));
  if (auth.currentUser?.uid !== user.uid) throw new Error('Sesi berubah; muat ulang.');
  return snap.docs.map(d => d.data());
}
export async function getPatient(id: string) {
  const user = signedIn();
  const snap = await getDoc(doc(db, 'patients', id));
  if (auth.currentUser?.uid !== user.uid) throw new Error('Sesi berubah; muat ulang.');
  return snap.exists() ? snap.data() : null;
}
// No automatic import: a shared-browser guest record has no verifiable ownership.
export async function migrateFromLocalStorage() {
  // Retired: legacy unscoped records are not read, reassigned, uploaded, or automatically erased.
  // An operator must arrange backup and explicit cache cleanup before production rollout.
}
