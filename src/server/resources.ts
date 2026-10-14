import { NextRequest } from 'next/server';
import { ApiError, Principal, canAccess, requireAccess, object, onlyKeys, readJson, validId } from './security';
import { store } from './store';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';

const RECORD_KEYS = ['id', 'timestamp', 'patient_id', 'patientName', 'patient_name', 'name', 'nik', 'type', 'diagnosa', 'icd10', 'confidence', 'image_url', 'json_output', 'markdown_report', 'messages', 'userId', 'version', 'is_accurate', 'feedback_notes'];
const APPOINTMENT_KEYS = ['id', 'userId', 'version', 'patient_id', 'patientName', 'patient_name', 'name', 'doctor', 'doctorName', 'clinicName', 'date', 'time', 'status', 'notes', 'complaint', 'created_at'];
export function validatePayload(value: unknown, kind: 'records' | 'appointments') {
  const payload = object(value);
  onlyKeys(payload, kind === 'records' ? RECORD_KEYS : APPOINTMENT_KEYS);
  if (typeof payload.type !== 'string' && kind === 'records') throw new ApiError(400, 'Record type required');
  if (kind === 'appointments' && (typeof payload.date !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(payload.date) || !Number.isFinite(Date.parse(String(payload.date))))) throw new ApiError(400, 'Appointment date required');
  if (payload.json_output && typeof payload.json_output === 'object' && ['screening','clinician_review','confirmed_icd10'].some(k => k in (payload.json_output as Record<string, unknown>))) throw new ApiError(400, 'Structured screening requires the dedicated server workflow');
  if (payload.id !== undefined) validId(payload.id);
  for (const field of ['patientName', 'patient_name', 'name', 'diagnosa', 'icd10', 'type', 'doctor', 'doctorName', 'notes', 'feedback_notes']) {
    if (payload[field] !== undefined && (typeof payload[field] !== 'string' || String(payload[field]).length > 4000)) throw new ApiError(400, 'Invalid text field');
  }
  return payload;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function resourceHandlers(kind: 'records' | 'appointments') {
  return {
    async list(req: NextRequest, p: Principal) {
      const cursor = req.nextUrl.searchParams.get('cursor');
      const limitText = req.nextUrl.searchParams.get('limit') || '50';
      if (!/^\d{1,3}$/.test(limitText)) throw new ApiError(400, 'Invalid limit');
      const limit = Math.min(100, Math.max(1, Number(limitText)));
      let q = store().collection(kind).where('userId', '==', p.uid).orderBy('__name__').limit(limit);
      if (p.role === 'admin') q = store().collection(kind).orderBy('__name__').limit(limit);
      // Doctor reads are owner-scoped by default; explicitly assigned resources can be read by ID.
      const id = req.nextUrl.searchParams.get('id');
      if (id) {
        const snap = await store().collection(kind).doc(validId(id)).get();
        if (!snap.exists) throw new ApiError(404, 'Resource not found');
        requireAccess(p, snap.data()!);
        return { success: true, [kind]: [snap.data()] };
      }
      if (cursor) q = q.startAfter(validId(cursor));
      const snap = await q.get();
      return { success: true, [kind]: snap.docs.map(d => d.data()), nextCursor: snap.size === limit ? snap.docs.at(-1)?.id : null };
    },
    async save(req: NextRequest, p: Principal) {
      const body = await readJson(req);
      onlyKeys(body, ['id', 'payload', 'expectedVersion']);
      const id = validId(body.id);
      const payload = validatePayload(body.payload, kind);
      if (payload.userId !== undefined && payload.userId !== p.uid) throw new ApiError(403, 'Owner cannot be supplied for another user');
      const ref = store().collection(kind).doc(id);
      const hash = createHash('sha256').update(canonical(payload)).digest('hex');
      return store().runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (snap.exists) {
          const previous = snap.data()!;
          requireAccess(p, previous);
          if (previous.userId === p.uid && previous.mutationHash === hash) return { success: true, recordId: id, version: previous.version, persistence: 'CONFIRMED', record: previous };
          if (body.expectedVersion !== previous.version) throw new ApiError(409, 'Record changed; reload before saving');
          // Clinical content is immutable in this repair. Feedback is a distinct PATCH operation.
          throw new ApiError(409, 'Existing resource cannot be overwritten');
        }
        if (body.expectedVersion !== undefined && body.expectedVersion !== 0) throw new ApiError(409, 'Resource no longer exists');
        const now = new Date().toISOString();
        const data = { ...payload, id, userId: p.uid, version: 1, timestamp: now, createdAt: now, updatedAt: now, createdBy: p.uid,
          mutationHash: hash, assignedClinicianUids: [], source: 'user-entered', verificationStatus: 'draft', satusehatSynced: false, confidence: 'Belum tervalidasi' };
        tx.create(ref, data);
        tx.create(store().collection('auditLogs').doc(), { actorUid: p.uid, action: 'CREATE', resourceType: kind, resourceId: id, timestamp: FieldValue.serverTimestamp() });
        return { success: true, recordId: id, version: 1, persistence: 'CONFIRMED', record: data };
      });
    },
    async feedback(req: NextRequest, p: Principal) {
      const body = await readJson(req, 4096);
      onlyKeys(body, ['id', 'is_accurate', 'expectedVersion']);
      const id = validId(body.id);
      if (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) throw new ApiError(400, 'Valid expectedVersion required');
      if (typeof body.is_accurate !== 'boolean') throw new ApiError(400, 'Boolean feedback required');
      const ref = store().collection(kind).doc(id);
      return store().runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiError(404, 'Resource not found');
        const data = snap.data()!;
        requireAccess(p, data);
        if ((data.version ?? 0) !== body.expectedVersion) throw new ApiError(409, 'Record changed; reload before saving');
        const version = Number(data.version || 0) + 1;
        tx.update(ref, { is_accurate: body.is_accurate, version, updatedAt: new Date().toISOString() });
        tx.create(store().collection('auditLogs').doc(), { actorUid: p.uid, action: 'FEEDBACK', resourceType: kind, resourceId: id, timestamp: FieldValue.serverTimestamp() });
        return { success: true, recordId: id, version, persistence: 'CONFIRMED' };
      });
    },
    async remove(req: NextRequest, p: Principal) {
      const id = validId(req.nextUrl.searchParams.get('id'));
      const ref = store().collection(kind).doc(id);
      return store().runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiError(404, 'Resource not found');
        const data = snap.data()!;
        if (!canAccess(p, data) || (p.role !== 'admin' && data.userId !== p.uid)) throw new ApiError(403, 'Deletion denied');
        tx.delete(ref);
        tx.create(store().collection('auditLogs').doc(), { actorUid: p.uid, action: 'DELETE', resourceType: kind, resourceId: id, timestamp: FieldValue.serverTimestamp() });
        return { success: true, persistence: 'CONFIRMED' };
      });
    },
  };
}
