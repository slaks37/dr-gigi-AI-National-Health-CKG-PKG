'use client';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/app/lib/apiClient';
import { EncounterExam, EncounterExamSchema } from '@/src/clinical-engine/evidence/encounter';
import Odontogram from './Odontogram';

const initial: EncounterExam = { dentition: 'UNKNOWN', orientation_known: false, medical_history: '', medications_allergies: '', extraoral: '', mucosa: '', periodontal: '', clinical_notes: '', teeth: [], consent_confirmed: true, consent_version: 'sonri-exam-consent-1' };
const fields = { medical_history: 'Riwayat medis', medications_allergies: 'Obat dan alergi', extraoral: 'Pemeriksaan ekstraoral', mucosa: 'Mukosa dan lidah', periodontal: 'Periodontal: probing / perdarahan / mobilitas', clinical_notes: 'Bukti pemeriksaan dan tindak lanjut' } as const;
export default function EncounterWorkbook({ id, version, readOnly, onSaved }: { id: string; version: number; readOnly: boolean; onSaved: (version: number) => void }) {
  const [exam, setExam] = useState<EncounterExam>(initial), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setLoaded(false); setMessage(''); setConsent(false); setExam(initial);
    authenticatedFetch(`/api/encounter-exam?id=${encodeURIComponent(id)}`).then(r => r.json()).then(data => {
      if (!active) return;
      if (data.examination) {
        const { author_uid: _author, recorded_at: _at, version: _version, ...recorded } = data.examination;
        setExam(EncounterExamSchema.parse(recorded)); setConsent(true);
      }
      setLoaded(true);
    }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Pemeriksaan gagal dimuat'); });
    return () => { active = false; };
  }, [id]);
  async function save() {
    setBusy(true); setMessage('');
    try {
      const checked = EncounterExamSchema.safeParse(exam);
      if (!checked.success) throw new Error(checked.error.issues.map(i => i.message).join('; '));
      const response = await authenticatedFetch('/api/encounter-exam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ screening_id: id, expected_version: version, examination: checked.data }) });
      const data = await response.json(); onSaved(data.version); setMessage('Pemeriksaan, persetujuan, dan riwayat perubahan tersimpan.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Belum tersimpan'); }
    finally { setBusy(false); }
  }
  return <details className="border rounded-xl p-4 space-y-4" open><summary className="font-bold text-lg cursor-pointer">Pemeriksaan klinis dan odontogram</summary><fieldset disabled={readOnly || busy || !loaded} className="space-y-4 mt-4">{Object.entries(fields).map(([key, label]) => <label className="block" key={key}>{label}<textarea maxLength={key === 'clinical_notes' ? 4000 : 2000} value={exam[key as keyof typeof fields]} onChange={e => setExam(prev => ({ ...prev, [key]: e.target.value }))} className="block border rounded p-2 w-full" /></label>)}<Odontogram value={exam} onChange={setExam} disabled={readOnly || busy || !loaded} /><label className="flex gap-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Saya telah menjelaskan pemeriksaan dan memverifikasi persetujuan pasien/wali.</label>{!readOnly && <button type="button" disabled={!consent || !loaded || busy} onClick={save} className="bg-emerald-700 text-white rounded-lg p-3 disabled:opacity-50">Simpan pemeriksaan</button>}</fieldset><p role="status">{message}</p></details>;
}
