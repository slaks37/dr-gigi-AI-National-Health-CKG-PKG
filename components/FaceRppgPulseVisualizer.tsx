'use client';
interface Props {
  mediaUrl: string; mediaType: 'video' | 'image'; pulseRate?: number; pulseRegularity?: number;
  faceShape?: string; estimatedAge?: string | number; diabetesRisk?: 'Rendah' | 'Sedang' | 'Tinggi';
  microvascularNotes?: string; findings?: Array<unknown>;
}
export default function FaceRppgPulseVisualizer(_props: Props) {
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="status"><strong>rPPG eksperimental — belum tervalidasi</strong><p>Tidak ada denyut nadi, risiko diabetes, atau vital sign yang diukur dari foto/video. Gunakan alat ukur tervalidasi dan pemeriksaan klinis.</p></section>;
}
