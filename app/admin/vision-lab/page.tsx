'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const BrowserResearchLab = dynamic(() => import('@/components/clinical/BrowserResearchLab'), { ssr: false, loading: () => <p>Memuat antarmuka Browser AI…</p> });
import ResearchModelTest from '@/components/clinical/ResearchModelTest';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/app/lib/apiClient';
import type { terminologyCoverage } from '@/src/clinical-engine/terminology/coverage';
type Lab = {
    modules: {
        id: string;
        name: string;
        readiness: string;
        model_status: string;
    }[];
    models: {
        model_id: string;
        version: string;
        license: string;
    }[];
    research_artifacts: {
        model_id: string;
        version: string;
        license: string;
        runtime_test: string;
    }[];
    coverage: ReturnType<typeof terminologyCoverage>;
    inference_status: string;
    cloud_inference_status: string;
};
export default function VisionLab() {
    const { user, role, loading } = useAuth();
    const [data, setData] = useState<Lab | null>(null), [error, setError] = useState('');
    useEffect(() => {
        if (!user || role !== 'admin')
            return;
        let active = true;
        authenticatedFetch('/api/vision-lab').then(r => r.json()).then(body => { if (active)
            setData(body); }).catch(() => { if (active)
            setError('Model Lab belum dapat dimuat.'); });
        return () => { active = false; };
    }, [user, role]);
    const download = () => { if (!data)
        return; const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'sonri-readiness.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    return <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="mx-auto max-w-6xl space-y-5"><Link href="/dashboard" className="text-emerald-700 underline">Rekam medis</Link><h1 className="text-3xl font-bold">SONRI Model Lab</h1>{loading ? <p>Memeriksa akses…</p> : !user || role !== 'admin' ? <p>Akses administrator diperlukan.</p> : <><p role="status">{error}</p>{data && <><p className="border border-amber-300 bg-amber-50 rounded-xl p-4">Belum ada model disetujui untuk pasien. Checkpoint RF-DETR SONRI sudah diuji secara lokal dengan input sintetis. Akurasi klinis belum dievaluasi; metrik independen belum tersedia.</p><div className="grid md:grid-cols-3 gap-4">{data.modules.map(m => <article key={m.id} className="bg-white border rounded-xl p-4"><h2 className="font-bold">{m.name}</h2><p>{m.readiness}</p><p>Model: {m.model_status}</p></article>)}</div><h2 className="text-xl font-bold">Model terpasang ({data.models.length})</h2>{data.models.map(m => <p key={m.model_id}>{m.model_id} {m.version} — {m.license}</p>)}<h2 className="text-xl font-bold">Artefak penelitian</h2>{data.research_artifacts.map(m => <p key={m.model_id}>{m.model_id} — {m.license}; {m.runtime_test}</p>)}<BrowserResearchLab/><ResearchModelTest configured={data.inference_status === 'LOCAL_RESEARCH_CONFIGURED'} cloudConfigured={data.cloud_inference_status === 'NEON_RESEARCH_CONFIGURED'}/><button onClick={download} className="bg-emerald-700 text-white rounded-lg p-3">Unduh laporan kesiapan tanpa data pasien</button><h2 className="text-xl font-bold">Cakupan istilah WHO ICD-10 ({data.coverage.length})</h2><p>Judul dari katalog yang ada; inklusi/eksklusi dan persetujuan klinis masih memerlukan tinjauan. Radiografi hanya dicatat sebagai interpretasi dokter.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm border-collapse"><caption className="sr-only">Kemampuan tiap kode dan pemeriksaan yang dibutuhkan</caption><thead><tr>{['Kode', 'Judul resmi', 'Aturan kandidat', 'Bukti tambahan', 'Model dievaluasi', 'Tinjauan klinis'].map(h => <th scope="col" key={h} className="border p-2">{h}</th>)}</tr></thead><tbody>{data.coverage.map(c => <tr key={c.code}><td className="border p-2"><a href={c.source} target="_blank" rel="noreferrer" className="underline">{c.code}</a></td><td className="border p-2">{c.official_title}</td><td className="border p-2">{c.candidate_rule_ids.join(', ') || 'Belum ada'}</td><td className="border p-2">{['Pemeriksaan klinis', c.needs_periodontal_exam ? 'Periodontal' : '', c.needs_vitality_test ? 'Sensibilitas' : '', c.needs_radiography ? 'Radiografi' : '', c.needs_histopathology ? 'Histopatologi' : ''].filter(Boolean).join(', ')}</td><td className="border p-2">Belum</td><td className="border p-2">{c.review_status}</td></tr>)}</tbody></table></div></>}</>}</div></main>;
}
