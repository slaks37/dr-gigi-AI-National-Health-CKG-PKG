import { Symptoms, Triage } from '../types/schema';
export const TRIAGE_REFERENCES = ['https://www.nhs.uk/conditions/dental-abscess/', 'https://www.nhs.uk/conditions/mouth-ulcers/'];
export function triage(s: Symptoms): Triage {
  const base = { references: TRIAGE_REFERENCES, rule_version: 'triage-research-1' as const, clinical_approval: 'PENDING' as const };
  if(s.difficulty_breathing === 'YES' || s.difficulty_swallowing === 'YES') return {...base,level:'EMERGENCY',reasons:['Keluhan sulit bernapas atau menelan memerlukan penilaian segera.'],recommendation:'Segera ke IGD atau hubungi layanan darurat setempat. Jangan menunggu foto, analisis AI, atau penyimpanan hasil.'};
  if(s.facial_swelling==='YES' || s.pus_or_drainage==='YES' || s.difficulty_opening_mouth==='YES' || (s.fever==='YES' && (s.gingival_swelling==='YES' || s.pain==='YES')) || (s.pain_severity!==null && s.pain_severity>=8)) return {...base,level:'URGENT',reasons:['Pembengkakan, dugaan infeksi, keterbatasan membuka mulut, atau nyeri berat perlu evaluasi segera.'],recommendation:'Cari pemeriksaan dokter gigi segera. Jika memburuk atau muncul gangguan napas/menelan, segera ke IGD.'};
  if(s.lesion_duration_days!==null && s.lesion_duration_days>21) return {...base,level:'PROMPT_REVIEW',reasons:['Lesi yang menetap lebih dari tiga minggu perlu pemeriksaan langsung; foto tidak menentukan penyebabnya.'],recommendation:'Atur pemeriksaan dokter gigi/dokter untuk lesi yang menetap.'};
  if(s.difficulty_breathing==='UNKNOWN' || s.difficulty_swallowing==='UNKNOWN') return {...base,level:'INCONCLUSIVE',reasons:['Pertanyaan tanda bahaya belum terjawab.'],recommendation:'Lengkapi pertanyaan tanda bahaya. Bila sulit bernapas/menelan, segera cari pertolongan darurat.'};
  return {...base,level:'ROUTINE_REVIEW',reasons:['Tidak ada tanda bahaya yang dilaporkan dari jawaban yang tersedia; ini bukan bukti sehat.'],recommendation:'Lanjutkan pemeriksaan dokter gigi. Gejala yang belum dijawab tetap belum diketahui.'};
}
