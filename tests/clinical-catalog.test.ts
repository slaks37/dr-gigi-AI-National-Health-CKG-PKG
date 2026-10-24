import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ICD_CATALOG, ICD_CATEGORIES, lookupCode, TERMINOLOGY_METADATA, TERMINOLOGY_VERSION, validateCodes } from '../src/clinical-engine/terminology/catalog';
import { evaluateCodeEvidence } from '../src/clinical-engine/terminology/evidence';
import { FindingSchema, SymptomsSchema, type Finding } from '../src/clinical-engine/types/schema';
import { reason } from '../src/clinical-engine/rules/rules';
import { ReviewRequestSchema } from '../src/clinical-engine/validation/review';
const finding = (id: string, label: Finding['label'], uncertainty: Finding['uncertainty'] = 'SUPPORTED_OBSERVATION'): Finding => FindingSchema.parse({ finding_id: id, image_index: 0, region: 'TOOTH', label, box: null, fdi_number: null, tooth_surface: 'UNKNOWN', evidence: 'Synthetic clinician evidence', uncertainty, source: 'QUALIFIED_CLINICIAN', model_version: null, reviewer_uid: 'synthetic-dentist', review_required: true });

describe('SATUSEHAT WHO ICD-10 2010 catalog integrity', () => {
  it('retains the retrieved official source, full category coverage and exact source title/code pairs', () => {
    const source = readFileSync('src/clinical-engine/terminology/sources/who-icd10-2010-k00-k14.html', 'utf8');
    expect(createHash('sha256').update(source).digest('hex')).toBe(TERMINOLOGY_METADATA.source_sha256);
    expect(TERMINOLOGY_VERSION).toBe('WHO-ICD10-2010');
    expect(ICD_CATEGORIES.map(entry => entry.code)).toEqual(Array.from({ length: 15 }, (_, i) => `K${String(i).padStart(2, '0')}`));
    const officialPairs = [...source.matchAll(/<a[^>]*class="code"[^>]*>(K\d\d(?:\.\d)?)<\/a>\s*<span class="label">([\s\S]*?)<\/span>/g)].map(match => [match[1], match[2]]);
    expect(ICD_CATALOG.map(entry => [entry.code, entry.official_title])).toEqual(officialPairs);
    expect(ICD_CATALOG.filter(entry => entry.kind === 'TERMINAL')).toHaveLength(108);
  });
  it('rejects the 2013 code K02.5, CM codes, duplicates, and category-only confirmation', () => {
    expect(lookupCode('K02.5')).toBeNull();
    for (const codes of [['K02.5'], ['K02.51'], ['K05'], ['K02.9', 'K02.9']]) expect(validateCodes(codes)).toBe(false);
    expect(validateCodes(['K02.9', 'K08.3', 'K14.6'])).toBe(true);
  });
  it('retains exact official exclusions and explicit authored workflow boundaries for every code', () => {
    expect(lookupCode('K00')?.official_exclusions.join(' ')).toContain('K01.-');
    for (const entry of ICD_CATALOG) {
      expect(entry.required_evidence).toContain('clinical_exam');
      expect(entry.evidence_requirement_source).toBe('SONRI_AUTHORED_RESEARCH_CHECKLIST');
      expect(entry.clinical_validation_status).toBe('PENDING_CLINICIAN_APPROVAL');
      expect(entry.ai_support.diagnosis_supported).toBe(false);
      expect(entry.visual_only_eligible).toBe(false);
      expect(entry.clinical_details.length).toBeGreaterThan(0);
      expect(entry.conditional_examinations.length).toBeGreaterThan(0);
      expect(entry.diagnostic_limitations.length).toBeGreaterThan(0);
      expect(entry.differential_codes.every(code => !!lookupCode(code))).toBe(true);
    }
  });
});

