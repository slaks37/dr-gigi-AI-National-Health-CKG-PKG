import { randomUUID } from 'node:crypto';
import { ApiError, object, onlyKeys } from './security';
import { z } from 'zod';
import { ScreeningSchema, type Screening } from '../clinical-engine/types/schema';
import { EncounterExamSchema, type EncounterExam } from '../clinical-engine/evidence/encounter';
import { lookupCode, TERMINOLOGY_VERSION, validateCodes } from '../clinical-engine/terminology/catalog';

export function buildDraft(body: Record<string, unknown>) {
  if (body.mode !== 'preview') throw new ApiError(400, 'Local preview mode required');
  onlyKeys(body, ['mode', 'patientIhsId', 'organizationIhsId', 'practitionerIhsId', 'encounterIhsId', 'measuredAt', 'measurements']);
  for (const key of ['patientIhsId', 'organizationIhsId', 'practitionerIhsId', 'encounterIhsId']) {
    if (typeof body[key] !== 'string' || !/^[A-Za-z0-9.-]{1,64}$/.test(body[key] as string) || /^\d{16}$/.test(body[key] as string)) throw new ApiError(400, 'Resolved IHS identifiers required; NIK is not a FHIR resource ID');
  }
  if (typeof body.measuredAt !== 'string' || !z.string().datetime({ offset: true }).safeParse(body.measuredAt).success || Date.parse(body.measuredAt) > Date.now()) throw new ApiError(400, 'Valid measuredAt required');
  const measurements = object(body.measurements);
  onlyKeys(measurements, ['height_cm', 'weight_kg', 'pulse_bpm', 'temperature_c']);
  const definitions: Record<string, [string, string, number, number]> = {
    height_cm: ['8302-2', 'cm', 20, 250], weight_kg: ['29463-7', 'kg', 0.2, 500], pulse_bpm: ['8867-4', '/min', 20, 250], temperature_c: ['8310-5', 'Cel', 25, 45],
  };
  if (Object.keys(measurements).length === 0) throw new ApiError(400, 'Measured values required');
  const entry = Object.entries(measurements).map(([key, raw]) => {
    const measurement = object(raw);
    onlyKeys(measurement, ['value', 'source']);
    const [code, unit, min, max] = definitions[key];
    if (measurement.source !== 'measured' || typeof measurement.value !== 'number' || !Number.isFinite(measurement.value) || measurement.value < min || measurement.value > max) throw new ApiError(400, 'Only plausible measured values can be previewed');
    return { fullUrl: `urn:uuid:${randomUUID()}`, resource: { resourceType: 'Observation', status: 'preliminary', category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }], code: { coding: [{ system: 'http://loinc.org', code }] }, subject: { reference: `Patient/${body.patientIhsId}` }, encounter: { reference: `Encounter/${body.encounterIhsId}` }, performer: [{ reference: `Practitioner/${body.practitionerIhsId}` }, { reference: `Organization/${body.organizationIhsId}` }], effectiveDateTime: new Date(body.measuredAt as string).toISOString(), valueQuantity: { value: measurement.value, unit, system: 'http://unitsofmeasure.org', code: unit } } };
  });
  // A collection is a local preview, never a transaction or confirmation of remote acceptance.
  return { resourceType: 'Bundle', type: 'collection', entry };
}

