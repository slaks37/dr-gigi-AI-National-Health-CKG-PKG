'use client';
interface Props {
  imageUrl: string; imageIndex?: number; severityScore?: number; condition?: string;
  location?: string; cobbAngleEst?: string; findings?: Array<unknown>;
}
export default function PosturalSpineHeatmapOverlay(_props: Props) {
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="status"><strong>Analisis postur eksperimental — belum tervalidasi</strong><p>Foto biasa tidak mengukur sudut Cobb atau kelainan tulang belakang. Overlay klinis dinonaktifkan sampai tersedia validasi dan pemeriksaan dokter.</p></section>;
}
