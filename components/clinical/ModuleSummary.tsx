import { MODULES, assessModules } from '@/src/clinical-engine/modules/catalog';
import type { Screening } from '@/src/clinical-engine/types/schema';
export default function ModuleSummary({ result }: {
    result?: Screening;
}) {
    const assessments = result ? assessModules(result.visual_findings, result.symptoms) : null;
    return <section aria-label="Lima modul SONRI" className="space-y-3"><h3 className="text-lg font-bold">Lima modul penilaian oral</h3><p className="text-sm text-slate-600">Semua modul memakai gejala dan rekam yang sama. Detector foto belum tersedia; setiap hasil memerlukan tinjauan dokter.</p><div className="grid sm:grid-cols-2 gap-3">{MODULES.map((m, i) => <article key={m.id} className="border rounded-xl p-3"><h4 className="font-semibold">{m.name}</h4><p className="text-sm">{m.categories.join(', ')} — cakupan istilah, bukan kemampuan diagnosis AI.</p><p className="text-sm">{m.id === 'CLINICAL' ? 'Pencatatan pemeriksaan dokter tersedia' : 'Model visual belum tersedia'}</p>{assessments && <p className="text-sm">{assessments[i].observed_finding_ids.length} temuan tercatat; {assessments[i].reported_symptoms.length} gejala dilaporkan; {assessments[i].missing_symptoms.length} jawaban belum diketahui.</p>}<p className="text-sm text-slate-600">{m.examinations[0]}</p></article>)}</div></section>;
}
