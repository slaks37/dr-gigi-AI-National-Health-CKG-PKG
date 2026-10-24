import type { Finding } from '../types/schema';
import { lookupCode, TERMINOLOGY_VERSION } from './catalog';
import { type ClinicalExaminations, EXAMINATION_WORKFLOW_VERSION, workflowForCode } from './workflows';

export type CodeEvidence = {
  finding_labels?: Finding['label'][];
  examinations?: Partial<ClinicalExaminations>;
  clinical_evidence?: string[];
};
// A deterministic completeness assessment. It never diagnoses or grants confirmation permission.
export function evaluateCodeEvidence(code: string, evidence: CodeEvidence = {}) {
  const entry = lookupCode(code);
  if (!entry || entry.kind !== 'TERMINAL') return null;
  const workflow = workflowForCode(code);
  const missing = workflow.examinations.filter(key => evidence.examinations?.[key] !== true) as string[];
  if (!evidence.clinical_evidence?.some(text => text.trim())) missing.push('documented_clinical_evidence');
  const observed = (evidence.finding_labels ?? []).filter(label => entry.ai_observable_findings.includes(label));
  return {
    code, official_title: entry.official_title, terminology_version: TERMINOLOGY_VERSION,
    rule_id: `EVIDENCE-${code}`, rule_version: EXAMINATION_WORKFLOW_VERSION,
    status: missing.length ? 'INSUFFICIENT_EVIDENCE' as const : 'CLINICIAN_REVIEW_REQUIRED' as const,
    observed_finding_labels: [...new Set(observed)],
    diagnostic_evidence_status: 'NOT_ASSESSED' as const,
    missing_evidence: missing,
    differential_diagnoses: entry.differential_codes.map(differential => ({ code: differential, title: lookupCode(differential)!.official_title, status: 'UNCONFIRMED' as const })),
    required_examinations: entry.required_examinations,
    conditional_examinations: entry.conditional_examinations,
    diagnostic_limitations: entry.diagnostic_limitations,
    confirmation_allowed: false as const,
    limitation: 'Kelengkapan checklist bukan bukti bahwa hasil pemeriksaan mendukung diagnosis; hasil harus diinterpretasi dokter gigi yang berwenang.',
  };
}
