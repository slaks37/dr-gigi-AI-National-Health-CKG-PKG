import { z } from 'zod';
import { FindingLabels } from '../types/schema';
import { ICD_CATALOG, TERMINOLOGY_METADATA, TERMINOLOGY_VERSION } from './catalog';
import registry from './coverage-evidence.v1.json';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const reference = z.string().trim().min(1).max(1000);
const binding = z.strictObject({
  id: reference, model_id: reference, checkpoint_sha256: sha256,
  finding: z.enum(FindingLabels), mapping_status: z.literal('VERIFIED'),
  evidence_reference: reference, reviewed_by: reference,
});
const evaluation = z.strictObject({
  id: reference, model_id: reference, checkpoint_sha256: sha256,
  dataset_version: reference, sample_count: z.number().int().positive(),
  finding_bindings: z.array(reference).min(1), completed: z.literal(true),
  real_images: z.literal(true), evaluation_rights_verified: z.literal(true),
  independently_clinician_reviewed: z.literal(true), patient_split_audited: z.literal(true),
  training_test_disjoint: z.literal(true), metrics_reference: reference,
  uncertainty_reference: reference,
});
const validation = z.strictObject({
  id: reference, code: z.string().regex(/^K\d{2}\.\d$/),
  evaluation_ids: z.array(reference).min(1), reviewer_uid: reference,
  professional_authorization_reference: reference, approval_reference: reference,
  approved_at: z.string().datetime(), scope: z.literal('CLINICAL_DECISION_SUPPORT'),
});
export const CoverageEvidenceSchema = z.strictObject({
  schema_version: z.literal('1'), version: reference, clinical_use: z.literal('PROHIBITED'),
  finding_bindings: z.array(binding), real_data_evaluations: z.array(evaluation),
  professional_validations: z.array(validation), limitations: z.array(reference),
}).superRefine((ledger, ctx) => {
  for (const records of [ledger.finding_bindings, ledger.real_data_evaluations, ledger.professional_validations]) {
    if (new Set(records.map(r => r.id)).size !== records.length) ctx.addIssue({ code: 'custom', message: 'Duplicate evidence ID' });
  }
  for (const e of ledger.real_data_evaluations) for (const id of e.finding_bindings) {
    const b = ledger.finding_bindings.find(item => item.id === id);
    if (!b || b.model_id !== e.model_id || b.checkpoint_sha256 !== e.checkpoint_sha256) ctx.addIssue({ code: 'custom', message: 'Evaluation mapping/checkpoint provenance mismatch' });
  }
  for (const v of ledger.professional_validations) {
    const code = ICD_CATALOG.find(e => e.code === v.code && e.kind === 'TERMINAL');
    if (!code) ctx.addIssue({ code: 'custom', message: 'Validation must name a WHO2010 terminal code' });
    for (const id of v.evaluation_ids) {
      const e = ledger.real_data_evaluations.find(item => item.id === id);
      if (!e || !e.finding_bindings.some(bindingId => {
        const matched = ledger.finding_bindings.find(b => b.id === bindingId);
        return !!matched && code?.ai_observable_findings.includes(matched.finding);
      })) ctx.addIssue({ code: 'custom', message: 'Clinical approval lacks relevant completed evaluation' });
    }
  }
});
export type CoverageEvidence = z.infer<typeof CoverageEvidenceSchema>;
export const COVERAGE_EVIDENCE = CoverageEvidenceSchema.parse(registry);
export const COVERAGE_VERSION = 'icd10-evidence-coverage-2';

// A descriptive evidence ledger, never a runtime approval or diagnosis mechanism.
export function coverageMatrix(rawEvidence: unknown = COVERAGE_EVIDENCE) {
  const evidence = CoverageEvidenceSchema.parse(rawEvidence);
  const rows = ICD_CATALOG.map(entry => {
    const bindings = evidence.finding_bindings.filter(b => entry.ai_observable_findings.includes(b.finding));
    const evaluated = evidence.real_data_evaluations.filter(e => e.finding_bindings.some(id => bindings.some(b => b.id === id)));
    const approvals = evidence.professional_validations.filter(v => v.code === entry.code && v.evaluation_ids.some(id => evaluated.some(e => e.id === id)));
    return {
      code: entry.code, title: entry.official_title, kind: entry.kind,
      category: entry.clinical_category, terminology_version: TERMINOLOGY_VERSION,
      terminology_available: { available: true, status: 'AVAILABLE' as const, source_reference: entry.source, source_sha256: TERMINOLOGY_METADATA.source_sha256 },
      clinical_evidence_workflow: { available: true, status: 'AVAILABLE_RESEARCH_CHECKLIST' as const, clinical_approval: 'PENDING' as const, required_examinations: entry.required_examinations, reference: 'src/clinical-engine/terminology/workflows.ts' },
      ai_findings_supported: { supported: bindings.length > 0, status: bindings.length ? 'RESEARCH_FINDING_BINDING_AVAILABLE' as const : entry.ai_observable_findings.length ? 'NO_VERIFIED_FINDING_BINDING' as const : 'NO_OBSERVABLE_FINDING_CONTRACT' as const, potential_findings: entry.ai_observable_findings, binding_ids: bindings.map(b => b.id), model_ids: [...new Set(bindings.map(b => b.model_id))] },
      ai_evaluated_with_actual_data: { evaluated: evaluated.length > 0, status: evaluated.length ? 'INDEPENDENT_REAL_DATA_EVALUATION_DOCUMENTED' as const : 'NOT_ESTABLISHED' as const, evaluation_ids: evaluated.map(e => e.id), evaluation_sample_counts: evaluated.map(e => ({ evaluation_id: e.id, count: e.sample_count })), unique_patients: 'NOT_INFERRED' as const, dataset_versions: [...new Set(evaluated.map(e => e.dataset_version))] },
      clinically_validated_by_authorized_professionals: { validated: approvals.length > 0, status: approvals.length ? 'DOCUMENTED_APPROVAL_REQUIRES_OPERATOR_VERIFICATION' as const : 'NOT_VALIDATED' as const, approval_ids: approvals.map(v => v.id) },
      clinical_use: 'PROHIBITED' as const,
      limitations: ['Workflow availability is not clinical validation.', 'Potential finding types and source class names are not tested diagnostic capability.', 'No individual code is confirmed by an AI result.'],
    };
  });
  const terminals = rows.filter(r => r.kind === 'TERMINAL');
  return {
    coverage_version: COVERAGE_VERSION, evidence_version: evidence.version,
    terminology_version: TERMINOLOGY_VERSION, clinical_use: 'PROHIBITED' as const,
    summary: {
      categories: rows.filter(r => r.kind === 'CATEGORY').length, terminal_codes: terminals.length,
      terminology_available: terminals.filter(r => r.terminology_available.available).length,
      clinical_evidence_workflow_available: terminals.filter(r => r.clinical_evidence_workflow.available).length,
      ai_findings_supported: terminals.filter(r => r.ai_findings_supported.supported).length,
      ai_evaluated_with_actual_data: terminals.filter(r => r.ai_evaluated_with_actual_data.evaluated).length,
      clinically_validated: terminals.filter(r => r.clinically_validated_by_authorized_professionals.validated).length,
    },
    limitations: evidence.limitations, rows,
  };
}
