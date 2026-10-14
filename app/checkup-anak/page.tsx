'use client';
import ScreeningWorkflow from '../../components/clinical/ScreeningWorkflow';
import { boxStyle, screeningState } from '../../src/server/analysis-state';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, FileText, Download, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Activity, X, Trash2, LayoutDashboard, FileJson, ArrowLeft, MessageSquareText, Sun, Moon, Hourglass, Wind, Shield, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import Image from 'next/image';
import { saveRecord, updateRecord, generateSecureId } from '../lib/db';
import { compressImageToGenerativePart, safeCallGeminiAnalyze } from '../lib/imageUtils';
import { useLanguage } from '../../components/LanguageProvider';
import LoginButton from '../../components/LoginButton';
import { useAuth } from '../../components/AuthProvider';
import { motion } from 'motion/react';

const SYSTEM_INSTRUCTION = `
1. VALIDASI GAMBAR (LANGKAH PERTAMA & KRUSIAL)
- Sebelum melakukan analisa penyakit, Anda WAJIB memindai gambar untuk memastikan gambar tersebut adalah FOTO GIGI, MULUT, atau RONGGA MULUT ANAK.
- Jika gambar BUKAN gigi/mulut (misal: wajah utuh, benda mati, pemandangan, hewan, atau terlalu buram), HENTIKAN ANALISA PENYAKIT.
- Set "is_dental_image": false dalam JSON.
- Berikan pesan di summary: "Gambar tidak terdeteksi sebagai gigi atau mulut. Mohon unggah foto area mulut yang jelas."
- Jangan berikan diagnosa ICD-10 untuk gambar non-gigi.

2. Persona & Otoritas Kedokteran
Anda adalah dr Gigi AI Anak (Pediatric Dentist AI), sistem pakar kedokteran gigi anak digital. Anda menggabungkan standar klinis dari American Academy of Pediatric Dentistry (AAPD) dan World Health Organization (WHO) dengan teknologi AI Vision dan NLP.

3. Instruksi Tugas Utama (Analisis Vision & NLP Keluhan Anak)
HANYA JIKA GAMBAR VALID (Gigi/Mulut):
- BACA DAN ANALISIS KELUHAN ORANG TUA/ANAK (NLP). Kategorikan keluhan tersebut (misal: Nyeri, Bengkak, Tumbuh Gigi, Karies Botol) dan cocokkan dengan temuan visual.
- Analisis integritas media.
- PERIKSA SELURUH GIGI DAN RONGGA MULUT yang terlihat dalam gambar secara menyeluruh satu per satu, perhatikan gigi susu (desidui) dan gigi tetap muda.
- DETEKSI SELURUH PENYAKIT GIGI DAN MULUT PADA ANAK (Mencakup klasifikasi ICD-10 K00-K14):
  1. Gangguan perkembangan & erupsi (K00) - Erupsi lambat, gigi neonatal, hipoplasia enamel, anodontia.
  2. Karies gigi (K02) - Karies botol (ECC), rampan karies, white spot, karies dentin.
  3. Penyakit jaringan keras (K03) - Atrisi karena bruxism, erosi.
  4. Penyakit pulpa & periapikal (K04) - Pulpitis reversibel/ireversibel, abses periapikal (gum boil).
  5. Gingivitis & periodontitis (K05) - Gingivitis marginalis imbas plak.
  6. Gangguan gingiva/alveolar (K06) - Eruption cyst/hematoma (pembesaran gusi saat tumbuh gigi).
  7. Anomali dentofasial (K07) - Gigitan silang (crossbite), maloklusi awal, overjet berlebih.
  8. Gangguan lain (K08) - Gigi tanggal dini (premature loss), sisa akar (radiks).
  9. Penyakit rahang, mukosa, bibir (K10-K13) - Stomatitis aphthous (sariawan), herpes labialis, trauma mukosa.
  10. Penyakit lidah (K14) - Ankyloglossia (tongue tie), geographic tongue.
  Berikan diagnosa dengan menyertakan kode referensi ICD-10 yang spesifik.
- JANGAN LEWATKAN SATU PUN BAGIAN YANG SAKIT. Jika ada banyak gigi yang bermasalah, masukkan SEMUANYA ke dalam array \`findings\`.
- Berikan penilaian berdasarkan kemiripan visual dengan database patologi oral anak dan keluhan yang diberikan.
- JIKA ADA PENYAKIT: Tentukan koordinat bounding box (kotak pembatas) area yang sakit dengan SANGAT PRESISI (margin error minimal, ketat pada area lesi). Gunakan skala 0-1000 untuk ymin, xmin, ymax, xmax.
- JIKA SEHAT: Pastikan tidak ada kotak pembatas yang dihasilkan.

4. Penanganan Kondisi Sehat (GIGI SEHAT)
- Jika TIDAK ditemukan anomali atau penyakit pada SELURUH gigi:
  - Nyatakan dengan jelas bahwa kondisi gigi "Tidak tampak temuan visual; perlu pemeriksaan dokter" dan "Tidak ditemukan sakit pada seluruh gambar".
  - WAJIB tetap memberikan rekomendasi untuk melakukan pemeriksaan rutin (check-up) ke dokter gigi anak setiap 6 bulan sekali dan edukasi sikat gigi.

5. Referensi ICD-10 Lengkap untuk Kedokteran Gigi Anak
Gunakan kode-kode berikut untuk semua diagnosa (jika ada penyakit):
- K00.6 Retained primary teeth (Persistensi gigi susu)
- K02.0 Caries (Enamel)
- K02.1 Caries (Dentine) - Early Childhood Caries (ECC)
- K04.0 Pulpitis
- K04.1 Necrosis of Pulp
- K04.4 Apical Periodontitis
- K04.7 Periapical Abscess
- K05.0 Acute Gingivitis
- K12.0 Oral Aphthae (Sariawan)
- Z01.2 Dental Examination (Untuk kondisi sehat)

6. Protokol Output Ganda (MANDATORY)
Setiap akhir analisis, Anda HARUS menghasilkan dua blok output dalam format JSON tunggal.
Format JSON yang WAJIB diikuti:
{
  "json_output": {
    "status": "success",
    "is_dental_image": true, 
    "patient_id": "auto-gen",
    "patient_name": "...",
    "patient_age": "...",
    "timestamp": "ISO-8601",
    "analysis_type": "MCU_VISION_PEDIATRIC_NLP",
    "symptoms_analysis": {
        "category": "...",
        "interpretation": "..."
    },
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
    "summary": {
        "status": "SEHAT" | "SAKIT" | "INVALID",
        "pesan": "..."
    },
    "urgency_level": "NORMAL | PERLU_TINDAKAN | DARURAT",
    "action_required": ["Edukasi Sikat Gigi", "Aplikasi Fluoride", "Tambal", "Cabut Gigi Susu", "Check-up Rutin"],
    "is_emergency": false
  },
  "markdown_report": "### 👤 Data Pasien Anak\n- **Nama:** ...\n- **Umur:** ... Tahun\n\n### 🗣️ Analisis Keluhan (NLP)\n- **Keluhan Orang Tua/Anak:** [Keluhan asli]\n- **Kategori & Interpretasi:** [Hasil analisis NLP AI]\n\n### 📋 Informasi Penyakit (Visual)\n- **Kondisi Terdeteksi:** [Sebutkan semua temuan atau \"Tidak tampak temuan visual; perlu pemeriksaan dokter\"]\n- **Kode ICD-10:** [List Kode ICD-10]\n- **Tingkat Keyakinan AI:** [X]%\n\n### 🔍 Penjelasan Untuk Orang Tua\n[Berikan penjelasan detil untuk setiap temuan dengan bahasa yang ramah anak dan mudah dipahami orang tua. Jika sehat, jelaskan bahwa tidak terlihat masalah visual namun tetap perlu dijaga].\n\n### 💡 Rekomendasi Dokter Gigi Anak\n- **Apa yang harus diperiksa:** [Misal: Pemeriksaan rutin ke dokter gigi anak]\n- **Kemungkinan Tindakan:** [Misal: Aplikasi Fluoride, Fissure Sealant, atau Tambal]\n- **Instruksi Mandiri di Rumah:** [Misal: Orang tua membantu sikat gigi 2x sehari, kurangi susu botol saat tidur, kurangi makanan manis]\n\n---\n*Disclaimer: Hasil ini dihasilkan oleh AI dan bertujuan sebagai skrining awal. Diagnosa final hanya dapat ditegakkan oleh Dokter Gigi melalui pemeriksaan fisik langsung.*"
}

Catatan untuk lokasi_sakit:
- Jika sehat atau invalid, kosongkan array findings atau isi lokasi_sakit dengan 0.
- Jika ada penyakit, isi dengan koordinat area sakit (skala 0-1000).
- "image_index" WAJIB diisi integer (0, 1, 2...) sesuai urutan gambar yang dianalisis.
`;

