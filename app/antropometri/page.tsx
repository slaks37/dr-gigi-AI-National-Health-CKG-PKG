'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, FileText, Download, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Activity, X, Trash2, LayoutDashboard, FileJson, ArrowLeft, Cpu, ShieldCheck, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import Image from 'next/image';
import { saveRecord, updateRecord } from '../lib/db';
import { useLanguage } from '../../components/LanguageProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import LoginButton from '../../components/LoginButton';
import { useAuth } from '../../components/AuthProvider';
import IoTDeviceHubModal from '../../components/IoTDeviceHubModal';
import SatuSehatModal from '../../components/SatuSehatModal';
import PosturalSpineHeatmapOverlay from '../../components/PosturalSpineHeatmapOverlay';

const SYSTEM_INSTRUCTION = `
1. VALIDASI GAMBAR (LANGKAH PERTAMA & KRUSIAL)
- Sebelum melakukan analisa, Anda WAJIB memindai gambar untuk memastikan gambar tersebut adalah FOTO PASIEN / MANUSIA (seluruh tubuh, postur tubuh, atau bagian tubuh tertentu yang relevan untuk pemeriksaan fisik).
- Jika gambar BUKAN manusia/pasien (misal: benda mati, pemandangan, hewan, atau terlalu buram), HENTIKAN ANALISA.
- Set "is_valid_image": false dalam JSON.
- Berikan pesan di summary: "Gambar tidak terdeteksi sebagai foto pasien untuk pemeriksaan fisik. Mohon unggah foto yang jelas."

2. Persona & Otoritas Medis
Anda adalah AI Dokter Ahli Pemeriksaan Fisik, Skrining Postur & Ahli Gizi Klinis. Anda menggabungkan standar klinis dari World Health Organization (WHO) dan Kementerian Kesehatan RI:
- Untuk Anak & Remaja (0-18 tahun): Permenkes No. 2 Tahun 2020 tentang Standar Antropometri Anak (BB/U, TB/U, BB/TB, IMT/U, Lingkar Kepala/LILA).
- Untuk Pasien Dewasa (>18 tahun): Standar Kemenkes RI & WHO untuk IMT (Kurus <18.5, Normal 18.5-22.9, Overweight 23.0-24.9, Obesitas I 25.0-29.9, Obesitas II >=30.0) serta klasifikasi Tekanan Darah JNC-8/Kemenkes.

3. Instruksi Tugas Utama (Analisis Gabungan Data Klinis & Vision)
Anda akan menerima data klinis pasien (Nama, Umur, TB, BB, Lingkar Kepala/Lengan jika balita, Tekanan Darah, hasil periksa Mata, Telinga, Gigi, Buta Warna) beserta foto visual pasien.
- Lakukan penilaian status gizi berdasarkan Umur, TB, dan BB (serta Lingkar Kepala/Lengan jika ada).
- Analisis postur tubuh pasien secara umum dari foto (apakah tampak kurus, proporsional, atau obesitas).
- Periksa tanda-tanda klinis yang terlihat secara visual pada foto (kulit, postur tulang belakang, kesimetrisan bahu/pinggul, dll).
- SECARA KHUSUS, DETEKSI KELAINAN POSTUR seperti Skoliosis (tulang belakang melengkung ke samping), Kifosis (bungkuk), atau Lordosis.
- Jika terdeteksi kelainan postur, berikan skor keparahan (severity_score) dari 1 hingga 10, dan deskripsikan lokasi kelainan secara spesifik.
- Integrasikan hasil pemeriksaan fisik dari tenaga kesehatan (Telinga, Mata, Gigi, Buta Warna, Tekanan Darah) ke dalam kesimpulan dan rekomendasi Anda.
- JIKA ADA KELAINAN VISUAL PADA FOTO: Tentukan koordinat bounding box (kotak pembatas) area kelainan dengan SANGAT PRESISI (skala 0-1000 untuk ymin, xmin, ymax, xmax).
- JIKA FOTO TAMPAK NORMAL: Pastikan tidak ada kotak pembatas yang dihasilkan.

4. Penanganan Kondisi Normal
- Jika TIDAK ditemukan tanda klinis penyakit atau kelainan postur:
  - Nyatakan dengan jelas bahwa "Pemeriksaan Fisik Visual Tampak Normal".
  - WAJIB tetap memberikan rekomendasi untuk menjaga pola makan gizi seimbang dan aktivitas fisik rutin.

5. Referensi ICD-10 Lengkap
Gunakan kode-kode berikut untuk semua diagnosa visual (jika ada indikasi):
- E46 Unspecified protein-energy malnutrition (Kurus/Gizi Kurang)
- E66.9 Obesity, unspecified (Obesitas)
- M41.9 Scoliosis, unspecified (Skoliosis)
- M40.0 Postural kyphosis (Kifosis postural)
- L01.0 Impetigo (Infeksi kulit)
- Z00.00 General medical examination without abnormal findings
- Z00.129 Encounter for routine child health examination without abnormal findings (Normal Anak)
- Z00.121 Encounter for routine child health examination with abnormal findings

6. Protokol Output Ganda (MANDATORY)
Setiap akhir analisis, Anda HARUS menghasilkan dua blok output dalam format JSON tunggal.
Format JSON yang WAJIB diikuti:
{
  "json_output": {
    "status": "success",
    "is_valid_image": true, 
    "patient_id": "auto-gen",
    "patient_name": "...",
    "patient_age": "...",
    "timestamp": "ISO-8601",
    "analysis_type": "COMPREHENSIVE_PHYSICAL_MCU",
    "findings": [
      {
        "image_index": 0,
        "medis": "...",
        "icd10": "...",
        "confidence_score": "0-100%",
        "lokasi_sakit": {
          "ymin": 0, 
          "xmin": 0, 
          "ymax": 0, 
          "xmax": 0
        }
      }
    ],
    "clinical_summary": {
        "nutritional_status": "...",
        "blood_pressure": "...",
        "physical_exam": "..."
    },
    "posture_analysis": {
        "condition": "Normal | Skoliosis | Kifosis | Lainnya",
        "severity_score": 0,
        "location": "..."
    },
    "nutrition_metrics": {
        "imt": 0.0,
        "imt_z_score": 0.0,
        "tb_u_z_score": 0.0,
        "bb_u_z_score": 0.0
    },
    "summary": {
        "status": "NORMAL" | "PERLU_PERHATIAN" | "INVALID",
        "pesan": "..."
    },
    "urgency_level": "NORMAL | PERLU_TINDAKAN | DARURAT",
    "action_required": ["Edukasi Gizi", "Rujuk ke Puskesmas/Faskes", "Periksa Postur", "Aktivitas Fisik"],
    "is_emergency": false
  },
  "markdown_report": "### 👤 Data Pasien\n- **Nama:** ...\n- **Umur:** ... Tahun\n- **Antropometri:** TB: ... cm, BB: ... kg [tambahkan LILA/Lingkar Kepala jika balita]\n- **Tekanan Darah:** ... mmHg\n\n### 🩺 Hasil Pemeriksaan Fisik (Nakes / IoT)\n- **Mata:** ...\n- **Telinga:** ...\n- **Gigi:** ...\n- **Buta Warna:** ...\n\n### 🤖 Analisis AI (Gizi, Postur & Visual)\n- **Status Gizi:** [Penilaian status gizi berdasarkan TB/BB/Umur]\n- **Analisis Postur:** [Kondisi postur, Skor Keparahan (jika ada), Lokasi]\n- **Temuan Visual:** [Sebutkan semua temuan dari foto atau \"Tampak Normal\"]\n- **Kode ICD-10:** [List Kode ICD-10]\n\n### 💡 Rekomendasi Kesehatan\n- **Tindakan Lanjutan:** [Misal: Evaluasi berkala di Faskes, Konsultasi Dokter]\n- **Edukasi Gizi & Gaya Hidup:** [Misal: Gizi seimbang, perbaiki postur ergonomis]\n\n---\n*Disclaimer: Hasil ini dihasilkan oleh AI berdasarkan analisis visual foto dan data klinis yang diinputkan. Terintegrasi dengan SATUSEHAT Kemenkes RI.*"
}

Catatan untuk lokasi_sakit:
- Jika normal atau invalid, kosongkan array findings atau isi lokasi_sakit dengan 0.
- Jika ada kelainan visual, isi dengan koordinat area (skala 0-1000).
- "image_index" WAJIB diisi integer (0, 1, 2...) sesuai urutan gambar yang dianalisis.
`;

