import { describe, expect, it } from 'vitest';
import { ICD_CATALOG } from '../src/clinical-engine/terminology/catalog';
import { COVERAGE_EVIDENCE, CoverageEvidenceSchema, coverageMatrix } from '../src/clinical-engine/terminology/coverage';

const binding = { id: 'test-only-binding', model_id: 'test-only-model', checkpoint_sha256: 'a'.repeat(64), finding: 'VISIBLE_CAVITATION', mapping_status: 'VERIFIED', evidence_reference: 'test-only-not-a-real-approval', reviewed_by: 'synthetic-reviewer' };
const evaluation = { id: 'test-only-evaluation', model_id: binding.model_id, checkpoint_sha256: binding.checkpoint_sha256, dataset_version: 'test-only-not-a-real-dataset', sample_count: 10, finding_bindings: [binding.id], completed: true, real_images: true, evaluation_rights_verified: true, independently_clinician_reviewed: true, patient_split_audited: true, training_test_disjoint: true, metrics_reference: 'test-only', uncertainty_reference: 'test-only' };
const approval = { id: 'test-only-approval', code: 'K02.9', evaluation_ids: [evaluation.id], reviewer_uid: 'synthetic-reviewer', professional_authorization_reference: 'test-only', approval_reference: 'test-only', approved_at: '2026-10-24T00:00:00Z', scope: 'CLINICAL_DECISION_SUPPORT' };
const ledger = () => ({ ...COVERAGE_EVIDENCE, finding_bindings: [binding], real_data_evaluations: [evaluation], professional_validations: [] });

describe('WHO2010 capability evidence matrix', () => {
  it('represents every category and terminal code exactly once, with all five independent statuses', () => {
    const matrix = coverageMatrix();
    expect(matrix.rows.map(r => [r.code, r.title])).toEqual(ICD_CATALOG.map(r => [r.code, r.official_title]));
    expect(matrix.summary).toEqual({ categories: 15, terminal_codes: 108, terminology_available: 108, clinical_evidence_workflow_available: 108, ai_findings_supported: 0, ai_evaluated_with_actual_data: 0, clinically_validated: 0 });
    expect(matrix.rows.every(r => r.clinical_evidence_workflow.clinical_approval === 'PENDING' && r.clinical_use === 'PROHIBITED')).toBe(true);
    expect(matrix.rows.find(r => r.code === 'K07.0')?.ai_findings_supported.status).toBe('NO_OBSERVABLE_FINDING_CONTRACT');
  });
  it('does not treat a source class name or synthetic inference as a verified finding binding', () => {
    expect(COVERAGE_EVIDENCE.finding_bindings).toEqual([]);
    expect(COVERAGE_EVIDENCE.real_data_evaluations).toEqual([]);
    expect(() => CoverageEvidenceSchema.parse({ ...ledger(), finding_bindings: [{ ...binding, mapping_status: 'UNVERIFIED' }] })).toThrow();
    expect(() => CoverageEvidenceSchema.parse({ ...ledger(), finding_bindings: [{ ...binding, finding: 'd' }] })).toThrow();
    expect(() => CoverageEvidenceSchema.parse({ ...ledger(), real_data_evaluations: [{ ...evaluation, real_images: false }] })).toThrow();
  });
  it.each(['evaluation_rights_verified', 'independently_clinician_reviewed', 'patient_split_audited', 'training_test_disjoint'])('rejects incomplete actual-data evaluation %s', key => {
    expect(() => coverageMatrix({ ...ledger(), real_data_evaluations: [{ ...evaluation, [key]: false }] })).toThrow();
  });
  it('requires exact checkpoint and binding provenance across model/evaluation records', () => {
    expect(() => coverageMatrix({ ...ledger(), real_data_evaluations: [{ ...evaluation, checkpoint_sha256: 'b'.repeat(64) }] })).toThrow('provenance mismatch');
    expect(() => coverageMatrix({ ...ledger(), real_data_evaluations: [{ ...evaluation, finding_bindings: ['unknown'] }], professional_validations: [approval] })).toThrow();
    expect(() => coverageMatrix({ ...ledger(), finding_bindings: [binding, binding] })).toThrow('Duplicate evidence ID');
  });
  it('keeps documentary professional approval code-specific and cannot activate clinical models', () => {
    const matrix = coverageMatrix({ ...ledger(), professional_validations: [approval] });
    expect(matrix.rows.find(r => r.code === 'K02.9')?.clinically_validated_by_authorized_professionals.validated).toBe(true);
    expect(matrix.rows.find(r => r.code === 'K02.0')?.clinically_validated_by_authorized_professionals.validated).toBe(false);
    expect(matrix.rows.find(r => r.code === 'K02.9')?.clinical_use).toBe('PROHIBITED');
    expect(() => coverageMatrix({ ...ledger(), professional_validations: [{ ...approval, code: 'K02.51' }] })).toThrow();
    expect(() => coverageMatrix({ ...ledger(), professional_validations: [{ ...approval, code: 'K07.0' }] })).toThrow('relevant completed evaluation');
  });
});
