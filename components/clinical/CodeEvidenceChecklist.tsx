import { evaluateCodeEvidence, type CodeEvidence } from '@/src/clinical-engine/terminology/evidence';
export default function CodeEvidenceChecklist({ codes, evidence }: { codes: string[]; evidence: CodeEvidence }) {
  return <div className="space-y-3">{codes.map(code => {
    const item = evaluateCodeEvidence(code, evidence);
    if (!item) return null;
    return <section key={code} className="bg-slate-50 border rounded-lg p-4 text-sm space-y-2"><h3 className="font-bold">{code} — {item.official_title}</h3><p>Penilaian kelengkapan: {item.status}. Diagnosis belum dikonfirmasi.</p><p>Pemeriksaan wajib: {item.required_examinations.join('; ')}</p>{item.missing_evidence.length > 0 && <p className="text-amber-900">Bukti belum lengkap: {item.missing_evidence.join(', ')}</p>}<ul>{item.conditional_examinations.map(e => <li key={e}>{e}</li>)}</ul>{item.differential_diagnoses.length > 0 && <p>Banding untuk ditinjau: {item.differential_diagnoses.map(d => `${d.code} ${d.title}`).join('; ')}</p>}<p>{item.limitation}</p><p className="text-slate-500">Aturan {item.rule_id} · {item.rule_version}</p></section>;
  })}</div>;
}