// This helper maps an already authorized, stored review. The API must enforce record access.
// It emits a local collection only; IHS resolution and SATUSEHAT profiles still need sandbox verification.
const ihsId = z.string().regex(/^[A-Za-z0-9.-]{1,64}$/).refine(value => !/^\d{16}$/.test(value), 'NIK is not an IHS resource identifier');
export const ResolvedIhsSchema = z.strictObject({ patientIhsId: ihsId, organizationIhsId: ihsId, practitionerIhsId: ihsId, encounterIhsId: ihsId });
export const ClinicalFhirRequestSchema = z.strictObject({ mode: z.literal('preview'), screening_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), expected_version: z.number().int().positive(), identifiers: ResolvedIhsSchema });
export type ResolvedIhs = z.infer<typeof ResolvedIhsSchema>;
type DraftEntry = { fullUrl: string; resource: Record<string, unknown> };
export function buildClinicalDraft(raw: Screening, identifiers: ResolvedIhs, examination?: EncounterExam) {
  const parsed = ScreeningSchema.safeParse(raw);
  const resolved = ResolvedIhsSchema.safeParse(identifiers);
  if (!parsed.success || !resolved.success) throw new ApiError(400, 'Valid clinician-reviewed screening and resolved IHS identifiers required');
  const screening = parsed.data;
  const review = screening.clinician_review;
  if (screening.screening_status !== 'CLINICIAN_CONFIRMED' || review.status !== 'APPROVED' || !review.reviewer_uid || !review.reviewed_at || !review.evidence.some(value => value.trim()) || !screening.patient_id || !screening.confirmed_icd10.length) throw new ApiError(400, 'Only clinician-confirmed diagnoses with evidence and patient linkage can be mapped');
  if (screening.terminology_version !== TERMINOLOGY_VERSION || !validateCodes(screening.confirmed_icd10)) throw new ApiError(400, 'Re-review using SATUSEHAT WHO ICD-10 2010 terminology required');
  if (Date.parse(review.reviewed_at) > Date.now()) throw new ApiError(400, 'Review time cannot be in the future');
  const ihs = resolved.data;
  const subject = { reference: `Patient/${ihs.patientIhsId}` };
  const encounter = { reference: `Encounter/${ihs.encounterIhsId}` };
  const practitioner = { reference: `Practitioner/${ihs.practitionerIhsId}` };
  const recorded = new Date(review.reviewed_at).toISOString();
  const meta = { tag: [{ system: 'urn:sonri:fhir-preview', code: 'local-draft', display: 'Local preview; external identifiers and SATUSEHAT profile not verified' }] };
  const entry: DraftEntry[] = screening.confirmed_icd10.map(code => ({
    fullUrl: `urn:uuid:${randomUUID()}`,
    resource: {
      resourceType: 'Condition', meta,
      identifier: [{ system: `http://sys-ids.kemkes.go.id/condition/${ihs.organizationIhsId}`, value: `${screening.screening_id}-${code.replace('.', '-')}` }],
      // Clinical activity and onset have not been captured; do not manufacture them.
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', version: '2010', code, display: lookupCode(code)!.official_title }] },
      subject, encounter, recordedDate: recorded, asserter: practitioner,
      note: [{ text: review.note }, ...review.evidence.map(text => ({ text }))].filter(note => note.text.trim()),
    },
  }));
  if (examination) {
    const parsedExam = EncounterExamSchema.safeParse(examination);
    if (!parsedExam.success) throw new ApiError(400, 'Valid odontogram with known orientation and dentition required');
    for (const tooth of parsedExam.data.teeth) {
      // NOT_ASSESSED is not a negative finding and must not become an Observation.
      if (tooth.status === 'NOT_ASSESSED') continue;
      entry.push({ fullUrl: `urn:uuid:${randomUUID()}`, resource: {
        resourceType: 'Observation', meta, status: 'preliminary',
        code: { text: 'Clinician-recorded odontogram finding' }, subject, encounter,
        performer: [practitioner],
        // FDI is preserved as text until the exact target-program coding system is verified.
        bodySite: { text: `FDI ${tooth.fdi}` },
        valueCodeableConcept: { text: tooth.status },
        note: [{ text: `Dentition: ${parsedExam.data.dentition}; surfaces: ${tooth.surfaces.join(', ') || 'unspecified'}` }, ...(tooth.observation.trim() ? [{ text: tooth.observation }] : [])],
      } });
    }
  }
  const target = entry.map(item => ({ reference: item.fullUrl }));
  entry.push({ fullUrl: `urn:uuid:${randomUUID()}`, resource: {
    resourceType: 'Provenance', meta, target, recorded,
    agent: [{ type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'verifier' }] }, who: practitioner, onBehalfOf: { reference: `Organization/${ihs.organizationIhsId}` } }],
    entity: [{ role: 'source', what: { identifier: { system: 'urn:sonri:screening', value: screening.screening_id } } }],
  } });
  return { resourceType: 'Bundle' as const, type: 'collection' as const, entry };
}
