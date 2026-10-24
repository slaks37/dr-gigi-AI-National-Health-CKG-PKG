'use client';
import { useState } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const { user, role, signIn, signOut } = useAuth();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await signInWithEmailAndPassword(auth, email, password); setPassword(''); }
    catch { setMessage('Tidak dapat masuk. Periksa akun atau hubungi pengelola klinik.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 p-6"><div className="max-w-md mx-auto mt-12 bg-white border rounded-2xl p-6 space-y-5"><Link href="/sonri" className="text-emerald-700">← SONRI</Link><h1 className="text-2xl font-bold">Akun pemeriksaan</h1>{user ? <><p role="status">Masuk sebagai {role ?? 'memuat peran'}.</p><Link className="block text-emerald-700 underline" href="/clinical-review">Buka ruang dokter</Link><Link className="block text-emerald-700 underline" href="/checkup">Mulai pemeriksaan</Link><button onClick={signOut} className="border rounded-lg p-2">Keluar akun</button></> : <><form onSubmit={login} className="space-y-4"><label className="block">Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="block border rounded p-2 w-full" /></label><label className="block">Kata sandi<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="block border rounded p-2 w-full" /></label><button disabled={busy} className="bg-emerald-700 text-white rounded-lg p-3 disabled:opacity-50">{busy ? 'Memproses…' : 'Masuk dengan email'}</button></form><button onClick={signIn} className="border rounded-lg p-3">Masuk dengan Google</button><p className="text-sm text-slate-600">Gunakan akun yang didaftarkan pengelola klinik. Kewenangan dokter ditetapkan melalui verifikasi kredensial profesional.</p></>}<p role="alert">{message}</p></div></main>;
}
