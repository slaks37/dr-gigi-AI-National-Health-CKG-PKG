'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../components/LanguageProvider';
import { useAccessibility } from '../../components/AccessibilityProvider';
import { useAuth } from '../../components/AuthProvider';
import LoginButton from '../../components/LoginButton';
import { authenticatedFetch } from '../lib/apiClient';
import { clearLegacyClinicalStorage } from '../lib/db';

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const { textSize, setTextSize, highContrast, setHighContrast } = useAccessibility();
  const { user, role } = useAuth();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    authenticatedFetch('/api/preferences').then(r => r.json()).then(({ preferences: p }) => {
      if (!active) return;
      if (p.language === 'id' || p.language === 'en') setLanguage(p.language);
      if (['small', 'medium', 'large'].includes(p.textSize)) setTextSize(p.textSize);
      setHighContrast(p.highContrast === true);
    }).catch(() => { if (active) setMessage('Preferensi akun belum dapat dimuat. Coba lagi.'); });
    return () => { active = false; };
  }, [user, setLanguage, setTextSize, setHighContrast]);
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      await authenticatedFetch('/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language, textSize, highContrast }) });
      setMessage('Preferensi berhasil disimpan ke akun.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal menyimpan preferensi.'); }
    finally { setSaving(false); }
  };
  const refreshStats = async () => {
    setStats(null);
    try { const res = await authenticatedFetch('/api/stats'); setStats((await res.json()).stats); }
    catch { setMessage('Status basis data belum dapat diverifikasi.'); }
  };
  return <main className="min-h-screen bg-slate-50 text-slate-900 p-6">
    <header className="max-w-4xl mx-auto flex justify-between items-center mb-8"><Link href="/" className="text-emerald-700">← Kembali</Link><LoginButton /></header>
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Pengaturan dr Gigi AI</h1>
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-bold text-xl">Bahasa dan aksesibilitas</h2>
        <label className="block">Bahasa <select className="border rounded p-2 ml-2" value={language} onChange={e => setLanguage(e.target.value as 'id' | 'en')}><option value="id">Indonesia</option><option value="en">English</option></select></label>
        <label className="block">Ukuran teks <select className="border rounded p-2 ml-2" value={textSize} onChange={e => setTextSize(e.target.value as 'small' | 'medium' | 'large')}><option value="small">Kecil</option><option value="medium">Sedang</option><option value="large">Besar</option></select></label>
        <label className="flex gap-2"><input type="checkbox" checked={highContrast} onChange={e => setHighContrast(e.target.checked)} />Kontras tinggi</label>
        <div className="flex gap-3"><button disabled={!user || saving} onClick={save} className="bg-emerald-700 text-white px-4 py-2 rounded-lg disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan preferensi akun'}</button><button onClick={() => { setLanguage('id'); setTextSize('medium'); setHighContrast(false); setMessage('Preferensi diatur ulang. Simpan untuk memperbarui akun.'); }} className="border px-4 py-2 rounded-lg">Atur ulang</button></div>
        {!user && <p>Masuk akun untuk menyimpan preferensi ke server.</p>}
        <p role="status" aria-live="polite">{message}</p>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"><h2 className="font-bold text-xl">Privasi penyimpanan</h2><p>Catatan medis baru tidak disimpan di browser. Cache medis dari versi lama tidak dibaca, ditampilkan, atau diimpor otomatis. Pastikan cadangan aman tersedia sebelum menghapus cache lama dari perangkat ini.</p><button className="border rounded-lg px-4 py-2" onClick={() => { clearLegacyClinicalStorage(); setMessage('Cache medis lama di perangkat ini telah dihapus atas permintaan Anda.'); }}>Hapus cache medis lama dari perangkat ini</button></section>
      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
        <h2 className="font-bold text-xl">Status integrasi</h2>
        <p>SATUSEHAT: NOT_CONFIGURED. Tidak ada data yang dikirim. Pratinjau FHIR lokal tersedia untuk administrator; penerimaan server Kemenkes belum diuji.</p>
        <p>IoT: DISCONNECTED. Belum ada perangkat terverifikasi atau pengukuran diterima.</p>
        <p>Skrining gejala dan pemeriksaan berkas foto tersedia pada halaman dewasa/anak. Aturan klinis masih memerlukan persetujuan profesional.</p>
        <p>Analisis foto/video dan konsultasi AI: REQUIRES_REVIEW. Penggunaan klinis dinonaktifkan sampai validasi dan kontrol penyedia tersedia.</p>
        <p>Kredensial integrasi hanya dikelola pada lingkungan server oleh administrator.</p>
      </section>
      {role === 'admin' && <section className="bg-white border rounded-2xl p-6"><h2 className="font-bold text-xl">Basis data</h2><button className="border rounded-lg p-2 my-3" onClick={refreshStats}>Periksa status Firestore</button>{stats && <dl>{Object.entries(stats).map(([key, value]) => <div key={key} className="flex gap-2"><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}</section>}
    </div>
  </main>;
}
