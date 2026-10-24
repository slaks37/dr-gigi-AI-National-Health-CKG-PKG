import data from './who-icd10-2010.json';
import { EXAMINATION_LABELS, EXAMINATION_WORKFLOW_VERSION, workflowForCode } from './workflows';

export const TERMINOLOGY_VERSION = data.version;
const { entries: sourceEntries, ...metadata } = data;
export const TERMINOLOGY_METADATA = { ...metadata, examination_workflow_version: EXAMINATION_WORKFLOW_VERSION, clinical_validation_status: 'PENDING_CLINICIAN_APPROVAL', clinical_rules_approved: false } as const;
export const ICD_CATEGORIES = sourceEntries.filter(entry => entry.kind === 'CATEGORY').map(entry => ({ code: entry.code, title: entry.official_title }));
export const ICD_CATALOG = sourceEntries.map(entry => {
  const workflow = workflowForCode(entry.code);
  return {
    ...entry, version: TERMINOLOGY_VERSION, description: entry.official_title,
    required_evidence: ['qualified_clinician_assessment', 'documented_clinical_evidence', ...workflow.examinations],
    required_examinations: workflow.examinations.map(key => EXAMINATION_LABELS[key]),
    clinical_details: workflow.clinical_details,
    conditional_examinations: workflow.conditional_examinations,
    evidence_inheritance: entry.code.length === 3 ? null : entry.clinical_category,
    evidence_requirement_source: 'SONRI_AUTHORED_RESEARCH_CHECKLIST',
    ai_observable_findings: workflow.observations,
    differential_codes: workflow.differential_codes.filter(code => code !== entry.code),
    differential_limitations: 'Daftar untuk penilaian klinisi, tidak lengkap; kondisi di luar K00–K14 belum disingkirkan.',
    diagnostic_limitations: workflow.limitations,
    contraindications: ['Bukan dasar terapi otomatis; pencitraan/tes invasif hanya atas indikasi dan pertimbangan klinisi.'],
    visual_only_eligible: false, needs_clinical_exam: true,
    needs_radiography: workflow.examinations.includes('radiography'),
    needs_vitality_test: workflow.examinations.includes('vitality_test'),
    needs_periodontal_exam: workflow.examinations.includes('periodontal_exam'),
    needs_histopathology: workflow.examinations.includes('histopathology'),
    ai_support: { validated_model_available: false, diagnosis_supported: false, status: 'NO_CLINICALLY_VALIDATED_MODEL', limitation: 'Observable labels are potential evidence types, not validated disease predictions. Research model outputs cannot confirm ICD-10.' },
    coding_status: 'OFFICIAL_WHO_2010_REFERENCE', clinical_review_status: 'PENDING', clinical_validation_status: 'PENDING_CLINICIAN_APPROVAL',
    inclusion_exclusion_status: 'CHECK_OFFICIAL_INDEX_AND_PARENT_RUBRICS',
    references: [entry.source, data.satusehat_source, ...(workflow.references ?? [])],
  };
});
export type CatalogEntry = typeof ICD_CATALOG[number];
const byCode = new Map(ICD_CATALOG.map(entry => [entry.code, entry]));
export function lookupCode(code: string) { return byCode.get(code) ?? null; }
export function validateCodes(codes: string[]): boolean {
  return new Set(codes).size === codes.length && codes.every(code => /^K\d{2}\.\d$/.test(code) && lookupCode(code)?.kind === 'TERMINAL');
}
export function candidateCode(code: string): string[] { return validateCodes([code]) ? [code] : []; }
export function auditSourceLabel(label: string) {
  const warnings: string[] = [];
  if (/K0\.2\.3/.test(label)) warnings.push('MALFORMED_CODE: review K0.2.3; never bulk relabel');
  if (/K04\.8/.test(label) && /sisa|radix|root/i.test(label)) warnings.push('LABEL_CODE_MISMATCH_REVIEW: root remnants');
  if (/K08\.1/.test(label) && /avuls|trauma|kecelakaan/i.test(label)) warnings.push('TRAUMA_CODE_REVIEW: distinguish acute injury from acquired loss');
  if (/K12\.2/.test(label) && /mandib/i.test(label)) warnings.push('SITE_AND_ORIGIN_REVIEW: do not infer mandibular diagnosis from broad label');
  if (/K02\.5/.test(label)) warnings.push('VERSION_MISMATCH: K02.5 is absent from WHO ICD-10 2010 required by SATUSEHAT; do not auto-map');
  return { source_folder_label: label, candidate_icd10: null, clinician_verified_label: null, review_status: 'UNREVIEWED' as const, warnings };
}
