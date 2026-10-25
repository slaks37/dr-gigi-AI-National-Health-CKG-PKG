'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/app/lib/apiClient';
import type { Screening } from '@/src/clinical-engine/types/schema';
type RecordItem = { id: string; version: number; screening: Screening };
export default function ExaminationsPage() {
  const { user, role } = useAuth();
  const [records, setRecords] = useState<RecordItem[]>([]), [selected, setSelected] = useState<RecordItem | null>(null), [message, setMessage] = useState(''), [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => {
    if (!user || !role) return;
    let active = true;
    const view = role === 'admin' ? 'admin' : role === 'doctor' ? 'assigned' : 'mine';
    authenticatedFetch(`/api/screenings?view=${view}`).then(r => r.json()).then(data => { if (active) { setRecords(data.records); setCursor(data.nextCursor); } }).catch(e => { if (active) setMessage(e instanceof Error ? e.message : 'Belum dapat dimuat'); });
    return () => { active = false; };
  }, [user, role]);
  async function more() {
    try {
      const view = role === 'admin' ? 'admin' : role === 'doctor' ? 'assigned' : 'mine';
      const response = await authenticatedFetch(`/api/screenings?view=${view}&cursor=${encodeURIComponent(cursor!)}`); const data = await response.json();
      setRecords(prev => [...prev, ...data.records]); setCursor(data.nextCursor);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Belum dapat dimuat'); }
  }
  async function download(id: string) {
    try {
      const response = await authenticatedFetch(`/api/clinical-report?id=${encodeURIComponent(id)}&format=html`);
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.download = `sonri-${id}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Laporan belum tersedia'); }
  }
  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="max-w-6xl mx-auto space-y-6"><Link href="/sonri" className="text-emerald-700">← SONRI</Link><h1 className="font-bold text-3xl">Riwayat pemeriksaan</h1>{!user && <Link href="/login" className="underline text-emerald-700">Masuk akun untuk membuka riwayat.</Link>}<div className="grid md:grid-cols-3 gap-5"><aside className="space-y-2">{records.map(r => <button key={r.id} className="block w-full text-left p-4 border bg-white rounded-xl" onClick={() => setSelected(r)}><strong>{new Date(r.screening.screening_timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</strong><p>{r.screening.context === 'PEDIATRIC' ? 'Anak' : 'Dewasa'} · {r.screening.screening_status}</p></button>)}{user && !records.length && <p>Belum ada pemeriksaan yang dapat diakses.</p>}{cursor && <button onClick={more} className="border rounded-lg p-2">Muat berikutnya</button>}</aside>{selected && <section className="md:col-span-2 border bg-white rounded-2xl p-5 space-y-4"><h2 className="font-bold text-xl">Hasil pemeriksaan · versi {selected.version}</h2><p>{selected.screening.triage.recommendation}</p><p>Diagnosis terkonfirmasi dokter: {selected.screening.confirmed_icd10.join(', ') || 'Belum ada'}</p><p>Tinjauan: {selected.screening.clinician_review.status}</p><h3 className="font-semibold">Dugaan yang memerlukan pemeriksaan</h3>{selected.screening.clinical_suspicions.map(c => <p key={c.rule_id}>{c.candidate} — {c.explanation}</p>)}<p>Pemeriksaan tambahan: {selected.screening.required_examinations.join('; ')}</p><p className="text-amber-900">Tidak ada deteksi AI bukan bukti pasien sehat. Hasil penelitian belum tervalidasi klinis.</p><button onClick={() => download(selected.id)} className="bg-emerald-700 text-white p-3 rounded-lg">Unduh laporan / cetak PDF</button>{role === 'doctor' && <Link href="/clinical-review" className="block underline text-emerald-700">Buka tinjauan dokter</Link>}</section>}</div><p role="status">{message}</p></div></main>;
}
