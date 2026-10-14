'use client';
interface IoTTelemetryData {
  weight_kg?: number; height_cm?: number; systolic_mmhg?: number; diastolic_mmhg?: number;
  pulse_bpm?: number; spo2_percent?: number; temperature_c?: number; head_circumference_cm?: number;
}
interface Props { isOpen: boolean; onClose: () => void; onApplyData: (data: IoTTelemetryData) => void }
export default function IoTDeviceHubModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="iot-title" className="bg-white rounded-2xl p-6 max-w-lg space-y-4">
    <h2 id="iot-title" className="font-bold text-xl">IoT — DISCONNECTED</h2>
    <p>Belum ada perangkat terdaftar dan terverifikasi. Koneksi BLE serta penerimaan data sensor belum divalidasi.</p>
    <p>Masukkan hanya hasil pengukuran alat yang benar-benar dilakukan. Tidak ada data contoh yang diterapkan ke formulir.</p>
    <button onClick={onClose} className="bg-emerald-700 text-white px-4 py-2 rounded-lg">Tutup</button>
  </section></div>;
}