type MediaItem = {
  id: string;
  type: 'image';
  url: string;
  file?: File;
  mimeType: string;
};

export default function CheckupAnakPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaItemsRef = useRef<MediaItem[]>([]);
  useEffect(() => { mediaItemsRef.current = mediaItems; }, [mediaItems]);
  useEffect(() => () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaItemsRef.current.forEach(item => { if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url); });
  }, []);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const reportRef = useRef<HTMLDivElement>(null);
  const resultContainerRef = useRef<HTMLDivElement>(null);

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
    setSavedRecordId(null);
    setFeedbackGiven(null);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode } 
      });
      if (videoRef.current) {
        mediaStreamRef.current = stream;
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:");
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
          mediaStreamRef.current = stream;
        videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error switching camera:");
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
    setMediaItems(prev => {
      const item = prev.find(item => item.id === id);
      if (item?.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
      return prev.filter(item => item.id !== id);
    });
  };

  const fileToGenerativePart = async (item: MediaItem): Promise<{ data: string; mimeType: string }> => {
    return compressImageToGenerativePart(item.file || item.url, 1000, 0.80);
  };

  const saveToHistory = async (data: any, image: string) => {
    try {
      // Handle backward compatibility or new structure
      const diagnosa = data.json_output.findings && data.json_output.findings.length > 0 
        ? data.json_output.findings.map((f: any) => f.medis).join(', ')
        : (data.json_output.summary?.status === 'SEHAT' ? 'Tidak tampak temuan visual; perlu pemeriksaan dokter' : 'Tidak Terdeteksi');

      const icd10 = data.json_output.findings && data.json_output.findings.length > 0
        ? data.json_output.findings.map((f: any) => f.icd10).filter(Boolean).join(', ')
        : (data.json_output.summary?.status === 'SEHAT' ? 'Z01.2' : '-');

      const newRecord = {
        id: generateSecureId('rec'),
        timestamp: new Date().toISOString(),
        patient_id: data.json_output.patient_id || 'anak_pasien',
        type: 'Dental Check-up Anak',
        diagnosa: diagnosa,
        icd10: icd10 || 'Z01.2',
        confidence: 'Belum tervalidasi',
        image_url: image, // Save the first image as thumbnail/reference
        json_output: data.json_output,
        markdown_report: data.markdown_report
      };
      const id = await saveRecord(newRecord);
      setSavedRecordId(id);
    } catch (e) {
      setSavedRecordId(null);
      setAnalysisError('Hasil belum tersimpan. Periksa akun dan koneksi, lalu coba lagi.');
    }
  };

  const analyzeMedia = async () => {
    if (mediaItems.length === 0) return;

    setLoading(true);
    setAnalysisError(null);
    setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
    setLoadingStep('Mengompresi dan mengoptimalkan gambar...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const prompt = `Lakukan VALIDASI GAMBAR terlebih dahulu. Apakah ini gambar gigi/mulut anak? Jika TIDAK, set 'is_dental_image': false dan hentikan analisis. Jika YA, lanjutkan analisis SEMUA foto. Untuk setiap temuan, WAJIB sertakan 'image_index' (integer, mulai dari 0). Deteksi penyakit atau gigi sehat dengan bounding box presisi.
      
Data Pasien Anak:
- Nama: ${patientName || 'Tidak diisi'}
- Umur: ${patientAge ? patientAge + ' Tahun' : 'Tidak diisi'}

Keluhan Orang Tua/Anak (NLP):
"${symptoms || 'Tidak ada keluhan yang diisi'}"

IMPORTANT: Output all text, explanations, and markdown reports in ${language === 'en' ? 'English' : 'Indonesian'}.
`;
      
      const mediaParts = await Promise.all(mediaItems.map(fileToGenerativePart));

      setLoadingStep('Menganalisis gigi anak dengan Agnes AI...');

      const responseText = await safeCallGeminiAnalyze({
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt,
        images: mediaParts
      }, controller.signal);

      setLoadingStep('Menyusun rekam medis digital...');


      if (!responseText) {
        throw new Error("AI tidak mengembalikan hasil analisis.");
      }

      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
      }

      try {
        const parsedResult = JSON.parse(cleaned.trim());
        setResult(parsedResult);
        // Save to RME Dashboard
        if (mediaItems.length > 0) {
          await saveToHistory(parsedResult, mediaItems[0].url);
        }
      } catch (e) {
        console.error("Failed to parse JSON:");
        setResult({
          markdown_report: responseText || "Error: Format respon tidak dapat dibaca",
          json_output: { status: "error", message: "Gagal mengurai format JSON terstruktur" }
        });
      }

    } catch (error: any) {
      console.error("Analysis failed:");
      
      let errorMessage = "Terjadi kesalahan saat menganalisis media. Silakan coba lagi.";
      
      if (error.name === 'AbortError') {
        errorMessage = "Waktu analisis melebihi batas (timeout 60 detik). Mohon periksa koneksi internet dan coba lagi.";
      } else if (error.message?.includes("The string did not match the expected pattern")) {
        errorMessage = "Format data gambar tidak sesuai atau ukuran berkas terlalu besar. Mohon pilih foto ulang dengan resolusi standar.";
      } else if (error.message?.includes("503") || error.message?.toLowerCase().includes("high demand") || error.message?.toLowerCase().includes("sibuk")) {
        errorMessage = "Server AI sedang sibuk. Silakan klik tombol Analisis Sekarang lagi untuk mencoba ulang.";
      } else if (error.message?.includes("429") || error.message?.toLowerCase().includes("rate limit")) {
        errorMessage = "Batas penggunaan API (Rate Limit) terlampaui. Mohon tunggu 30 detik sebelum mencoba lagi.";
      } else if (error.message?.includes("API Key")) {
        errorMessage = "API Key tidak valid atau tidak ditemukan. Hubungi administrator.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setAnalysisError(errorMessage);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleFeedback = async (isAccurate: boolean) => {
    if (!savedRecordId) { setAnalysisError('hasil belum tersimpan. Coba simpan kembali.'); return; }
    try {
      await updateRecord(savedRecordId, { is_accurate: isAccurate });
      setFeedbackGiven(isAccurate ? 'yes' : 'no');
    } catch { setAnalysisError('Umpan balik gagal disimpan. Silakan coba lagi.'); }
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
            if (item.type === 'image') {
                pdf.addPage();
                
                // Add Title for the Image Page
                pdf.setFontSize(14);
                pdf.setTextColor(0);
                pdf.text(`${t('report.attachment')} ${i + 1}`, 10, 15);
                
                // Load image to get dimensions
                const img = document.createElement('img');
                img.src = item.url;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

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

                // Create a temporary canvas to draw the image (to bypass potential tainting issues with direct addImage if any)
                // Although addImage supports HTMLImageElement, sometimes drawing to canvas first is safer for compression
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
        }
      }

      // Add page numbers and footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(`${t('report.page')} ${i} ${t('report.from')} ${totalPages} | ${t('report.id')}: ${result.json_output?.patient_id || '-'} | ${new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID')}`, 10, pdfHeight - 10);
        pdf.text(t('report.footer'), pdfWidth - 10, pdfHeight - 10, { align: 'right' });
      }

      pdf.setProperties({
        title: `${t('report.titleAnak')} - ${new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID')}`,
        subject: t('report.subject'),
        author: 'dr Gigi AI System',
        creator: 'Stefen Laksana'
      });

      pdf.save(`Laporan-dr-Gigi-AI-Anak-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF:");
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
    link.download = `${language === 'en' ? 'Medical-Data-Child' : 'Data-Medis-Anak'}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // Helper to calculate box style
  const getBoxStyle = boxStyle;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <div role="status" className="bg-amber-50 border border-amber-300 p-4 m-4 rounded-xl text-amber-900">Analisis foto klinis dinonaktifkan (REQUIRES_REVIEW). Belum tersedia validasi klinis. Foto tidak memastikan kesehatan gigi; lakukan pemeriksaan dokter.</div>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors">
                <span className="font-bold">← {t('common.backToHome')}</span>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-800">{t('checkupAnak.title')}</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                Skrining terstruktur
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium">
                  <LayoutDashboard size={18} />
                  <span className="hidden sm:inline">{t('common.viewDashboard')}</span>
              </Link>
              <div className="hidden sm:block"><LoginButton /></div>
            </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <ScreeningWorkflow context="PEDIATRIC" />
        <details className="rounded-xl border bg-white p-4"><summary className="font-semibold cursor-pointer">Alat foto dan edukasi tambahan — analisis AI belum tersedia</summary>
        {/* Patient Data & NLP Symptoms Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-slate-800">{language === 'en' ? 'Child Data & Complaints' : 'Data & Keluhan Anak'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{language === 'en' ? 'Child Name' : 'Nama Anak'}</label>
              <input 
                type="text" 
                placeholder={language === 'en' ? 'Enter child name' : 'Masukkan nama anak'}
                className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all min-h-[44px] sm:min-h-0" 
                value={patientName} 
                onChange={e => setPatientName(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{language === 'en' ? 'Age (Years)' : 'Umur (Tahun)'}</label>
              <input 
                type="number" 
                min="0"
                placeholder={language === 'en' ? 'Enter child age' : 'Masukkan umur anak'}
                className="w-full p-3 sm:p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all min-h-[44px] sm:min-h-0" 
                value={patientAge} 
                onChange={e => {
                    const val = e.target.value;
                    if (val === '' || (parseInt(val) >= 0)) {
                        setPatientAge(val);
                    }
                }} 
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{language === 'en' ? 'Complaints (Tell us in your own words)' : 'Keluhan (Ceritakan dengan bahasa Anda sendiri)'}</label>
            <textarea 
              rows={3}
              placeholder={language === 'en' ? 'Example: Doc, my child cries when eating sweets, and the front teeth look black...' : 'Contoh: Dok, anak saya rewel terus kalau makan yang manis-manis...'}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none min-h-[88px]" 
              value={symptoms} 
              onChange={e => setSymptoms(e.target.value)} 
            />
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-slate-800">{language === 'en' ? 'Take Child Dental Photo' : 'Ambil Foto Gigi Anak'}</h2>
          <p className="text-slate-600 mb-6 text-sm">
            {language === 'en' ? 'You can upload multiple photos for a more accurate analysis.' : 'Anda dapat mengunggah beberapa foto gigi anak untuk analisis yang lebih akurat.'}
          </p>

          {/* Camera Viewfinder */}
          {isCameraOpen && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-6">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover " />
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
                <span className="font-medium text-slate-700">Upload File</span>
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

          {/* Media Preview Carousel */}
          {mediaItems.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Media Terpilih ({mediaItems.length})</h3>
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {mediaItems.map((item) => (
                  <div key={item.id} className="relative flex-none w-32 h-32 sm:w-40 sm:h-40 snap-center rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                    <Image src={item.url} alt="Preview" fill className="object-cover " />
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

              {/* Error Message Banner */}
              {analysisError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-semibold text-red-800">Gagal Memproses Pemeriksaan</p>
                      <p className="mt-0.5 text-xs text-red-700">{analysisError}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAnalysisError(null)} 
                    className="text-red-400 hover:text-red-600 shrink-0 p-1"
                    title="Tutup"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <button
                onClick={analyzeMedia}
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} /> 
                    <span>{loadingStep || 'Menganalisis Gigi Anak...'}</span>
                  </>
                ) : (
                  <>
                    <Activity size={20} /> 
                    <span>Analisis Sekarang</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!user && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border border-emerald-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-emerald-950 shadow-sm" data-html2canvas-ignore>
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
                    ✓
                  </div>
                  <div>
                    <p className="font-bold text-sm text-emerald-900">Analisis Gigi Anak Selesai (Mode Tamu)</p>
                    <p className="text-xs text-slate-600 mt-0.5">Hasil telah disimpan aman di perangkat. Masuk akun dengan Google untuk sinkronisasi Rekam Medis (RME) Cloud dan cetak PDF rekam gigi anak.</p>
                  </div>
                </div>
                <LoginButton />
              </div>
            )}

            <div ref={resultContainerRef} className="space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            
            {/* Emergency Red Flag Alert */}
            {(result.json_output?.is_emergency || result.json_output?.urgency_level === 'DARURAT') && (
              <div className="bg-red-50 border-2 border-red-500 text-red-900 rounded-2xl p-5 flex items-start gap-4 shadow-sm" data-html2canvas-ignore>
                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={26} />
                <div>
                  <h4 className="font-bold text-base text-red-800">PERINGATAN TRIASE GAWAT DARURAT GIGI ANAK</h4>
                  <p className="text-xs sm:text-sm text-red-700 mt-1 leading-relaxed">
                    Terdeteksi tanda klinis kegawatdaruratan pada anak (seperti abses/pembengkakan gusi parah, nyeri hebat, atau trauma dentoalveolar). 
                    <strong> Segera bawa anak ke Dokter Gigi Spesialis Kedokteran Gigi Anak (Sp.KGA) atau IGD Rumah Sakit terdekat!</strong>
                  </p>
                </div>
              </div>
            )}
            
            {/* Report Header for PDF */}
            <div className="border-b-2 border-slate-800 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">{t('report.titleAnak')}</h1>
                  <p className="text-slate-500 mt-1">{t('report.clinicName')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{t('report.date')}: {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID')}</p>
                  <p className="text-sm text-slate-500">{t('report.name')}: {result.json_output?.patient_name || patientName || '-'}</p>
                  <p className="text-sm text-slate-500">{t('report.age')}: {result.json_output?.patient_age || patientAge ? `${result.json_output?.patient_age || patientAge} ${t('report.years')}` : '-'}</p>
                  <p className="text-sm text-slate-500">{t('report.id')}: {result.json_output?.patient_id || '-'}</p>
                </div>
              </div>
            </div>

            {/* Visualisasi Deteksi (Bounding Box) */}
            {mediaItems.length > 0 && (
              <div className="space-y-6">
                {mediaItems.map((item, index) => {
                  if (item.type !== 'image') return null;
                  
                  // Filter findings for this image index
                  const itemFindings = result.json_output?.findings?.filter((f: any) => {
                      const fIndex = f.image_index;
                      return fIndex === index;
                  }) || [];

                  // Only show healthy overlay if NO findings for this image AND the overall summary says healthy OR if we are sure this specific image is healthy.
                  // Missing or invalid output must never imply health.
                  const isHealthy = screeningState(result?.json_output) === 'NO_VISIBLE_FINDINGS' && itemFindings.length === 0;

                  return (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Activity className="text-red-500" size={20} />
                            {language === 'en' ? 'Detection Visualization' : 'Visualisasi Deteksi'} ({language === 'en' ? 'Image' : 'Gambar'} {index + 1})
                        </h3>
                        <div className="relative rounded-lg overflow-hidden bg-black w-full max-w-md mx-auto">
                            <Image 
                              src={item.url} 
                              alt={'Analyzed ' + (index + 1)} 
                              width={0}
                              height={0}
                              sizes="100vw"
                              style={{ width: '100%', height: 'auto' }}
                              className="block"
                              unoptimized
                            />
                            
                            {/* Render Multiple Bounding Boxes */}
                            {itemFindings.map((finding: any, fIdx: number) => {
                                const style = getBoxStyle(finding.lokasi_sakit);
                                if (!style) return null;
                                return (
                                    <div 
                                        key={fIdx}
                                        className="absolute border-2 border-red-500 shadow-[0_0_5px_rgba(255,0,0,0.5)]"
                                        style={style}
                                    >
                                        <span className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10">
                                            {finding.medis}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Healthy State Overlay */}
                            {isHealthy && (
                                <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 pointer-events-none">
                                    <div className="bg-emerald-600 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2">
                                        <CheckCircle size={20} /> Gigi Tampak Sehat
                                    </div>
                                </div>
                            )}
                        </div>
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
                <div className="flex gap-2" data-html2canvas-ignore>
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
                Hasil ini dihasilkan oleh AI sebagai skrining awal. 
                <strong> Bukan pengganti diagnosa medis profesional.</strong> 
                Segera hubungi dokter gigi anak untuk pemeriksaan lebih lanjut.
              </p>
            </div>

            {/* Link to Consultation */}
            <div className="flex justify-center mt-8" data-html2canvas-ignore>
              <Link 
                href="/consultation" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all hover:-translate-y-1"
              >
                <MessageSquareText size={20} />
                Konsultasikan Hasil Ini dengan dr Gigi AI
              </Link>
            </div>

            </div>

          </div>
        )}

        {/* Edukasi Perawatan Gigi */}
        <div className="mt-12 bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
          <div className="bg-emerald-50 p-6 border-b border-emerald-100">
            <h2 className="text-2xl font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle className="text-emerald-600" />
              Edukasi Perawatan Gigi Anak
            </h2>
            <p className="text-emerald-700 mt-2">
              Menjaga kesehatan gigi anak sejak dini sangat penting untuk pertumbuhan dan perkembangan mereka.
            </p>
          </div>
          
          <div className="p-6 md:p-8 space-y-8">
            {/* Cara Menyikat Gigi - Recreated from Image */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Card 1 */}
                <div className="bg-sky-100 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group border border-sky-200">
                  <div className="w-16 h-16 mb-4 relative z-10 flex items-center justify-center">
                    <span className="text-5xl drop-shadow-sm group-hover:scale-110 transition-transform">🪥</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight uppercase font-sans">SIKAT TEPAT:</h4>
                  <p className="text-slate-700 font-medium">Lembut & Kecil</p>
                  <div className="mt-8 pt-4 relative z-10">
                    <div className="bg-emerald-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold mx-auto mb-1">
                      <CheckCircle size={20} className="text-white" />
                    </div>
                    <span className="text-emerald-700 font-bold text-sm">OK</span>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="bg-[#b3d4e6] rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group border border-[#9ac2d9]">
                  <div className="flex gap-2 h-16 w-full items-end justify-center mb-4 relative z-10">
                    <div className="flex flex-col items-center mb-0">
                       <span className="text-3xl drop-shadow-sm">🪥</span>
                       <span className="text-[10px] font-bold text-slate-700 -mt-1">&lt;3thn</span>
                    </div>
                    <div className="flex flex-col items-center mb-3 group-hover:-translate-y-1 transition-transform">
                       <span className="text-4xl drop-shadow-sm">🪥</span>
                       <span className="text-[10px] font-bold text-slate-700 -mt-2">3-6thn</span>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight uppercase font-sans">PASTA GIGI:</h4>
                  <p className="text-slate-700 font-medium leading-tight">Porsi Sesuai Usia</p>
                  <div className="mt-auto pt-4 relative z-10">
                    <div className="bg-emerald-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold mx-auto mb-1">
                      <CheckCircle size={20} className="text-white" />
                    </div>
                    <span className="text-emerald-700 font-bold text-sm">OK</span>
                  </div>
                </div>
                
                {/* Card 3 */}
                <div className="bg-emerald-100 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group border border-emerald-200">
                  <div className="h-16 w-full flex items-center justify-center mb-4 relative z-10">
                    <div className="relative group-hover:rotate-12 transition-transform">
                      <span className="text-5xl drop-shadow-sm">🦷</span>
                      <RefreshCw className="absolute -top-1 -right-4 text-emerald-600/80 animate-[spin_4s_linear_infinite]" size={28} />
                      <span className="absolute bottom-0 -left-1 text-3xl drop-shadow-sm rotate-[-20deg]">🪥</span>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight uppercase font-sans">TEKNIK BENAR:</h4>
                  <p className="text-slate-700 font-medium leading-tight">Gerakan Memutar</p>
                  <div className="mt-8 pt-4 relative z-10">
                    <div className="bg-emerald-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold mx-auto mb-1">
                      <CheckCircle size={20} className="text-white" />
                    </div>
                    <span className="text-emerald-700 font-bold text-sm">OK</span>
                  </div>
                </div>

                {/* Card 4 */}
                <div className="bg-amber-100/80 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group border border-amber-200/80">
                  <div className="h-16 w-full flex flex-col items-center justify-center mb-4 relative z-10">
                    <div className="flex gap-4">
                      <Sun className="text-amber-500 group-hover:rotate-45 transition-transform drop-shadow" size={32} fill="currentColor" />
                      <Moon className="text-blue-700 group-hover:-rotate-12 transition-transform drop-shadow" size={28} fill="currentColor" />
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-amber-900 font-bold bg-amber-200/50 px-2 rounded-full text-sm">
                       <Hourglass size={14} className="text-amber-700"/> 2 min
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight uppercase font-sans mt-2">RUTINITAS:</h4>
                  <p className="text-slate-700 font-medium leading-tight">2x Hari,<br/>2 Menit</p>
                  <div className="mt-auto pt-4 relative z-10">
                    <div className="bg-emerald-500 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold mx-auto mb-1">
                      <CheckCircle size={20} className="text-white" />
                    </div>
                    <span className="text-emerald-700 font-bold text-sm">OK</span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* TANDA GIGI SEHAT - Recreated from Image */}
            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 md:p-8 border-slate-100 flex items-center px-10">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 uppercase tracking-tight">TANDA GIGI SEHAT</h2>
              </div>
              <div className="bg-[#e2f1f0] p-6 md:p-10 relative overflow-hidden rounded-b-[2rem]">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
                  {/* Boy Illustration */}
                  <div className="flex-1 flex justify-center relative -ml-16">
                    <motion.div 
                      animate={{ y: [-5, 5, -5] }}
                      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                      className="text-[14rem] md:text-[20rem] relative z-10 leading-[0.8] drop-shadow-2xl"
                    >
                      👦🏻
                    </motion.div>
                    <motion.div 
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="text-[2.5rem] absolute top-[40%] text-center left-1/2 -ml-[20px] shadow-sm bg-white/40 h-8 w-24 rounded-[100%] blur-sm z-20 pointer-events-none"
                    >
                    </motion.div>
                  </div>
                  
                  {/* Features List */}
                  <div className="flex-1 space-y-4 md:space-y-6 md:pl-20 z-30">
                    <div className="flex items-center gap-4 bg-[#e2f1f0] hover:scale-[1.02] transition-transform">
                      <div className="bg-white w-[70px] h-[70px] rounded-full flex items-center justify-center text-4xl shrink-0 shadow-sm border border-white/50 relative">
                         🦷<Sparkles className="absolute top-2 right-2 text-slate-300" size={16} fill="currentColor" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[1.4rem] text-slate-800 font-sans leading-tight">Gigi Putih<br/>Alami</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-[#e2f1f0] hover:scale-[1.02] transition-transform">
                      <div className="bg-[#fcd0ce] w-[70px] h-[70px] rounded-full flex items-center justify-center text-4xl shrink-0 shadow-sm border border-white/50 relative overflow-hidden">
                         <span className="text-[2.5rem] mt-1 drop-shadow-sm">👄</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-[1.4rem] text-slate-800 font-sans leading-tight">Gusi Merah<br/>Muda</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-[#e2f1f0] hover:scale-[1.02] transition-transform">
                      <div className="bg-[#d1ebd7] w-[70px] h-[70px] rounded-full flex items-center justify-center text-emerald-500 shrink-0 shadow-sm border border-white/50">
                         <Wind size={36} className="text-emerald-700" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[1.4rem] text-slate-800 font-sans leading-tight">Nafas<br/>Segar</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-[#e2f1f0] hover:scale-[1.02] transition-transform">
                      <div className="bg-white w-[70px] h-[70px] rounded-full flex items-center justify-center text-4xl shrink-0 relative overflow-hidden shadow-sm border border-white/50">
                         🦷<span className="absolute top-3 right-2 text-slate-800 font-bold text-xs" style={{transform:"rotate(15deg)"}}>🦠<div className="absolute top-1 left-0 w-full h-[2px] bg-red-500 rounded -rotate-45" /></span>
                      </div>
                      <div>
                        <h4 className="font-bold text-[1.4rem] text-slate-800 font-sans leading-tight">Tanpa<br/>Lubang</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </details>
      </main>
    </div>
  );
}
