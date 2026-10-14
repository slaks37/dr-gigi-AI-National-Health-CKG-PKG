import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { principalFromClaims, canAccess, requireAdmin, readJson, validId } from '../src/server/security';
import { screeningState, boxStyle } from '../src/server/analysis-state';
import { buildDraft } from '../src/server/fhir';
const patient = principalFromClaims({ uid: 'a' });
describe('trusted authorization', () => {
  it('defaults to patient; unknown role grants no privileges', () => {
    expect(patient.role).toBe('patient');
    expect(principalFromClaims({ uid: 'a', role: 'superuser' }).role).toBe('patient');
    expect(() => requireAdmin(patient)).toThrow();
  });
  it('denies cross-patient and unassigned doctor access', () => {
    expect(canAccess(patient, { userId: 'b' })).toBe(false);
    expect(canAccess({ uid: 'doc', role: 'doctor' }, { userId: 'b' })).toBe(false);
    expect(canAccess({ uid: 'doc', role: 'doctor' }, { userId: 'b', assignedClinicianUids: ['doc'] })).toBe(true);
    expect(canAccess(patient, { userId: 'a' })).toBe(true);
  });
  it('rejects path injection', () => { expect(() => validId('../patients/a')).toThrow(); });
});
describe('bounded input parsing', () => {
  const request = (body: string, type = 'application/json') => new NextRequest('http://localhost/api/records', { method: 'POST', headers: { 'Content-Type': type }, body });
  it('requires JSON and rejects malformed payload', async () => {
    await expect(readJson(request('{}', 'text/plain'))).rejects.toMatchObject({ status: 415 });
    await expect(readJson(request('{'))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request('[]'))).rejects.toMatchObject({ status: 400 });
  });
  it('rejects excessively nested JSON', async () => {
    const nested = '{\"x\":'.repeat(25) + '0' + '}'.repeat(25);
    await expect(readJson(request(nested))).rejects.toMatchObject({ status: 400 });
  });
  it('limits actual stream length without relying on Content-Length', async () => {
    await expect(readJson(request(JSON.stringify({ data: 'x'.repeat(200) })), 50)).rejects.toMatchObject({ status: 413 });
  });
});
describe('clinical presentation', () => {
  it.each([null, {}, { findings: [] }, { is_dental_image: false, findings: [] }, { is_dental_image: true, findings: [], summary: { status: 'SEHAT' } }])('never implies health from missing or invalid output: %j', output => {
    expect(screeningState(output)).not.toBe('NO_VISIBLE_FINDINGS');
  });
  it('requires explicit assessment; routes remain clinically disabled', () => {
    expect(screeningState({ is_dental_image: true, findings: [], analysis_state: 'NO_VISIBLE_FINDINGS' })).toBe('NO_VISIBLE_FINDINGS');
    expect(screeningState({ is_dental_image: true, findings: [], analysis_state: 'LOW_QUALITY' })).toBe('LOW_QUALITY');
    expect(screeningState({ is_dental_image: true, findings: [{}], analysis_state: 'NO_VISIBLE_FINDINGS' })).toBe('REVIEW_REQUIRED');
  });
  it('uses original photo coordinates; mirrors only explicitly', () => {
    const box = { xmin: 100, xmax: 300, ymin: 200, ymax: 400 };
    expect(boxStyle(box)).toEqual({ top: '20%', left: '10%', width: '20%', height: '20%' });
    expect(boxStyle(box, true)?.left).toBe('70%');
  });
  it.each([{ xmin: 0, xmax: 1001, ymin: 1, ymax: 10 }, { xmin: 10, xmax: 0, ymin: 1, ymax: 2 }, { xmin: 1, xmax: 2, ymin: NaN, ymax: 5 }])('rejects invalid boxes %j', box => { expect(boxStyle(box)).toBeNull(); });
});
describe('FHIR preview', () => {
  const data = { mode: 'preview', patientIhsId: 'patient-ihs', organizationIhsId: 'org-ihs', practitionerIhsId: 'practitioner-ihs', encounterIhsId: 'encounter-ihs', measuredAt: '2026-01-01T00:00:00Z', measurements: { height_cm: { value: 170, source: 'measured' } } };
  it('produces a preliminary local collection without remote success', () => {
    const draft = buildDraft(data);
    expect(draft.type).toBe('collection');
    expect(draft.entry[0].resource.status).toBe('preliminary');
    expect(draft.entry[0].resource.subject.reference).toBe('Patient/patient-ihs');
  });
  it('rejects NIK resource IDs, guessed measurements and fabricated diagnosis codes', () => {
    expect(() => buildDraft({ ...data, patientIhsId: '1111111111111111' })).toThrow();
    expect(() => buildDraft({ ...data, measurements: { height_cm: { value: 170, source: 'estimated' } } })).toThrow();
    expect(() => buildDraft({ ...data, diagnosa: 'AI diagnosis', icd10: 'K02.2' })).toThrow();
    expect(() => buildDraft({ ...data, measurements: { pulse_bpm: { value: 0, source: 'measured' } } })).toThrow();
  });
});

describe('PDF library compatibility after security upgrade', () => {
  it('exports a real PDF with text and a valid PDF signature', async () => {
    const { jsPDF } = await import('jspdf');
    const document = new jsPDF();
    document.text('Synthetic unreviewed test record', 10, 10);
    expect(document.output().startsWith('%PDF-')).toBe(true);
  });
});
