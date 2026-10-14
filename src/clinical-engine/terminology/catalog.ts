import data from './who-icd10-2019.json';
export const TERMINOLOGY_VERSION = data.version;
export const ICD_CATALOG = data.entries;
export function lookupCode(code: string) { return ICD_CATALOG.find(entry => entry.code === code) ?? null; }
export function validateCodes(codes: string[]): boolean { return codes.every(code => /^K\d{2}\.\d$/.test(code) && !!lookupCode(code)); }
export function candidateCode(code: string): string[] { return validateCodes([code]) ? [code] : []; }
export function auditSourceLabel(label: string) {
  const warnings: string[] = [];
  if(/K0\.2\.3/.test(label)) warnings.push('MALFORMED_CODE: review K0.2.3; never bulk relabel');
  if(/K04\.8/.test(label)&&/sisa|radix|root/i.test(label)) warnings.push('LABEL_CODE_MISMATCH_REVIEW: root remnants');
  if(/K08\.1/.test(label)&&/avuls|trauma|kecelakaan/i.test(label)) warnings.push('TRAUMA_CODE_REVIEW: distinguish acute injury from acquired loss');
  if(/K12\.2/.test(label)&&/mandib/i.test(label)) warnings.push('SITE_AND_ORIGIN_REVIEW: do not infer mandibular diagnosis from broad label');
  return { source_folder_label: label, candidate_icd10: null, clinician_verified_label: null, review_status: 'UNREVIEWED' as const, warnings };
}
