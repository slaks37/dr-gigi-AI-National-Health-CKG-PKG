'use client';
interface Props {
  isOpen: boolean; onClose: () => void; patientData?: Record<string, unknown>;
  diagnosa?: string; icd10?: string; postureSeverityScore?: number; postureCondition?: string;
}
export default function SatuSehatModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="satusehat-title" className="bg-white rounded-2xl p-6 max-w-lg space-y-4">
    <h2 id="satusehat-title" className="font-bold text-xl">SATUSEHAT — NOT_CONFIGURED</h2>
    <p>Tidak ada data yang dikirim ke Kemenkes. Kredensial sandbox, identitas IHS, profil program, dan persetujuan klinis belum diverifikasi.</p>
    <p>Hasil AI tidak boleh dikirim sebagai diagnosis terkonfirmasi. Pratinjau lokal FHIR tersedia melalui API untuk administrator dan tidak menandakan sinkronisasi.</p>
    <button onClick={onClose} className="bg-emerald-700 text-white px-4 py-2 rounded-lg">Tutup</button>
  </section></div>;
}