describe('per-code evidence completeness and diagnostic boundaries', () => {
  it('requires radiography for impaction, periodontal examination for periodontal disease, and pulp tests for pulpitis', () => {
    expect(evaluateCodeEvidence('K01.1')?.missing_evidence).toContain('radiography');
    expect(evaluateCodeEvidence('K05.3')?.missing_evidence).toContain('periodontal_exam');
    expect(evaluateCodeEvidence('K04.0')?.missing_evidence).toContain('vitality_test');
    expect(evaluateCodeEvidence('K08.3')?.missing_evidence).toContain('radiography');
    expect(evaluateCodeEvidence('K10.3')?.missing_evidence).not.toContain('radiography');
    expect(evaluateCodeEvidence('K13.2')?.missing_evidence).not.toContain('histopathology');
    expect(evaluateCodeEvidence('K13.2')?.conditional_examinations.join(' ')).toContain('histopatologi');
  });
  it('never converts observable findings or completed checkboxes into a confirmed diagnosis', () => {
    const visual = evaluateCodeEvidence('K02.9', { finding_labels: ['VISIBLE_CAVITATION'] });
    expect(visual?.observed_finding_labels).toEqual(['VISIBLE_CAVITATION']);
    expect(visual?.status).toBe('INSUFFICIENT_EVIDENCE');
    const complete = evaluateCodeEvidence('K02.9', { examinations: { clinical_exam: true }, clinical_evidence: ['Synthetic direct exam'] });
    expect(complete?.status).toBe('CLINICIAN_REVIEW_REQUIRED');
    expect(complete?.diagnostic_evidence_status).toBe('NOT_ASSESSED');
    expect(complete?.confirmation_allowed).toBe(false);
    expect(evaluateCodeEvidence('K02.9', { examinations: { clinical_exam: true }, clinical_evidence: ['   '] })?.missing_evidence).toContain('documented_clinical_evidence');
    expect(evaluateCodeEvidence('K05')).toBeNull();
  });
});

describe('traceable suspicion versus differential', () => {
  it('rejects whitespace-only clinical evidence and review notes', () => {
    const payload = {screening_id:'synthetic-review',expected_version:1,decision:'APPROVED',note:'Synthetic note',findings:[],confirmed_icd10:['K02.9'],clinical_evidence:['Synthetic evidence'],examinations:{clinical_exam:true,radiography:false,vitality_test:false,periodontal_exam:false,histopathology:false},orientation_known:false,anatomical_context_known:false};
    expect(ReviewRequestSchema.safeParse(payload).success).toBe(true);
    expect(ReviewRequestSchema.safeParse({...payload,clinical_evidence:['   ']}).success).toBe(false);
    expect(ReviewRequestSchema.safeParse({...payload,note:'   '}).success).toBe(false);
  });
  it('references only actually supported findings and YES symptoms, not all possible triggers', () => {
    const candidates = reason([finding('swelling-1', 'VISIBLE_ORAL_SWELLING')], SymptomsSchema.parse({ facial_swelling: 'NO', fever: 'NO' }), 'ADULT');
    const infection = candidates.find(candidate => candidate.rule_id === 'INFECTION-001')!;
    expect(infection.evidence_refs).toEqual([{ kind: 'FINDING', id: 'swelling-1', value: 'VISIBLE_ORAL_SWELLING' }]);
    expect(infection.explanation).not.toContain('fever');
    expect(infection.differential_diagnoses).not.toContain(infection.candidate);
    expect(infection.missing_evidence.length).toBeGreaterThan(0);
    const pulpal = reason([], SymptomsSchema.parse({ pain: 'YES', cold_pain: 'YES', heat_pain: 'NO' }), 'ADULT')[0];
    expect(pulpal.evidence_refs.map(ref => ref.id)).toEqual(['pain', 'cold_pain']);
    expect(pulpal.suggested_icd10).toEqual([]);
  });
  it('does not treat uncertain mucosal appearance or uncertain pediatric findings as supported', () => {
    expect(reason([finding('uncertain', 'VISIBLE_ORAL_ULCER', 'UNCERTAIN')], SymptomsSchema.parse({}), 'PEDIATRIC')).toEqual([]);
  });
});
