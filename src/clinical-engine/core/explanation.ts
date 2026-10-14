import type { Screening } from '../types/schema';
// Deterministic explanation is always available; no provider can invent additional evidence.
export function explainScreening(result:Screening):string {
 return [result.triage.recommendation,result.screening_status==='NO_VISIBLE_FINDINGS'?'Tidak tampak temuan dalam foto yang dinilai; ini tidak memastikan kesehatan mulut.':result.screening_status==='REVIEW_REQUIRED'?'Detector visual tervalidasi belum tersedia. Tidak ada diagnosis foto yang dihasilkan.':`Status pemeriksaan: ${result.screening_status}.`,...result.clinical_suspicions.map(c=>`${c.candidate}. ${c.explanation}`),'Diagnosis akhir dan pengkodean memerlukan dokter gigi yang berwenang.'].join('\n\n');
}
