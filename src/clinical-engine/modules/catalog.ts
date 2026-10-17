import type { Finding, Symptoms } from '../types/schema';
export const MODULES = [
    { id: 'CARIES', name: 'Karies gigi', categories: ['K02'], labels: ['VISIBLE_CAVITATION', 'ENAMEL_OPACITY'], symptoms: ['pain', 'sweet_pain', 'cold_pain'], examinations: ['Pemeriksaan permukaan gigi; kedalaman tidak ditentukan dari foto.'] },
    { id: 'PERIODONTAL', name: 'Gingiva dan periodontal', categories: ['K05', 'K06'], labels: ['VISIBLE_GINGIVAL_INFLAMMATION', 'VISIBLE_GINGIVAL_RECESSION', 'POSSIBLE_CALCULUS'], symptoms: ['gum_bleeding', 'gingival_swelling'], examinations: ['Pemeriksaan gingiva dan periodontal; probing bila diindikasikan.'] },
    { id: 'MUCOSA', name: 'Mukosa dan lidah', categories: ['K12', 'K13', 'K14'], labels: ['VISIBLE_ORAL_ULCER', 'VISIBLE_ORAL_SWELLING', 'WHITE_OR_RED_MUCOSAL_PATCH', 'ABNORMAL_TONGUE_APPEARANCE', 'OTHER_UNCERTAIN_LESION'], symptoms: ['persistent_oral_ulcer'], examinations: ['Pemeriksaan mukosa dan durasi lesi; pemeriksaan tambahan oleh dokter.'] },
    { id: 'STRUCTURE', name: 'Struktur dan perkembangan gigi', categories: ['K00', 'K01', 'K03', 'K07', 'K08'], labels: ['VISIBLE_TOOTH_WEAR', 'VISIBLE_TOOTH_FRACTURE', 'TOOTH_DISCOLORATION', 'VISIBLE_MISSING_TOOTH_REGION'], symptoms: ['recent_trauma'], examinations: ['Pemeriksaan struktur dan dentisi; orientasi diperlukan untuk FDI.'] },
    { id: 'CLINICAL', name: 'Bukti klinis dan radiografi', categories: ['K04', 'K09', 'K10', 'K11'], labels: [], symptoms: ['spontaneous_pain', 'heat_pain', 'chewing_pain', 'facial_swelling', 'pus_or_drainage', 'fever', 'recent_extraction'], examinations: ['Pemeriksaan langsung; uji sensibilitas, radiografi, atau laboratorium sesuai indikasi.'] },
] as const;
export type ModuleId = typeof MODULES[number]['id'];
export const READINESS = ['NOT_STARTED', 'ARCHITECTURE_READY', 'DATASET_BLOCKED', 'TRAINING_READY', 'MODEL_AVAILABLE', 'INFERENCE_TESTED', 'BENCHMARKED', 'CLINICAL_REVIEW_PENDING', 'STAGING_READY', 'APPROVED_FOR_CONFIGURED_USE'] as const;
// Code categories may overlap modules: deposits have terminology K03.6 but periodontal evidence.
export function assessModules(findings: Finding[], symptoms: Symptoms) {
    return MODULES.map(m => ({ module_id: m.id, readiness: 'ARCHITECTURE_READY' as const, model_status: 'UNAVAILABLE' as const,
        observed_finding_ids: findings.filter(f => (m.labels as readonly string[]).includes(f.label)).map(f => f.finding_id),
        reported_symptoms: m.symptoms.filter(key => symptoms[key] === 'YES'),
        missing_symptoms: m.symptoms.filter(key => symptoms[key] === 'UNKNOWN'),
        required_examinations: [...m.examinations], review_status: 'REVIEW_REQUIRED' as const }));
}