type MediaItem = {
  id: string;
  type: 'image';
  url: string;
  file?: File;
  mimeType: string;
};

export default function AntropometriPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [patientData, setPatientData] = useState({
    name: '',
    age: '',
    height: '',
    weight: '',
    headCircumference: '',
    armCircumference: '',
    earHealth: 'Normal',
    earNotes: '',
    eyeHealth: 'Normal',
    eyeNotes: '',
    dentalHealth: 'Normal',
    dentalNotes: '',
    colorBlindness: 'Normal',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    pulseRate: '',
    bodyTemperature: ''
  });
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null);
  
  // IoT & SATUSEHAT states
  const [isIotModalOpen, setIsIotModalOpen] = useState(false);
  const [isSatuSehatModalOpen, setIsSatuSehatModalOpen] = useState(false);
  const [iotSynced, setIotSynced] = useState(false);
  const [lastIotDevice, setLastIotDevice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const reportRef = useRef<HTMLDivElement>(null);
  const resultContainerRef = useRef<HTMLDivElement>(null);

  const handleApplyIoTData = (data: any) => {
    setPatientData(prev => ({
      ...prev,
      weight: data.weight_kg !== undefined ? String(data.weight_kg) : prev.weight,
      height: data.height_cm !== undefined ? String(data.height_cm) : prev.height,
      bloodPressureSystolic: data.systolic_mmhg !== undefined ? String(data.systolic_mmhg) : prev.bloodPressureSystolic,
      bloodPressureDiastolic: data.diastolic_mmhg !== undefined ? String(data.diastolic_mmhg) : prev.bloodPressureDiastolic,
      pulseRate: data.pulse_bpm !== undefined ? String(data.pulse_bpm) : prev.pulseRate,
      bodyTemperature: data.temperature_c !== undefined ? String(data.temperature_c) : prev.bodyTemperature,
      headCircumference: data.head_circumference_cm !== undefined ? String(data.head_circumference_cm) : prev.headCircumference
    }));
    setIotSynced(true);
    setLastIotDevice('IoT Gateway Hub (Live Data Applied)');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newItems: MediaItem[] = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        type: 'image',
        url: URL.createObjectURL(file),
        file,
        mimeType: file.type
      }));
      setMediaItems(prev => [...prev, ...newItems]);
      setResult(null);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
      setIsCameraOpen(false);
    }
  };

  const toggleCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    // Restart camera with new mode if it's already open
    if (isCameraOpen) {
      stopCamera();
      setIsCameraOpen(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: newMode } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error switching camera:", err);
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setMediaItems(prev => [...prev, {
          id: Math.random().toString(36).substring(7),
          type: 'image',
          url: dataUrl,
          mimeType: 'image/jpeg'
        }]);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const removeMedia = (id: string) => {
    setMediaItems(prev => prev.filter(item => item.id !== id));
  };

  const fileToGenerativePart = async (item: MediaItem): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      if (item.file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(',')[1];
          resolve({
            data: base64Data,
            mimeType: item.mimeType || 'image/jpeg'
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(item.file);
      } else if (item.url.startsWith('data:')) {
        const base64Data = item.url.split(',')[1];
        resolve({
          data: base64Data,
          mimeType: item.mimeType || 'image/jpeg'
        });
      } else {
        resolve({
          data: item.url,
          mimeType: item.mimeType || 'image/jpeg'
        });
      }
    });
  };

  const saveToHistory = async (data: any, image: string) => {
    try {
      // Handle backward compatibility or new structure
      const diagnosa = data.json_output.findings && data.json_output.findings.length > 0 
        ? data.json_output.findings.map((f: any) => f.medis).join(', ')
        : (data.json_output.summary?.status === 'NORMAL' ? 'Tampak Normal' : 'Tidak Terdeteksi');

      const icd10 = data.json_output.findings && data.json_output.findings.length > 0
        ? data.json_output.findings.map((f: any) => f.icd10).join(', ')
        : (data.json_output.summary?.status === 'NORMAL' ? 'Z00.129' : '-');

      const newRecord = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        patient_id: data.json_output.patient_id || 'unknown',
        type: 'Pemeriksaan Fisik',
        diagnosa: diagnosa,
        icd10: icd10,
        confidence: data.json_output.findings?.[0]?.confidence_score || '100%',
        image_url: image, // Save the first image as thumbnail/reference
        json_output: data.json_output,
        markdown_report: data.markdown_report
      };
      await saveRecord(newRecord);
    } catch (e) {
      console.error("Failed to save to history:", e);
    }
  };

  const analyzeMedia = async () => {
    if (mediaItems.length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const prompt = `Lakukan VALIDASI GAMBAR terlebih dahulu. Apakah ini foto pasien/manusia untuk pemeriksaan fisik? Jika TIDAK, set 'is_valid_image': false dan hentikan analisis. Jika YA, lanjutkan analisis SEMUA foto. Untuk setiap temuan klinis visual, WAJIB sertakan 'image_index' (integer, mulai dari 0). Deteksi kelainan postur (skoliosis, kifosis, lordosis, asimetri bahu) atau kondisi normal dengan bounding box presisi.
      
Data Klinis & Antropometri Pasien:
- Nama: ${patientData.name || 'Tidak diisi'}
- Umur: ${patientData.age ? patientData.age + ' Tahun' : 'Tidak diisi'}
- Tinggi Badan: ${patientData.height ? patientData.height + ' cm' : 'Tidak diisi'}
- Berat Badan: ${patientData.weight ? patientData.weight + ' kg' : 'Tidak diisi'}
${patientData.headCircumference ? `- Lingkar Kepala: ${patientData.headCircumference} cm` : ''}
${patientData.armCircumference ? `- Lingkar Lengan Atas (LILA): ${patientData.armCircumference} cm` : ''}
${patientData.pulseRate ? `- Denyut Nadi (Pulse): ${patientData.pulseRate} bpm` : ''}
${patientData.bodyTemperature ? `- Suhu Tubuh: ${patientData.bodyTemperature} °C` : ''}

Hasil Pemeriksaan Fisik (Nakes & Sensor IoT):
- Telinga: ${patientData.earHealth} ${patientData.earHealth === 'Ada Kelainan' ? `(Catatan: ${patientData.earNotes})` : ''}
- Mata: ${patientData.eyeHealth} ${patientData.eyeHealth === 'Ada Kelainan' ? `(Catatan: ${patientData.eyeNotes})` : ''}
- Gigi & Mulut: ${patientData.dentalHealth} ${patientData.dentalHealth === 'Ada Kelainan' ? `(Catatan: ${patientData.dentalNotes})` : ''}
- Buta Warna: ${patientData.colorBlindness}
- Tekanan Darah: ${patientData.bloodPressureSystolic && patientData.bloodPressureDiastolic ? `${patientData.bloodPressureSystolic}/${patientData.bloodPressureDiastolic} mmHg` : 'Tidak diisi'}
`;
      
      const mediaParts = await Promise.all(mediaItems.map(fileToGenerativePart));

      const apiRes = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: SYSTEM_INSTRUCTION,
          prompt,
          images: mediaParts
        })
      });

      const resData = await apiRes.json();
      if (!apiRes.ok || !resData.success) {
        throw new Error(resData.error || "Gagal melakukan analisis media dengan Gemini AI");
      }

      const responseText = resData.result;
      console.log("Raw response:", responseText);
      
      try {
        if (responseText) {
            const parsedResult = JSON.parse(responseText);
            setResult(parsedResult);
            // Save to RME Dashboard
            if (mediaItems.length > 0) {
                await saveToHistory(parsedResult, mediaItems[0].url);
            }
        } else {
            throw new Error("Empty response");
        }
      } catch (e) {
        console.error("Failed to parse JSON:", e);
        setResult({
            markdown_report: responseText || "Error: No text returned",
            json_output: { status: "error", message: "Failed to parse structured output" }
        });
      }

    } catch (error: any) {
      console.error("Analysis failed:", error);
      
      let errorMessage = "Terjadi kesalahan saat menganalisis media. Silakan coba lagi.";
      
      // Handle Rate Limit specifically
      if (error.message?.includes("429") || error.message?.toLowerCase().includes("rate limit")) {
        errorMessage = "Batas penggunaan API (Rate Limit) terlampaui. Mohon tunggu 1 menit sebelum mencoba lagi.";
      } else if (error.message?.includes("API Key")) {
        errorMessage = "API Key tidak valid atau tidak ditemukan. Hubungi administrator.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (isAccurate: boolean) => {
    if (!result || !result.id) return;
    setFeedbackGiven(isAccurate ? 'yes' : 'no');
    await updateRecord(result.id, { is_accurate: isAccurate });
  };

  const exportPDF = async () => {
    if (!resultContainerRef.current) return;

    const btn = document.getElementById('btn-export-pdf');
    const originalContent = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<span class="animate-spin inline-block mr-2">⌛</span> Memproses...';
        btn.setAttribute('disabled', 'true');
    }

    try {
      // 1. Capture the Report UI
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for render

      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(resultContainerRef.current, { 
        scale: 2,
        useCORS: true, 
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      let heightLeft = scaledHeight;
      let position = 0;

      // Add Report Pages
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - scaledHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
      }

      // 2. Add Original Images as Appendices
      if (mediaItems.length > 0) {
        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            if (item.type === 'image' && item.url) {
              try {
                pdf.addPage();
                
                // Add Title for the Image Page
                pdf.setFontSize(14);
                pdf.setTextColor(0);
                const attachmentLabel = t('report.attachment') || 'Lampiran';
                pdf.text(`${attachmentLabel} ${i + 1}`, 10, 15);
                
                // Load image to get dimensions
                const img = document.createElement('img');
                img.crossOrigin = "anonymous";
                await new Promise((resolve) => {
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                    img.src = item.url;
                    if (img.complete) resolve(true);
                });

                if (img.width && img.height) {
                  // Calculate dimensions to fit page
                  const margin = 10;
                  const maxImgWidth = pdfWidth - (margin * 2);
                  const maxImgHeight = pdfHeight - (margin * 2) - 20; // -20 for title
                  
                  const imgRatio = img.width / img.height;
                  let finalWidth = maxImgWidth;
                  let finalHeight = finalWidth / imgRatio;

                  if (finalHeight > maxImgHeight) {
                      finalHeight = maxImgHeight;
                      finalWidth = finalHeight * imgRatio;
                  }

                  // Center the image
                  const x = (pdfWidth - finalWidth) / 2;
                  const y = 20 + (maxImgHeight - finalHeight) / 2; // Start after title

                  const tempCanvas = document.createElement('canvas');
                  tempCanvas.width = img.width;
                  tempCanvas.height = img.height;
                  const ctx = tempCanvas.getContext('2d');
                  if (ctx) {
                      ctx.drawImage(img, 0, 0);
                      const itemImgData = tempCanvas.toDataURL('image/jpeg', 0.90);
                      pdf.addImage(itemImgData, 'JPEG', x, y, finalWidth, finalHeight);
                  }
                }
              } catch (imgErr) {
                console.warn("Could not attach image to PDF:", imgErr);
              }
            }
        }
      }

      // Add page numbers and footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        const pageLabel = t('report.page') || 'Halaman';
        const fromLabel = t('report.from') || 'dari';
        const idLabel = t('report.id') || 'ID';
        const footerLabel = t('report.footer') || 'dr Gigi AI - Hasil Skrining Klinis Digital';
        pdf.text(`${pageLabel} ${i} ${fromLabel} ${totalPages} | ${idLabel}: ${result.json_output?.patient_id || '-'} | ${new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID')}`, 10, pdfHeight - 10);
        pdf.text(footerLabel, pdfWidth - 10, pdfHeight - 10, { align: 'right' });
      }

      pdf.setProperties({
        title: `${t('report.titleAntropometri') || 'Laporan Pemeriksaan Fisik'} - ${new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID')}`,
        subject: t('report.subject') || 'Hasil Analisis AI',
        author: 'dr Gigi AI',
        creator: 'dr Gigi AI'
      });

      pdf.save(`Laporan-Fisik-AI-${result.json_output?.patient_id || new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Gagal mengunduh PDF. Pastikan gambar sudah termuat sepenuhnya.");
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.removeAttribute('disabled');
        }
    }
  };

  const exportJSON = () => {
    if (!result) return;
    const jsonString = 'data:text/json;chatset=utf-8,' + encodeURIComponent(
      JSON.stringify(result.json_output, null, 2)
    );
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `${language === 'en' ? 'Physical-Data' : 'Data-Fisik'}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // Helper to calculate box style
  const getBoxStyle = (box: any) => {
    if (!box || (box.ymin === 0 && box.ymax === 0 && box.xmin === 0 && box.xmax === 0)) return null;
    // Gemini returns 0-1000 scale
    const top = (box.ymin / 1000) * 100;
    const left = (box.xmin / 1000) * 100;
    const height = ((box.ymax - box.ymin) / 1000) * 100;
    const width = ((box.xmax - box.xmin) / 1000) * 100;
    
    return {
      top: top + '%',
      left: left + '%',
      height: height + '%',
      width: width + '%'
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors">
                <span className="font-bold">← Kembali</span>
            </Link>
            <h1 className="font-bold text-base sm:text-lg text-slate-800 text-center">Pemeriksaan Fisik & Antropometri</h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all"
                title="Pusat Pengaturan, IoT Hub, SATUSEHAT & Integrasi API"
              >
                <Settings size={15} className="text-slate-600" />
                <span className="hidden sm:inline">Pengaturan & Integrasi</span>
              </Link>

              <Link href="/dashboard" className="hidden md:flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-semibold">
                  <LayoutDashboard size={15} />
                  <span>Dashboard</span>
              </Link>
              <div className="hidden sm:block"><LoginButton /></div>
            </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Patient Data Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Data Pasien & Antropometri</h2>
            {iotSynced ? (
              <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                ✓ Diisi otomatis dari IoT Hub
              </span>
            ) : (
              <Link 
                href="/settings"
                className="text-xs text-slate-500 hover:text-blue-600 font-medium flex items-center gap-1 hover:underline"
              >
                <Cpu size={13} />
                Hubungkan IoT via Pengaturan
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pasien</label>
              <input type="text" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.name} onChange={e => setPatientData({...patientData, name: e.target.value})} placeholder="Contoh: Ananda Pratama" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Umur (Tahun)</label>
              <input type="number" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.age} onChange={e => setPatientData({...patientData, age: e.target.value})} placeholder="Contoh: 7 atau 28" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tinggi Badan (cm)</label>
              <input type="number" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.height} onChange={e => setPatientData({...patientData, height: e.target.value})} placeholder="Contoh: 120" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Berat Badan (kg)</label>
              <input type="number" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.weight} onChange={e => setPatientData({...patientData, weight: e.target.value})} placeholder="Contoh: 22.5" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lingkar Kepala (cm) <span className="text-xs text-slate-400 font-normal">(opsional)</span></label>
              <input type="number" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.headCircumference} onChange={e => setPatientData({...patientData, headCircumference: e.target.value})} placeholder="Contoh: 48" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lingkar Lengan Atas / LILA (cm) <span className="text-xs text-slate-400 font-normal">(opsional)</span></label>
              <input type="number" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.armCircumference} onChange={e => setPatientData({...patientData, armCircumference: e.target.value})} placeholder="Contoh: 15.5" />
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4 text-slate-800 mt-8 border-t pt-6">Pemeriksaan Fisik & Tanda Vital (Nakes / Sensor IoT)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Telinga */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Telinga</label>
              <select className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.earHealth} onChange={e => setPatientData({...patientData, earHealth: e.target.value})}>
                <option value="Normal">Normal</option>
                <option value="Ada Kelainan">Ada Kelainan</option>
              </select>
              {patientData.earHealth === 'Ada Kelainan' && (
                <input type="text" placeholder="Catatan kelainan..." className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg text-sm mt-2 min-h-[44px] sm:min-h-0" value={patientData.earNotes} onChange={e => setPatientData({...patientData, earNotes: e.target.value})} />
              )}
            </div>

            {/* Mata */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Mata</label>
              <select className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.eyeHealth} onChange={e => setPatientData({...patientData, eyeHealth: e.target.value})}>
                <option value="Normal">Normal</option>
                <option value="Ada Kelainan">Ada Kelainan</option>
              </select>
              {patientData.eyeHealth === 'Ada Kelainan' && (
                <input type="text" placeholder="Catatan kelainan..." className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg text-sm mt-2 min-h-[44px] sm:min-h-0" value={patientData.eyeNotes} onChange={e => setPatientData({...patientData, eyeNotes: e.target.value})} />
              )}
            </div>

            {/* Gigi */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Gigi & Mulut</label>
              <select className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.dentalHealth} onChange={e => setPatientData({...patientData, dentalHealth: e.target.value})}>
                <option value="Normal">Normal</option>
                <option value="Ada Kelainan">Ada Kelainan</option>
              </select>
              {patientData.dentalHealth === 'Ada Kelainan' && (
                <input type="text" placeholder="Catatan kelainan..." className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg text-sm mt-2 min-h-[44px] sm:min-h-0" value={patientData.dentalNotes} onChange={e => setPatientData({...patientData, dentalNotes: e.target.value})} />
              )}
            </div>

            {/* Buta Warna */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Tes Buta Warna</label>
              <select className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.colorBlindness} onChange={e => setPatientData({...patientData, colorBlindness: e.target.value})}>
                <option value="Normal">Normal</option>
                <option value="Buta Warna Parsial">Buta Warna Parsial</option>
                <option value="Buta Warna Total">Buta Warna Total</option>
              </select>
            </div>

            {/* Tekanan Darah */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Tekanan Darah (mmHg)</label>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="Sistolik (cth: 120)" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.bloodPressureSystolic} onChange={e => setPatientData({...patientData, bloodPressureSystolic: e.target.value})} />
                <span className="text-slate-500 font-bold">/</span>
                <input type="number" placeholder="Diastolik (cth: 80)" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.bloodPressureDiastolic} onChange={e => setPatientData({...patientData, bloodPressureDiastolic: e.target.value})} />
              </div>
            </div>

            {/* Suhu & Nadi */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Nadi (bpm) & Suhu (°C)</label>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="Nadi (cth: 78)" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.pulseRate} onChange={e => setPatientData({...patientData, pulseRate: e.target.value})} />
                <span className="text-slate-500 font-bold">|</span>
                <input type="number" step="0.1" placeholder="Suhu (cth: 36.6)" className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg min-h-[44px] sm:min-h-0" value={patientData.bodyTemperature} onChange={e => setPatientData({...patientData, bodyTemperature: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

        {/* Input Section - Universal Foto Pasien */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold mb-2 text-slate-800">Ambil Foto Pasien & Dokumentasi Fisik</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Unggah foto seluruh tubuh atau bagian tertentu untuk skrining AI: deteksi kelainan postur (skoliosis, kifosis, asimetri), status visual gizi, dan kondisi klinis.
          </p>

          {/* Camera Viewfinder */}
          {isCameraOpen && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-6">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6 items-center">
                <button 
                  onClick={capturePhoto}
                  className="flex flex-col items-center gap-1 text-white"
                  title="Ambil Foto"
                >
                  <div className="w-14 h-14 bg-white rounded-full border-4 border-slate-300 shadow-lg hover:scale-105 transition-transform" />
                  <span className="text-xs font-medium shadow-black drop-shadow-md">Foto</span>
                </button>

                <button 
                  onClick={toggleCamera}
                  className="flex flex-col items-center gap-1 text-white"
                  title="Ganti Kamera"
                >
                  <div className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 hover:bg-black/60 transition-colors">
                    <RefreshCw size={18} />
                  </div>
                  <span className="text-xs font-medium shadow-black drop-shadow-md">Ganti</span>
                </button>

                <button 
                  onClick={stopCamera}
                  className="absolute right-4 top-4 px-4 py-2 bg-black/50 text-white rounded-full backdrop-blur-sm text-sm hover:bg-black/70 border border-white/20"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isCameraOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <button 
                onClick={startCamera}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors gap-3 group"
              >
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  <Camera size={20} />
                </div>
                <span className="font-medium text-emerald-800">Buka Kamera</span>
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors gap-3 group"
              >
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 group-hover:scale-110 transition-transform">
                  <Upload size={20} />
                </div>
                <span className="font-medium text-slate-700">Upload File Foto</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => {
                    handleFileUpload(e);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }} 
                accept="image/*" 
                multiple
                className="hidden" 
              />
            </div>
          )}

          {/* Media Preview Grid */}
          {mediaItems.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Media Terpilih ({mediaItems.length})</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {mediaItems.map((item) => (
                  <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                    <Image src={item.url} alt="Preview" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <button 
                      onClick={() => removeMedia(item.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={analyzeMedia}
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" /> Menganalisis...
                  </>
                ) : (
                  <>
                    <Activity /> Analisis Sekarang
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!user ? (
                <div className="bg-white p-8 rounded-2xl text-center shadow-lg border border-slate-200">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="text-emerald-500" size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Pemeriksaan Berhasil Selesai!</h2>
                    <p className="text-slate-600 mb-6 max-w-md mx-auto">
                        AI telah berhasil menyelesaikan analisis antropometri dan medis dari data yang Anda berikan. 
                        Silakan Masuk (Login) atau Daftar terlebih dahulu untuk melihat hasil lengkapnya secara gratis.
                    </p>
                    <div className="flex justify-center">
                        <LoginButton />
                    </div>
                </div>
            ) : (
            <div ref={resultContainerRef} className="space-y-8 bg-white p-8 rounded-2xl">
            
            {/* Report Header for PDF */}
            <div className="border-b-2 border-slate-800 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">{t('report.titleAntropometri')}</h1>
                  <p className="text-slate-500 mt-1">{t('report.clinicName')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{t('report.date')}: {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID')}</p>
                  <p className="text-sm text-slate-500">{t('report.name')}: {result.json_output?.patient_name || patientData.name || '-'}</p>
                  <p className="text-sm text-slate-500">{t('report.id')}: {result.json_output?.patient_id || '-'}</p>
                </div>
              </div>
            </div>

            {/* Visualisasi Deteksi & Postural Spine Heatmap Overlay */}
            {mediaItems.length > 0 && (
              <div className="space-y-6">
                {mediaItems.map((item, index) => {
                  if (item.type !== 'image') return null;
                  
                  // Filter findings for this image index
                  const itemFindings = result.json_output?.findings?.filter((f: any) => {
                      const fIndex = f.image_index !== undefined ? f.image_index : 0;
                      return fIndex === index;
                  }) || [];

                  const postureData = result.json_output?.posture_analysis || {};
                  const severityScore = postureData.severity_score !== undefined 
                    ? postureData.severity_score 
                    : (result.json_output?.summary?.status === 'NORMAL' ? 1.2 : 5.5);
                  const postureCondition = postureData.condition || (result.json_output?.summary?.status === 'NORMAL' ? 'Normal Simetris' : 'Deviasi Postur');
                  const postureLocation = postureData.location || 'Thoracolumbar';

                  return (
                    <div key={item.id} className="space-y-4">
                      {/* Interactive Postural Spine Heatmap Overlay */}
                      <PosturalSpineHeatmapOverlay
                        imageUrl={item.url}
                        imageIndex={index}
                        severityScore={severityScore}
                        condition={postureCondition}
                        location={postureLocation}
                        cobbAngleEst={postureData.cobb_angle_est || `${Math.round(severityScore * 2.5)}° Cobb Angle`}
                        findings={itemFindings}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Markdown Report */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="text-emerald-600" size={20} />
                  Hasil Pemeriksaan
                </h3>
                <div className="flex gap-2 flex-wrap" data-html2canvas-ignore>
                    <button 
                      onClick={() => setIsSatuSehatModalOpen(true)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-300 transition-colors shadow-sm"
                    >
                      <ShieldCheck size={16} className="text-emerald-700" /> SATUSEHAT
                    </button>
                    <button 
                    onClick={exportJSON}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                    <FileJson size={16} /> JSON
                    </button>
                    <button 
                    id="btn-export-pdf"
                    onClick={exportPDF}
                    className="flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                    <Download size={16} /> PDF
                    </button>
                </div>
              </div>
              
              <div className="p-8 prose prose-slate max-w-none" ref={reportRef}>
                <ReactMarkdown>{result.markdown_report}</ReactMarkdown>
                
                {result.json_output?.nutrition_metrics && (
                  <div className="mt-8 not-prose">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Visualisasi Status Gizi (Z-Score)</h3>
                    <div className="h-64 w-full bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: 'IMT/U',
                              ZScore: result.json_output.nutrition_metrics.imt_z_score || 0,
                              fill: (result.json_output.nutrition_metrics.imt_z_score || 0) > 2 || (result.json_output.nutrition_metrics.imt_z_score || 0) < -2 ? '#ef4444' : '#10b981'
                            },
                            {
                              name: 'TB/U',
                              ZScore: result.json_output.nutrition_metrics.tb_u_z_score || 0,
                              fill: (result.json_output.nutrition_metrics.tb_u_z_score || 0) < -2 ? '#ef4444' : '#10b981'
                            },
                            {
                              name: 'BB/U',
                              ZScore: result.json_output.nutrition_metrics.bb_u_z_score || 0,
                              fill: (result.json_output.nutrition_metrics.bb_u_z_score || 0) < -2 ? '#ef4444' : '#10b981'
                            }
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                          <XAxis dataKey="name" />
                          <YAxis domain={[-4, 4]} ticks={[-3, -2, -1, 0, 1, 2, 3]} />
                          <Tooltip />
                          <ReferenceLine y={0} stroke="#000" />
                          <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="3 3" />
                          <ReferenceLine y={-2} stroke="#ef4444" strokeDasharray="3 3" />
                          <Bar dataKey="ZScore" radius={[4, 4, 0, 0]}>
                            {
                              [
                                {
                                  name: 'IMT/U',
                                  ZScore: result.json_output.nutrition_metrics.imt_z_score || 0,
                                },
                                {
                                  name: 'TB/U',
                                  ZScore: result.json_output.nutrition_metrics.tb_u_z_score || 0,
                                },
                                {
                                  name: 'BB/U',
                                  ZScore: result.json_output.nutrition_metrics.bb_u_z_score || 0,
                                }
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.ZScore > 2 || entry.ZScore < -2 ? '#ef4444' : '#10b981'} />
                              ))
                            }
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      *Z-Score antara -2 dan +2 umumnya dianggap Normal berdasarkan standar WHO/Kemenkes RI.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Accuracy Feedback Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200" data-html2canvas-ignore>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Apakah hasil diagnosa AI ini akurat?</h3>
              {feedbackGiven ? (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-4 rounded-xl">
                  <CheckCircle size={20} />
                  <span className="font-medium">Terima kasih atas masukan Anda! Ini membantu AI kami belajar.</span>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleFeedback(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-3 rounded-xl font-medium transition-colors border border-emerald-200"
                  >
                    <CheckCircle size={18} /> Ya, Akurat
                  </button>
                  <button 
                    onClick={() => handleFeedback(false)}
                    className="flex-1 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 py-3 rounded-xl font-medium transition-colors border border-rose-200"
                  >
                    <X size={18} /> Tidak Akurat
                  </button>
                </div>
              )}
            </div>

            {/* JSON Debug Toggle */}
            <div className="border border-slate-200 rounded-xl overflow-hidden" data-html2canvas-ignore>
              <button 
                onClick={() => setShowJson(!showJson)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-600"
              >
                <span>Lihat Data Teknis (JSON)</span>
                {showJson ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showJson && (
                <div className="p-4 bg-slate-900 text-slate-50 overflow-x-auto">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(result.json_output, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="flex gap-3 p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-100 text-sm">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p>
                Hasil ini dihasilkan oleh AI sebagai skrining awal visual & interoperabilitas data. 
                <strong> Bukan pengganti diagnosa medis definitif.</strong> 
                Data dapat disinkronkan ke Rekam Medis Elektronik Terintegrasi SATUSEHAT Kementerian Kesehatan RI.
              </p>
            </div>

          </div>
          )}
          </div>
        )}
      </main>

      {/* IoT Device Hub & SDK Modal */}
      <IoTDeviceHubModal
        isOpen={isIotModalOpen}
        onClose={() => setIsIotModalOpen(false)}
        onApplyData={handleApplyIoTData}
      />

      {/* SATUSEHAT Kemenkes RI FHIR Interoperability Modal */}
      <SatuSehatModal
        isOpen={isSatuSehatModalOpen}
        onClose={() => setIsSatuSehatModalOpen(false)}
        patientData={patientData}
        diagnosa={result?.json_output?.findings?.[0]?.medis || result?.json_output?.summary?.pesan}
        icd10={result?.json_output?.findings?.[0]?.icd10 || (result?.json_output?.summary?.status === 'NORMAL' ? 'Z00.129' : 'Z00.00')}
        postureSeverityScore={result?.json_output?.posture_analysis?.severity_score || 0}
        postureCondition={result?.json_output?.posture_analysis?.condition || 'Normal Simetris'}
      />

    </div>
  );
}
