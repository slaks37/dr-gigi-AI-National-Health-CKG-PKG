import { api, ApiError, readJson, requireAccess } from '@/src/server/security';
import { parse } from '@/src/clinical-engine/validation/parse';
import { store } from '@/src/server/store';
import { ClinicalFhirRequestSchema, buildClinicalDraft } from '@/src/server/fhir';
import { ScreeningSchema } from '@/src/clinical-engine/types/schema';
import { EncounterExamSchema } from '@/src/clinical-engine/evidence/encounter';
import { FieldValue } from 'firebase-admin/firestore';

export const POST = api(async (req, principal) => {
  if (principal.role !== 'admin' && (principal.role !== 'doctor' || !principal.clinicalReviewer)) throw new ApiError(403, 'Verified dentist or administrator required');
  const input = parse(ClinicalFhirRequestSchema, await readJson(req, 16_384));
  const snapshot = await store().collection('records').doc(input.screening_id).get();
  if (!snapshot.exists) throw new ApiError(404, 'Screening not found');
  const data = snapshot.data()!;
  requireAccess(principal, data);
  if (data.version !== input.expected_version) throw new ApiError(409, 'Record changed; reload before preview');
  const screening = parse(ScreeningSchema, data.screening);
  let examination;
  if (data.examination) {
    const { author_uid, recorded_at: _recordedAt, version: _version, ...exam } = data.examination;
    void _recordedAt; void _version;
    // Do not attribute a different clinician's odontogram to the supplied reviewer IHS ID.
    if (author_uid === screening.clinician_review.reviewer_uid) examination = parse(EncounterExamSchema, exam);
  }
  const bundle = buildClinicalDraft(screening, input.identifiers, examination);
  await store().collection('auditLogs').add({ actorUid: principal.uid, action: 'CLINICAL_FHIR_PREVIEW', resourceId: input.screening_id, version: data.version, submitted: false, timestamp: FieldValue.serverTimestamp() });
  return { success: true, status: 'DRAFT', satusehat_status: 'DRAFT', environment: 'sandbox', submitted: false, fhir_bundle: bundle, limitations: ['Pratinjau lokal; tidak ada data dikirim ke SATUSEHAT.', 'ID IHS dan keterkaitan identitas belum diverifikasi terhadap layanan SATUSEHAT.', 'Status klinis aktif/resolusi, profil program dan terminologi odontogram masih memerlukan verifikasi sandbox.', ...(data.examination && !examination ? ['Odontogram tidak dipetakan karena penulis berbeda dari dokter yang mengesahkan.'] : [])] };
});
