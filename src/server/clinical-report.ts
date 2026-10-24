import type { Screening } from '../clinical-engine/types/schema';
import { lookupCode } from '../clinical-engine/terminology/catalog';

export function buildClinicalReport(data: { id: string; version: number; screening: Screening; examination?: unknown }) {
  const s = data.screening;
  return {
    report_version: 'sonri-report-1', record_id: data.id, record_version: data.version,
    created_at: new Date().toISOString(), patient_id: s.patient_id,
    encounter_at: s.screening_timestamp, status: s.screening_status,
    clinical_validation: 'NOT_ESTABLISHED', terminology_version: s.terminology_version,
    observed_findings: s.visual_findings, suspected_diagnoses: s.clinical_suspicions,
    differential_diagnoses: s.differential_diagnoses,
    confirmed_diagnoses: s.confirmed_icd10.map(code => ({ code, title: lookupCode(code)?.official_title ?? code })),
    examination: data.examination ?? null, required_examinations: s.required_examinations,
    triage: s.triage, review: s.clinician_review, provenance: s.evidence_provenance,
    limitations: ['Hasil AI negatif tidak membuktikan sehat.', 'Kandidat dan diagnosis banding memerlukan pemeriksaan dokter.', 'Model penelitian tidak menetapkan diagnosis.'],
  };
}
export function reportHtml(report: ReturnType<typeof buildClinicalReport>) {
  const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Laporan SONRI</title><style>body{font:16px system-ui;max-width:900px;margin:32px auto;padding:24px;color:#172d36}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7f6;padding:20px}h1{color:#087b68}@media print{body{margin:0}}</style><h1>SONRI — laporan pemeriksaan</h1><p>Status: ${escape(report.status)} · Versi rekam ${report.record_version}</p><p>${escape(report.limitations.join(' '))}</p><h2>Diagnosis terkonfirmasi dokter</h2><p>${escape(report.confirmed_diagnoses.map(d => d.code + ' — ' + d.title).join('; ') || 'Belum dikonfirmasi')}</p><h2>Bukti dan jejak pemeriksaan</h2><pre>${escape(JSON.stringify(report, null, 2))}</pre></html>`;
}
