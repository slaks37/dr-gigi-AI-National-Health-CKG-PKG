import { ICD_CATALOG } from './catalog';
import { MODULES } from '../modules/catalog';
import { RULES } from '../rules/rules';
export function terminologyCoverage() {
    return ICD_CATALOG.map(entry => ({ code: entry.code, official_title: entry.official_title, classification_version: entry.version, source: entry.source,
        module_ids: MODULES.filter(m => (m.categories as readonly string[]).includes(entry.clinical_category) || (m.id === 'PERIODONTAL' && entry.code === 'K03.6')).map(m => m.id),
        terminology_supported: true, questionnaire_rule_ids: RULES.filter(r => r.suggested_code === entry.code && r.supporting_symptoms.length > 0).map(r => r.id),
        candidate_rule_ids: RULES.filter(r => r.suggested_code === entry.code).map(r => r.id),
        visual_model_available: false, model_evaluated: false, clinically_reviewed: false,
        clinician_examination_supported: true, radiography_ai_supported: false, radiography_interpretation_supported: true,
        required_evidence: entry.required_evidence, needs_radiography: entry.needs_radiography, needs_vitality_test: entry.needs_vitality_test, needs_periodontal_exam: entry.needs_periodontal_exam, needs_histopathology: entry.needs_histopathology,
        inclusion_exclusion_status: entry.inclusion_exclusion_status, review_status: entry.clinical_review_status }));
}
