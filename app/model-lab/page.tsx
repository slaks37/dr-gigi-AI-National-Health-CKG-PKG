'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import LoginButton from '@/components/LoginButton';
import { authenticatedFetch } from '@/app/lib/apiClient';

type Model = { id: string; modality: string; available?: boolean; availability?: string; reason?: string };
type Output = { clinical_use: string; label_verification: string; latency_ms: number; model_id: string; model_version: string; warnings: string[]; findings: { raw_label: string; score: number; box?: number[] | null }[] };
export default function ModelLabPage() {
  const { user, role } = useAuth();
  const [models, setModels] = useState<Model[]>([]), [model, setModel] = useState(''), [modality, setModality] = useState('intraoral');
  const [fixture, setFixture] = useState<File | null>(null), [preview, setPreview] = useState(''), [consent, setConsent] = useState(false), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState<Output | null>(null);
  useEffect(() => {
    if (!user || role !== 'admin') return;
    let active = true;
    authenticatedFetch('/api/models').then(r => r.json()).then(data => { if (active) setModels(data.inventory.models); }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Model tidak tersedia'); });
    return () => { active = false; };
  }, [user, role]);
  useEffect(() => {
    if (!fixture) { setPreview(''); return; }
    const url = URL.createObjectURL(fixture); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [fixture]);
  async function run() {
    if (!fixture || !consent) return;
    setBusy(true); setResult(null); setMessage('');
    try {
      if (fixture.size > 2_500_000) throw new Error('Gunakan fixture hingga 2,5 MB.');
      const bytes = new Uint8Array(await fixture.arrayBuffer());
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await authenticatedFetch('/api/model-lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_id: model, modality, synthetic_fixture: true, research_opt_in: true, mime_type: fixture.type, data: btoa(binary) }) });
      const data = await response.json(); setResult(data.result); setMessage(`Inferensi selesai. Jejak penelitian: ${data.run_id}.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Inferensi gagal'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="max-w-5xl mx-auto space-y-6"><div className="flex justify-between"><Link href="/sonri" className="text-emerald-700">← SONRI</Link><LoginButton /></div><h1 className="text-3xl font-bold">Laboratorium model</h1><p className="bg-amber-50 border border-amber-200 p-4 rounded-xl">Khusus penelitian dengan gambar sintetis. Jangan unggah foto pasien atau data identitas. Label mentah belum terverifikasi; penggunaan klinis dilarang. Model yang tidak tersedia tidak menghasilkan temuan.</p>{(!user || role !== 'admin') ? <p>Masuk sebagai administrator untuk melihat ketersediaan dan menjalankan model.</p> : <><section className="bg-white border rounded-xl p-5 space-y-4"><h2 className="font-bold text-xl">Pilih jalur inferensi</h2><label className="block">Modalitas<select aria-label="Modalitas" className="block border rounded p-2 w-full" value={modality} onChange={e => { setModality(e.target.value); setModel(''); setResult(null); }}><option value="intraoral">Foto intraoral</option><option value="panoramic">Radiografi panoramik</option><option value="cbct">CBCT</option></select></label><label className="block">Model<select aria-label="Model" className="block border rounded p-2 w-full" value={model} onChange={e => { setModel(e.target.value); setResult(null); }}><option value="">Pilih model</option>{models.filter(m => m.modality === modality).map(m => <option key={m.id} value={m.id}>{m.id} — {m.available ? 'penelitian tersedia' : 'tidak tersedia'}</option>)}</select></label>{models.filter(m => m.modality === modality).map(m => <p key={m.id} className="text-sm text-slate-600">{m.id}: {m.reason || m.availability || (m.available ? 'Belum tervalidasi klinis' : 'Bobot atau izin belum tersedia')}</p>)}{modality === 'cbct' ? <p>Volume CBCT memerlukan checkpoint dan konfigurasi ToothSeg yang terverifikasi. Unggah volume belum diaktifkan pada antarmuka web.</p> : <label className="block">Fixture sintetis (PNG/JPEG)<input type="file" accept="image/png,image/jpeg" onChange={e => { setFixture(e.target.files?.[0] ?? null); setResult(null); setConsent(false); }} className="block mt-2" /></label>}<label className="flex gap-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Saya memastikan input sintetis, tanpa pasien, dan menyetujui pemrosesan oleh layanan inferensi penelitian.</label><button disabled={!fixture || !model || !consent || busy || modality === 'cbct'} onClick={run} className="bg-emerald-700 text-white rounded-lg p-3 disabled:opacity-50">{busy ? 'Memproses…' : 'Jalankan inferensi penelitian'}</button></section>{preview && <div className="relative bg-slate-900 rounded-xl overflow-hidden"><Image src={preview} alt="Fixture sintetis untuk penelitian" width={704} height={704} unoptimized className="w-full h-auto" />{result && <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-label="Anotasi mentah model">{result.findings.filter(f => Array.isArray(f.box) && f.box.length === 4).map((f, i) => <rect key={i} x={f.box![0]} y={f.box![1]} width={f.box![2] - f.box![0]} height={f.box![3] - f.box![1]} fill="none" stroke="#fbbf24" strokeWidth={0.003} />)}</svg>}</div>}{result && <section className="bg-white border rounded-xl p-5 space-y-3"><h2 className="font-bold text-xl">Hasil penelitian</h2><p>{result.model_id} · {result.model_version} · {result.latency_ms} ms</p><p>Label: {result.label_verification} · Penggunaan klinis: {result.clinical_use}</p>{result.findings.length ? <ul>{result.findings.map((f, i) => <li key={i}>{f.raw_label} — skor mentah {f.score.toFixed(4)} (bukan probabilitas diagnosis)</li>)}</ul> : <p>Tidak ada temuan pada fixture ini. Ini tidak membuktikan kesehatan pasien atau kinerja klinis.</p>}{result.warnings.map(w => <p key={w}>{w}</p>)}</section>}</>}<p role="status" aria-live="polite">{message}</p></div></main>;
}
