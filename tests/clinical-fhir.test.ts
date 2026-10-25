import { describe, expect, it } from 'vitest';
import { buildClinicalDraft, ClinicalFhirRequestSchema } from '../src/server/fhir';
import { screen } from '../src/clinical-engine/core/pipeline';
import { ScreeningRequestSchema, type Screening } from '../src/clinical-engine/types/schema';
import { EncounterExamSchema } from '../src/clinical-engine/evidence/encounter';
const identifiers = { patientIhsId: 'synthetic-patient-ihs', organizationIhsId: 'synthetic-org-ihs', practitionerIhsId: 'synthetic-dentist-ihs', encounterIhsId: 'synthetic-encounter-ihs' };
async function reviewed(): Promise<Screening> {
  const base = await screen(ScreeningRequestSchema.parse({ screening_id: 'synthetic-fhir', context: 'ADULT', patient_age: 28, symptoms: {}, images: [], consent_to_process: true }), 'synthetic-patient');
  return { ...base, screening_status: 'CLINICIAN_CONFIRMED', confirmed_icd10: ['K02.9', 'K08.3'], clinician_review: { status: 'APPROVED', reviewer_uid: 'synthetic-dentist', reviewed_at: '2026-01-01T03:00:00Z', note: 'Synthetic clinician review only', evidence: ['Synthetic direct examination', 'Synthetic radiograph interpretation'] } };
}
const exam = EncounterExamSchema.parse({ dentition: 'PERMANENT', orientation_known: true, medical_history: '', medications_allergies: '', extraoral: '', mucosa: '', periodontal: '', clinical_notes: '', consent_confirmed: true, consent_version: 'sonri-exam-consent-1', teeth: [{ fdi: '11', status: 'FINDING', surfaces: ['BUCCAL'], observation: 'Synthetic surface finding' }, { fdi: '12', status: 'NOT_ASSESSED', surfaces: [], observation: '' }] });

describe('clinician-reviewed local FHIR collection', () => {
  it('maps one exact WHO2010 Condition per confirmed code with reviewer provenance and UTC time', async () => {
    const draft = buildClinicalDraft(await reviewed(), identifiers);
    expect(draft.type).toBe('collection');
    expect(draft.entry).toHaveLength(3);
    const conditions = draft.entry.filter(item => item.resource.resourceType === 'Condition');
    expect(conditions.map(item => item.resource.code)).toEqual([
      { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', version: '2010', code: 'K02.9', display: 'Dental caries, unspecified' }] },
      { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', version: '2010', code: 'K08.3', display: 'Retained dental root' }] },
    ]);
    expect(conditions[0].resource.subject).toEqual({ reference: 'Patient/synthetic-patient-ihs' });
    expect(conditions[0].resource.asserter).toEqual({ reference: 'Practitioner/synthetic-dentist-ihs' });
    expect(conditions[0].resource.recordedDate).toBe('2026-01-01T03:00:00.000Z');
    expect(conditions[0].resource).not.toHaveProperty('clinicalStatus');
    expect(conditions[0].resource).not.toHaveProperty('onsetDateTime');
    const provenance = draft.entry.at(-1)!.resource;
    expect(provenance.resourceType).toBe('Provenance');
    expect(provenance.target).toEqual(conditions.map(item => ({ reference: item.fullUrl })));
    expect(draft.entry.every(item => !('request' in item))).toBe(true);
  });
  it('preserves explicit FDI as text without assigning unsupported code systems or negative findings', async () => {
    const draft = buildClinicalDraft(await reviewed(), identifiers, exam);
    const observations = draft.entry.filter(item => item.resource.resourceType === 'Observation');
    expect(observations).toHaveLength(1);
    expect(observations[0].resource.bodySite).toEqual({ text: 'FDI 11' });
    expect(observations[0].resource.valueCodeableConcept).toEqual({ text: 'FINDING' });
    expect(observations[0].resource.status).toBe('preliminary');
    expect(() => buildClinicalDraft({} as Screening, identifiers)).toThrow();
  });
  it('fails closed for unconfirmed, stale-version, CM, unsupported and NIK input', async () => {
    const source = await reviewed();
    expect(() => buildClinicalDraft({ ...source, screening_status: 'REVIEW_REQUIRED', confirmed_icd10: [] }, identifiers)).toThrow();
    expect(() => buildClinicalDraft({ ...source, terminology_version: 'WHO-ICD10-2019' }, identifiers)).toThrow();
    for (const code of ['K02.5', 'K02.51', 'K05']) expect(() => buildClinicalDraft({ ...source, confirmed_icd10: [code] }, identifiers)).toThrow();
    expect(() => buildClinicalDraft(source, { ...identifiers, patientIhsId: '1111111111111111' })).toThrow();
    expect(() => buildClinicalDraft(source, { ...identifiers, encounterIhsId: '../encounter' })).toThrow();
    expect(() => buildClinicalDraft({ ...source, clinician_review: { ...source.clinician_review, evidence: ['   '] } }, identifiers)).toThrow();
  });
  it('requires explicit preview, record version and only resolved identifiers in API payload', () => {
    const payload = { mode: 'preview', screening_id: 'synthetic-fhir', expected_version: 3, identifiers };
    expect(ClinicalFhirRequestSchema.safeParse(payload).success).toBe(true);
    expect(ClinicalFhirRequestSchema.safeParse({ ...payload, mode: 'submit' }).success).toBe(false);
    expect(ClinicalFhirRequestSchema.safeParse({ ...payload, confirmed_icd10: ['K02.9'] }).success).toBe(false);
    expect(ClinicalFhirRequestSchema.safeParse({ ...payload, expected_version: 0 }).success).toBe(false);
  });
});
