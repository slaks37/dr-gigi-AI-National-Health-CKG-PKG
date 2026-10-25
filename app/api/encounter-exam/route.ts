import { api, ApiError, readJson, requireAccess, validId } from '@/src/server/security';
import { store } from '@/src/server/store';
import { SaveExamSchema } from '@/src/clinical-engine/evidence/encounter';
import { parse } from '@/src/clinical-engine/validation/parse';
import { FieldValue } from 'firebase-admin/firestore';

export const GET = api(async (req, p) => {
  const id = validId(req.nextUrl.searchParams.get('id'));
  const snap = await store().collection('records').doc(id).get();
  if (!snap.exists) throw new ApiError(404, 'Screening not found');
  const data = snap.data()!;
  requireAccess(p, data);
  return { success: true, examination: data.examination ?? null, version: data.version };
});

export const POST = api(async (req, p) => {
  if (p.role !== 'doctor' || !p.clinicalReviewer) throw new ApiError(403, 'Verified dentist required');
  const input = parse(SaveExamSchema, await readJson(req, 100_000));
  const ref = store().collection('records').doc(input.screening_id);
  return store().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ApiError(404, 'Screening not found');
    const data = snap.data()!;
    requireAccess(p, data);
    if (!data.screening || !data.assignedClinicianUids?.includes(p.uid) || data.createdBy === p.uid) throw new ApiError(403, 'Independent assigned dentist required');
    if (data.version !== input.expected_version) throw new ApiError(409, 'Record changed; reload before saving');
    if (data.screening.clinician_review.status === 'APPROVED') throw new ApiError(409, 'Confirmed encounter is locked; record a new examination');
    const version = data.version + 1;
    const examination = { ...input.examination, author_uid: p.uid, recorded_at: new Date().toISOString(), version };
    tx.update(ref, { examination, version, updatedAt: examination.recorded_at });
    tx.create(store().collection('examinationRevisions').doc(), { recordId: ref.id, examination, previous: data.examination ?? null, actorUid: p.uid, timestamp: FieldValue.serverTimestamp() });
    tx.create(store().collection('consentRecords').doc(), { recordId: ref.id, patientId: data.screening.patient_id, version: input.examination.consent_version, attestedBy: p.uid, timestamp: FieldValue.serverTimestamp() });
    tx.create(store().collection('auditLogs').doc(), { actorUid: p.uid, action: 'ENCOUNTER_EXAM_SAVE', resourceId: input.screening_id, version, timestamp: FieldValue.serverTimestamp() });
    return { success: true, examination, version, persistence: 'CONFIRMED' };
  });
});
