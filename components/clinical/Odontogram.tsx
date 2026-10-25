'use client';
import type { EncounterExam } from '@/src/clinical-engine/evidence/encounter';

const rows = [
  ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'],
  ['55','54','53','52','51','61','62','63','64','65'],
  ['85','84','83','82','81','71','72','73','74','75'],
  ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'],
];
const statuses = { NOT_ASSESSED: 'Belum diperiksa', PRESENT: 'Ada', MISSING: 'Tidak ada', RESTORED: 'Restorasi', FINDING: 'Ada temuan' } as const;
export default function Odontogram({ value, onChange, disabled = false }: { value: EncounterExam; onChange: (next: EncounterExam) => void; disabled?: boolean }) {
  function update(fdi: string, patch: Partial<EncounterExam['teeth'][number]>) {
    const current = value.teeth.find(t => t.fdi === fdi) ?? { fdi, status: 'NOT_ASSESSED' as const, surfaces: [], observation: '' };
    onChange({ ...value, teeth: [...value.teeth.filter(t => t.fdi !== fdi), { ...current, ...patch }] });
  }
  return <fieldset disabled={disabled} className="space-y-4">
    <legend className="font-semibold text-lg">Odontogram FDI</legend>
    <p className="text-sm text-slate-600">Nomor dicatat setelah dokter memverifikasi orientasi dan dentisi. Gigi yang belum diperiksa tidak dianggap sehat.</p>
    <label className="block">Dentisi<select aria-label="Dentisi" className="block border rounded p-2 w-full" value={value.dentition} onChange={e => onChange({ ...value, dentition: e.target.value as EncounterExam['dentition'], teeth: [] })}><option value="UNKNOWN">Belum diketahui</option><option value="PERMANENT">Permanen</option><option value="PRIMARY">Sulung</option><option value="MIXED">Campuran</option></select></label>
    <label className="flex gap-2"><input type="checkbox" checked={value.orientation_known} onChange={e => onChange({ ...value, orientation_known: e.target.checked, teeth: [] })} />Orientasi anatomis telah saya verifikasi</label>
    <div className="overflow-x-auto border rounded-xl p-3" aria-label="Peta gigi FDI">
      <p className="text-xs text-center mb-3">Kanan pasien ← · Rahang atas · → Kiri pasien</p>
      {rows.filter((_, i) => value.dentition === 'MIXED' || (value.dentition === 'PRIMARY' ? i === 1 || i === 2 : i === 0 || i === 3)).map((row, i) => <div key={row[0]} className="flex justify-center gap-1 min-w-max mb-2">{row.map(fdi => {
        const tooth = value.teeth.find(t => t.fdi === fdi);
        return <label key={fdi} className={`text-center text-xs p-1 border rounded ${tooth?.status === 'FINDING' ? 'bg-amber-100' : tooth?.status === 'MISSING' ? 'bg-slate-200' : 'bg-white'}`}><span className="font-bold block">{fdi}</span><select aria-label={`Gigi ${fdi}`} disabled={disabled || !value.orientation_known || value.dentition === 'UNKNOWN'} className="w-16 text-xs py-2" value={tooth?.status ?? 'NOT_ASSESSED'} onChange={e => update(fdi, { status: e.target.value as EncounterExam['teeth'][number]['status'] })}>{Object.entries(statuses).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>;
      })}<span className="sr-only">Baris {i + 1}</span></div>)}
      <p className="text-xs text-center">Rahang bawah</p>
    </div>
    {value.teeth.filter(t => t.status !== 'NOT_ASSESSED').map(tooth => <div key={tooth.fdi} className="border rounded-lg p-3 space-y-2"><label className="block">Temuan gigi {tooth.fdi}<input className="block border rounded p-2 w-full" maxLength={500} value={tooth.observation} required={tooth.status === 'FINDING'} onChange={e => update(tooth.fdi, { observation: e.target.value })} /></label><fieldset className="flex flex-wrap gap-2"><legend className="text-sm">Permukaan yang diperiksa</legend>{(['MESIAL','DISTAL','BUCCAL','LINGUAL','PALATAL','OCCLUSAL','INCISAL'] as const).map(surface => <label key={surface} className="text-xs flex gap-1"><input type="checkbox" checked={tooth.surfaces.includes(surface)} onChange={e => update(tooth.fdi, { surfaces: e.target.checked ? [...tooth.surfaces, surface] : tooth.surfaces.filter(s => s !== surface) })} />{surface}</label>)}</fieldset></div>)}
  </fieldset>;
}
