'use client';
import { useState } from 'react';
import Image from 'next/image';
import { authenticatedFetch } from '@/app/lib/apiClient';
import type { ResearchPrediction } from '@/src/clinical-engine/vision/adapters/research';
import type { ImageQuality } from '@/src/clinical-engine/types/schema';
type Result = {
    prediction: ResearchPrediction;
    image_quality: ImageQuality;
    normalized_image: {
        data: string;
        mime_type: string;
    };
};
export default function ResearchModelTest({ configured }: {
    configured: boolean;
}) {
    const [file, setFile] = useState<File | null>(null), [authorized, setAuthorized] = useState(false), [result, setResult] = useState<Result | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    const run = async () => {
        if (!file || !authorized)
            return;
        setBusy(true);
        setResult(null);
        setMessage('');
        try {
            if (file.size > 3000000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
                throw new Error('Gunakan JPEG, PNG atau WebP maksimal 3 MB.');
            const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Berkas belum dapat dibaca.')); reader.readAsDataURL(file); });
            const response = await authenticatedFetch('/api/vision-lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: { data, mime_type: file.type }, image_use_authorized: true }) });
            setResult(await response.json());
            setMessage('Inferensi penelitian selesai. Hasil tidak masuk ke rekam pasien.');
        }
        catch (e) {
            setMessage(e instanceof Error ? e.message : 'Inferensi penelitian gagal. Tidak ada prediksi pengganti.');
        }
        finally {
            setBusy(false);
        }
    };
    return <section className="bg-white border rounded-xl p-4 space-y-3"><h2 className="text-xl font-bold">Uji model lokal (penelitian)</h2><p>Label mentah dan skor model merupakan keluaran eksperimental. Area oral belum divalidasi; hasil kosong tidak membuktikan sehat. Foto hanya diproses sementara di server lokal.</p>{!configured && <p className="text-amber-900">Runtime lokal belum dikonfigurasi pada host ini.</p>}<label className="block">Foto uji berizin (JPEG/PNG/WebP, maksimal 3 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !configured} onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setAuthorized(false); setMessage(''); }} className="block mt-2"/></label><label className="flex gap-2"><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)}/>Saya berwenang memproses gambar ini untuk penelitian pada server lokal.</label><button disabled={busy || !configured || !file || !authorized} onClick={run} className="border rounded p-2 disabled:opacity-50">{busy ? 'Memproses model lokal…' : 'Jalankan inferensi penelitian'}</button><p role="status">{message}</p>{result && <><p>Kualitas: {result.image_quality.status}. Area oral: belum dinilai. Waktu muat + inferensi: {Math.round(result.prediction.processing_ms)} ms.</p><p>Model: {result.prediction.model_id}; versi {result.prediction.model_version}.</p><div className="relative w-full max-w-3xl" style={{ aspectRatio: `${result.image_quality.width ?? 1}/${result.image_quality.height ?? 1}` }}><Image src={`data:${result.normalized_image.mime_type};base64,${result.normalized_image.data}`} alt="Gambar uji yang orientasinya sudah dinormalisasi dengan kotak prediksi penelitian" fill unoptimized className="object-contain"/>{result.prediction.detections.map((d, i) => <div key={i} className="absolute border-2 border-amber-400" style={{ left: `${d.box.xmin / 10}%`, top: `${d.box.ymin / 10}%`, width: `${(d.box.xmax - d.box.xmin) / 10}%`, height: `${(d.box.ymax - d.box.ymin) / 10}%` }}><span className="bg-amber-200 text-black text-xs">{d.raw_label} ({d.score.toFixed(3)})</span></div>)}</div><p>{result.prediction.detections.length} deteksi mentah. Skor bukan kepercayaan klinis.</p><details><summary>Provenans dan deteksi</summary><pre className="overflow-x-auto text-xs">{JSON.stringify(result.prediction, null, 2)}</pre></details></>}</section>;
}
