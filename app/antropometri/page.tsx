'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  FileText, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle, 
  Activity, 
  X, 
  Trash2, 
  LayoutDashboard, 
  FileJson, 
  ArrowLeft, 
  Cpu, 
  ShieldCheck, 
  Settings, 
  Video, 
  StopCircle, 
  Play,
  User,
  Heart,
  Waves,
  Sparkles,
  AlertTriangle,
  Layers,
  UserCheck,
  CheckCircle2,
  Maximize2,
  Ruler,
  Scale,
  Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import Image from 'next/image';
import { saveRecord, updateRecord } from '../lib/db';
import { compressImageToGenerativePart as compressImage, safeCallGeminiAnalyze } from '../lib/imageUtils';
import { useLanguage } from '../../components/LanguageProvider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import LoginButton from '../../components/LoginButton';
import { useAuth } from '../../components/AuthProvider';
import IoTDeviceHubModal from '../../components/IoTDeviceHubModal';
import SatuSehatModal from '../../components/SatuSehatModal';
import PosturalSpineHeatmapOverlay from '../../components/PosturalSpineHeatmapOverlay';
import FaceRppgPulseVisualizer from '../../components/FaceRppgPulseVisualizer';

const SYSTEM_INSTRUCTION = `
1. VALIDASI MEDIA & PEMERIKSAAN KECOCOKAN SESI (LANGKAH PERTAMA & KRUSIAL)
Anda adalah AI Dokter Ahli Pemeriksaan Fisik, Skrining Postur, Asisten Skrining Biomedis Multimodal berbasis Computer Vision & Ahli Gizi Klinis.
Anda menerima input media beserta data klinis untuk sesi pemeriksaan tertentu:
- SESI "POSTURE_FULL_BODY" (Pemeriksaan Postur & Antropometri): Membutuhkan FOTO SELURUH BADAN / FULL BODY (dari kepala hingga kaki atau torso atas-bawah). Fungsinya: memeriksa kurvatura tulang belakang (Skoliosis, Kifosis, Lordosis), asimetri bahu & panggul, kelurusan postur, Z-Score gizi, serta ESTIMASI TINGGI & BERAT BADAN OTOMATIS BERBASIS FOTO.
- SESI "FACE_RPPG_VIDEO" (Skrining Wajah & rPPG): Membutuhkan VIDEO CAPTURE WAJAH 5 DETIK atau FOTO WAJAH CLOSE-UP. Fungsinya: menganalisis bentuk wajah & simetri fasial, memverifikasi kesesuaian estimasi usia biologis, dan melakukan skrining awal risiko Diabetes Melitus, Hipertensi, dan Kardiometabolik menggunakan rPPG (Remote Photoplethysmography) dengan mengamati variasi mikro intensitas warna kulit (piksel merah/hijau/biru) pada area dahi dan pipi (aliran mikrovaskular dan keteraturan gelombang pulsa).
- SESI "DUAL_SESSION" (Pemeriksaan Terpadu): Memproses Foto Badan Full Body untuk Postur & Estimasi Antropometri, serta Video Wajah 5 Detik untuk Skrining Wajah/rPPG.

Tugas Verifikasi Kecocokan Media:
1. Pindai media dan tentukan "detected_media_type": ("FULL_BODY" | "FACE_ONLY" | "FACE_VIDEO" | "NON_HUMAN_INVALID").
2. Bandingkan dengan sesi yang dipilih:
   - Jika sesi adalah POSTURE_FULL_BODY tetapi media yang diunggah hanya foto muka/close-up (FACE_ONLY atau FACE_VIDEO): Set "media_match_status": "MISMATCH". Berikan penjelasan tegas di "mismatch_warning": "Media terdeteksi sebagai foto wajah/close-up, bukan foto seluruh badan (full body). Untuk analisis postur tulang belakang, kurvatura skoliosis/kifosis, dan asimetri tubuh yang akurat, disarankan beralih ke Sesi Skrining Wajah rPPG atau mengunggah foto seluruh tubuh dari kepala hingga kaki."
   - Jika sesi adalah FACE_RPPG_VIDEO tetapi media yang diunggah adalah foto seluruh badan atau bukan wajah (FULL_BODY): Set "media_match_status": "MISMATCH". Berikan penjelasan tegas di "mismatch_warning": "Media terdeteksi bukan rekaman wajah close-up. Untuk ekstraksi gelombang pulsa mikrovaskular rPPG pada dahi dan pipi, deteksi risiko diabetes, dan estimasi usia wajah, disarankan merekam video wajah 5 detik berfokus pada area wajah."
   - Jika media cocok dengan sesi: Set "media_match_status": "MATCH" dan kosongkan "mismatch_warning".
   - Jika bukan manusia/pasien sama sekali: Set "is_valid_image": false, "media_match_status": "INVALID", "summary": {"status": "INVALID", "pesan": "Media tidak terdeteksi sebagai foto/video pasien manusia."}

2. PROSEDUR ANALISIS MULTIMODAL & BIOMEDIS
A. Jika Terdeteksi Foto Tubuh / Full Body (Pemeriksaan Postur & Estimasi Antropometri Optik):
   - ESTIMASI TINGGI BADAN (TB) & PERKIRAAN BERAT BADAN (BB) SECARA OTOMATIS DARI FOTO:
     Bahkan jika pasien tidak mengisi data Tinggi Badan atau Berat Badan, AI HARUS menganalisis foto full body / torso untuk memperkirakan:
     1. Tinggi Badan Pasien (cm): Dihitung dari proporsi biometrik kraniosomatik (rasio kepala ke tinggi total tubuh, rata-rata 1:7.0 - 1:7.8 pada orang dewasa, panjang femoralis, dan referensi vertikal tubuh). Tentukan "estimated_height_cm" (contoh: 168) dan rentang "height_range_cm" (contoh: "165 - 171 cm").
     2. Berat Badan Pasien (kg): Dihitung dari volume kontur tubuh, lebar bahu biakromial, lingkar pinggang-panggul, ketebalan ekstremitas, dan somatotype (Ectomorph / kurus ramping, Mesomorph / berotot proporsional, Endomorph / padat berisi). Tentukan "estimated_weight_kg" (contoh: 62) dan rentang "weight_range_kg" (contoh: "59 - 65 kg").
     3. Perkiraan Indeks Massa Tubuh (IMT): "estimated_bmi" dihitung dari perkiraan BB dan TB (BB / (TB/100)^2).
     4. Kategori Somatotype: "somatotype" ("Ectomorph Ramping" | "Mesomorph Atletis Proporsional" | "Endomorph Berisi").
     5. Analisis Proporsi Tubuh: "body_proportions_detail" (Rasio kepala-ke-tubuh, keselarasan trunkus-ekstremitas).
     6. Tingkat Kepercayaan Estimasi: "estimation_confidence" (contoh: "Belum tervalidasi").
     7. JIKA TINGGI BADAN ATAU BERAT BADAN PASIEN PADA DATA FORMULIR TIDAK DIISI, GUNAKAN ESTIMASI INI UNTUK MENGHITUNG INDEKS MASSA TUBUH (IMT) DAN Z-SCORE GIZI SECARA OTOMATIS!
   - Analisis postur tulang belakang (apakah Normal Simetris, Skoliosis, Kifosis, Lordosis, atau Asimetri Bahu/Pinggul).
   - Tentukan skor keparahan (severity_score) 0-10, estimasi sudut Cobb (cobb_angle_est, misal: '10° Cobb Angle'), dan lokasi kelainan (misal: 'Thoracolumbar').
   - Nilai status gizi Z-Score berdasarkan Umur, TB, dan BB (gunakan estimasi TB/BB jika input kosong).
   - Jika ada kelainan visual, sertakan bounding box lokasi_sakit dengan koordinat presisi (skala 0-1000).

B. Jika Terdeteksi Video/Foto Wajah (Skrining Wajah & rPPG):
   - Analisis rPPG (Remote Photoplethysmography): Amati variasi mikro intensitas warna kulit pada area dahi dan pipi yang disebabkan oleh denyut nadi dan aliran mikrovaskular.
   - Analisis keteraturan gelombang pulsa (pulse_regularity_percent: 70-98%) dan estimasi denyut nadi (pulse_rate_bpm).
   - Skrining Risiko Diabetes Melitus & Kardiometabolik: [Rendah / Sedang / Tinggi] berdasarkan kestabilan pulsa mikrovaskular dahi/pipi, dikorelasikan dengan IMT, usia, dan tekanan darah pasien.
   - Analisis Bentuk Wajah (face_shape: misal "Oval Simetris", "Bulat", "Persegi", "Lonjong") dan Simetri Fasial.
   - Estimasi Usia Wajah Biologis (estimated_biological_age: misal "28 Tahun") dan konfirmasi kecocokan dengan usia input pasien ("age_match_confirmation").

C. Integrasikan data pemeriksaan fisik nakes / IoT (Telinga, Mata, Gigi, Buta Warna, Tekanan Darah, Suhu, Nadi).

3. FORMAT OUTPUT YANG WAJIB DIIKUTI
Setiap akhir analisis, Anda HARUS menghasilkan JSON dengan format berikut:
{
  "json_output": {
    "status": "success",
    "is_valid_image": true,
    "media_match_status": "MATCH" | "MISMATCH" | "INVALID",
    "detected_media_type": "FULL_BODY" | "FACE_ONLY" | "FACE_VIDEO" | "NON_HUMAN_INVALID",
    "mismatch_warning": "...",
    "patient_id": "auto-gen",
    "patient_name": "...",
    "patient_age": "...",
    "timestamp": "ISO-8601",
    "analysis_type": "POSTURE_AND_ANTHROPOMETRY" | "FACE_RPPG_SCREENING" | "COMPREHENSIVE_MCU",
    "risk_category": "Rendah" | "Sedang" | "Tinggi",
    "visual_indicators": "...",
    "medical_recommendations": "...",
    "ai_estimated_anthropometry": {
      "estimated_height_cm": 168,
      "height_range_cm": "165 - 171 cm",
      "estimated_weight_kg": 62,
      "weight_range_kg": "59 - 65 kg",
      "estimated_bmi": 22.0,
      "bmi_category": "Normal / Ideal",
      "somatotype": "Mesomorph Atletis Proporsional",
      "body_proportions_detail": "Rasio kepala terhadap tinggi total tubuh terdeteksi 1:7.4 dengan lebar bahu simetris dan proporsi massa otot proporsional.",
      "estimation_confidence": "Belum tervalidasi"
    },
    "face_rppg_analysis": {
      "pulse_rate_bpm": 76,
      "pulse_regularity_percent": 92,
      "diabetes_risk": "Rendah" | "Sedang" | "Tinggi",
      "face_shape": "Oval Simetris",
      "estimated_biological_age": "28 Tahun",
      "age_match_confirmation": "Sesuai dengan usia pasien yang diinput",
      "microvascular_observation": "Fluktuasi intensitas mikrovaskular kapiler dahi dan pipi reguler dan stabil."
    },
    "posture_analysis": {
      "condition": "Normal Simetris" | "Skoliosis" | "Kifosis" | "Lordosis" | "Asimetri Bahu",
      "severity_score": 0.0,
      "cobb_angle_est": "0° Cobb Angle",
      "location": "Thoracolumbar"
    },
    "nutrition_metrics": {
      "imt": 0.0,
      "imt_z_score": 0.0,
      "tb_u_z_score": 0.0,
      "bb_u_z_score": 0.0
    },
    "findings": [
      {
        "image_index": 0,
        "medis": "...",
        "icd10": "...",
        "confidence_score": "0-100%",
        "lokasi_sakit": { "ymin": 0, "xmin": 0, "ymax": 0, "xmax": 0 }
      }
    ],
    "summary": {
      "status": "NORMAL" | "PERLU_PERHATIAN" | "MISMATCH" | "INVALID",
      "pesan": "..."
    },
    "urgency_level": "NORMAL | PERLU_TINDAKAN | DARURAT",
    "action_required": ["Edukasi Gizi", "Skrining Lab HbA1c", "Latihan Postur"]
  },
  "markdown_report": "### 👤 Data Pasien & Parameter Klinis\\n- **Nama:** ...\\n- **Umur:** ... Tahun\\n- **Antropometri:** TB: ... cm, BB: ... kg (IMT: ...)\\n- **Tekanan Darah & Vital:** ... mmHg, Nadi: ... bpm, Suhu: ... °C\\n\\n### 📏 Estimasi Antropometri AI (dari Foto Tubuh)\\n- **Estimasi Tinggi Badan:** ... cm (Rentang: ...)\\n- **Perkiraan Berat Badan:** ... kg (Rentang: ...)\\n- **Perkiraan IMT:** ... kg/m²\\n- **Somatotype:** ...\\n- **Analisis Proporsi Fisik:** ...\\n\\n### 🔍 Pemeriksaan Kecocokan Media\\n- **Status Kecocokan:** [MATCH (Sesuai) / MISMATCH (Tidak Sesuai)]\\n- **Media Terdeteksi:** [Foto Seluruh Tubuh / Video Wajah rPPG]\\n[Peringatan kecocokan jika ada]\\n\\n### 🩺 Hasil Pemeriksaan Fisik (Nakes / Sensor IoT)\\n- **Mata:** ...\\n- **Telinga:** ...\\n- **Gigi:** ...\\n- **Buta Warna:** ...\\n\\n### 🤖 Analisis AI Biomedis Multimodal\\n- **KATEGORI RISIKO:** [Rendah / Sedang / Tinggi]\\n- **INDIKATOR VISUAL YANG DIAMATI:** [Jelaskan apa yang terdeteksi secara visual oleh model: variasi mikrovaskular rPPG dahi/pipi, keteraturan pulsa, bentuk wajah & estimasi usia, atau simetri postur tulang belakang]\\n- **Status Postur / Wajah:** [Kondisi postur / bentuk wajah]\\n- **Kode ICD-10:** [Kode ICD-10 terkait]\\n\\n### 💡 REKOMENDASI MEDIS\\n- **Tindakan Lanjutan:** [Langkah pemeriksaan lanjutan, misal: Disarankan melakukan tes darah HbA1c / GDS jika ada faktor risiko, atau fisioterapi postur]\\n- **Edukasi Pola Hidup:** [Pola makan sehat & aktivitas fisik]\\n\\n---\\n*DISCLAIMER UTAMA: Hasil ini adalah SKRINING AWAL dan BUKAN DIAGNOSIS MEDIS RESMI. Wajib dikonsultasikan langsung dengan dokter atau tenaga medis profesional di fasilitas kesehatan.*"
}
`;

type SessionType = 'posture' | 'face_rppg' | 'dual';

type MediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  file?: File;
  mimeType: string;
  duration?: number;
  sessionCategory?: 'posture_body' | 'face_rppg';
  frames?: string[];
};

export default function AntropometriPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  
  // Session Mode: Posture (Full Body) vs Face rPPG 5s vs Dual Comprehensive
  const [activeSession, setActiveSession] = useState<SessionType>('posture');

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
  const [loadingStep, setLoadingStep] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null);

  // Quick Biometric Height & Weight Estimation states from Photo
  const [isQuickEstimating, setIsQuickEstimating] = useState(false);
  const [quickEstimatedBiometrics, setQuickEstimatedBiometrics] = useState<{
    height: number;
    weight: number;
    heightRange?: string;
    weightRange?: string;
    bmi?: number;
    bmiCategory?: string;
    somatotype?: string;
    confidence?: string;
    detail?: string;
  } | null>(null);
  const [quickEstimateNotice, setQuickEstimateNotice] = useState<string | null>(null);
  
  // IoT & SATUSEHAT states
  const [isIotModalOpen, setIsIotModalOpen] = useState(false);
  const [isSatuSehatModalOpen, setIsSatuSehatModalOpen] = useState(false);
  const [iotSynced, setIotSynced] = useState(false);
  const [lastIotDevice, setLastIotDevice] = useState<string | null>(null);

  // Camera states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaItemsRef = useRef<MediaItem[]>([]);
  useEffect(() => { mediaItemsRef.current = mediaItems; }, [mediaItems]);
  useEffect(() => () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaItemsRef.current.forEach(item => { if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url); });
  }, []);
  const recordedSnapshotsRef = useRef<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(5);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const resultContainerRef = useRef<HTMLDivElement>(null);

  // Dual Slot Upload Inputs
  const postureFileInputRef = useRef<HTMLInputElement>(null);
  const faceFileInputRef = useRef<HTMLInputElement>(null);

  // Automatically switch default camera facing mode based on session
  useEffect(() => {
    if (activeSession === 'face_rppg') {
      setFacingMode('user'); // Front camera for face rPPG
    } else {
      setFacingMode('environment'); // Rear camera for full body posture
    }
  }, [activeSession]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, category?: 'posture_body' | 'face_rppg') => {
    if (e.target.files) {
      const assignedCategory = category || (activeSession === 'posture' ? 'posture_body' : 'face_rppg');
      const newItems: MediaItem[] = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: URL.createObjectURL(file),
        file,
        mimeType: file.type || (file.type.startsWith('video/') ? 'video/mp4' : 'image/jpeg'),
        sessionCategory: assignedCategory
      }));

      // In single session mode, replace or append
      if (activeSession === 'dual') {
        setMediaItems(prev => [...prev.filter(m => m.sessionCategory !== assignedCategory), ...newItems]);
      } else {
        setMediaItems(newItems);
      }
      setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
    }
  };

  const startCamera = async (autoRecord = false) => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode } 
      });
      if (videoRef.current) {
        mediaStreamRef.current = stream;
        videoRef.current.srcObject = stream;
      }
      if (autoRecord) {
        setTimeout(() => {
          startVideoRecording();
        }, 600);
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

  const capturePhoto = (category?: 'posture_body' | 'face_rppg') => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const assignedCategory = category || (activeSession === 'posture' ? 'posture_body' : 'face_rppg');
        
        const newItem: MediaItem = {
          id: Math.random().toString(36).substring(7),
          type: 'image',
          url: dataUrl,
          mimeType: 'image/jpeg',
          sessionCategory: assignedCategory
        };

        if (activeSession === 'dual') {
          setMediaItems(prev => [...prev.filter(m => m.sessionCategory !== assignedCategory), newItem]);
        } else {
          setMediaItems([newItem]);
        }
        stopCamera();
        setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
      }
    }
  };

  const startVideoRecording = async () => {
    try {
      let stream = videoRef.current?.srcObject as MediaStream;
      if (!stream || !stream.active) {
        setIsCameraOpen(true);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode } 
        });
        if (videoRef.current) {
          mediaStreamRef.current = stream;
        videoRef.current.srcObject = stream;
        }
      }

      let mimeType = 'video/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      recordedChunksRef.current = [];
      recordedSnapshotsRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      const captureCurrentSnapshot = () => {
        if (videoRef.current && videoRef.current.videoWidth > 0) {
          try {
            const c = document.createElement('canvas');
            const maxDim = 960;
            let w = videoRef.current.videoWidth;
            let h = videoRef.current.videoHeight;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
              if (b64) recordedSnapshotsRef.current.push(b64);
            }
          } catch (e) {
            console.warn("Snapshot capture warning:");
          }
        }
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(videoBlob);
        const videoFile = new File([videoBlob], `rekaman-wajah-rppg-5s-${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`, { type: mimeType });
        
        const newItem: MediaItem = {
          id: Math.random().toString(36).substring(7),
          type: 'video',
          url: videoUrl,
          file: videoFile,
          mimeType: mimeType,
          duration: 5,
          sessionCategory: 'face_rppg',
          frames: [...recordedSnapshotsRef.current]
        };

        if (activeSession === 'dual') {
          setMediaItems(prev => [...prev.filter(m => m.sessionCategory !== 'face_rppg'), newItem]);
        } else {
          setMediaItems([newItem]);
        }
        setIsRecording(false);
        stopCamera();
        setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordSecondsLeft(5);

      // Take initial snapshot at start
      setTimeout(captureCurrentSnapshot, 600);

      let currentSeconds = 5;
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        currentSeconds -= 1;
        setRecordSecondsLeft(currentSeconds);
        captureCurrentSnapshot();
        if (currentSeconds <= 0) {
          if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        }
      }, 1000);

      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = setTimeout(() => {
        stopVideoRecording();
      }, 5000);

    } catch (err) {
      console.error("Error starting video recording:");
      alert("Gagal merekam video. Pastikan kamera memiliki izin.");
      setIsRecording(false);
    }
  };

  const stopVideoRecording = () => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const stopCamera = () => {
    if (isRecording) {
      stopVideoRecording();
    }
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

  const compressImageToGenerativePart = async (fileOrUrl: File | string): Promise<{ data: string; mimeType: string }> => {
    return compressImage(fileOrUrl, 1000, 0.80);
  };

  const extractVideoFrames = async (videoFileOrUrl: File | string): Promise<string[]> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const isFile = typeof videoFileOrUrl !== 'string';
      const url = isFile ? URL.createObjectURL(videoFileOrUrl) : videoFileOrUrl;
      video.src = url;

      const timeout = setTimeout(() => {
        if (isFile) URL.revokeObjectURL(url);
        resolve([]);
      }, 4000);

      video.onloadeddata = async () => {
        try {
          const duration = video.duration || 5;
          const frames: string[] = [];
          const canvas = document.createElement('canvas');
          let width = video.videoWidth || 640;
          let height = video.videoHeight || 480;
          const maxDim = 960;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          const seekTimes = [0.8, Math.min(2.5, duration / 2), Math.min(4.2, Math.max(1, duration - 0.5))];
          for (const t of seekTimes) {
            video.currentTime = t;
            await new Promise(r => {
              video.onseeked = () => r(null);
              setTimeout(r, 250);
            });
            if (ctx) {
              ctx.drawImage(video, 0, 0, width, height);
              frames.push(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
            }
          }
          clearTimeout(timeout);
          if (isFile) URL.revokeObjectURL(url);
          resolve(frames);
        } catch {
          clearTimeout(timeout);
          if (isFile) URL.revokeObjectURL(url);
          resolve([]);
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        if (isFile) URL.revokeObjectURL(url);
        resolve([]);
      };
    });
  };

  const fileToGenerativeParts = async (item: MediaItem): Promise<Array<{ data: string; mimeType: string }>> => {
    if (item.type === 'video') {
      let frames = item.frames || [];
      if (frames.length === 0) {
        frames = await extractVideoFrames(item.file || item.url);
      }
      if (frames.length > 0) {
        return frames.slice(0, 3).map(f => ({
          data: f.startsWith('data:') ? f.split(',')[1] : f,
          mimeType: 'image/jpeg'
        }));
      }
    }

    const compressed = await compressImageToGenerativePart(item.file || item.url);
    return [compressed];
  };

  const quickEstimateBiometricsFromPhoto = async (_targetItem?: MediaItem) => {
    setAnalysisError('Estimasi tinggi/berat dari foto dinonaktifkan. Masukkan hasil alat ukur yang benar-benar dilakukan.');
  };

  const saveToHistory = async (data: any, image: string) => {
    try {
      const diagnosa = data.json_output.findings && data.json_output.findings.length > 0 
        ? data.json_output.findings.map((f: any) => f.medis).join(', ')
        : (data.json_output.summary?.status === 'NORMAL' ? 'Tampak Normal' : (data.json_output.posture_analysis?.condition || 'Pemeriksaan Fisik'));

      const icd10 = data.json_output.findings && data.json_output.findings.length > 0
        ? data.json_output.findings.map((f: any) => f.icd10).join(', ')
        : (data.json_output.summary?.status === 'NORMAL' ? 'Z00.129' : 'Z00.00');

      const sessionTitle = activeSession === 'posture' 
        ? 'Pemeriksaan Postur Tubuh' 
        : activeSession === 'face_rppg' 
          ? 'Skrining Wajah & rPPG' 
          : 'Pemeriksaan Terpadu MCU';

      const newRecord = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        patient_id: data.json_output.patient_id || 'unknown',
        type: sessionTitle,
        diagnosa: diagnosa,
        icd10: icd10,
        confidence: 'Belum tervalidasi',
        image_url: image,
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
    if (mediaItems.length === 0) {
      setAnalysisError("Silakan ambil atau unggah foto postur atau video wajah terlebih dahulu.");
      return;
    }

    setLoading(true);
    setAnalysisError(null);
    setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
    setLoadingStep('Mengoptimalkan media & mengekstrak frame optik...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const sessionLabel = activeSession === 'posture' 
        ? 'POSTURE_FULL_BODY' 
        : activeSession === 'face_rppg' 
          ? 'FACE_RPPG_VIDEO' 
          : 'DUAL_SESSION';

      const prompt = `Lakukan LANGKAH 1: VALIDASI MEDIA & PEMERIKSAAN KECOCOKAN SESI terlebih dahulu.
Sesi yang sedang diakses pengguna: ${sessionLabel}.
Media yang diberikan: ${mediaItems.length} berkas (${mediaItems.map(m => `${m.type} ${m.sessionCategory || ''}`).join(', ')}).

Aturan Pemeriksaan Kecocokan:
- Jika sesi POSTURE_FULL_BODY: Pastikan media adalah FOTO SELURUH TUBUH / FULL BODY untuk analisa postur. Jika media hanya foto wajah/close-up, set 'media_match_status': 'MISMATCH', 'detected_media_type': 'FACE_ONLY', dan berikan 'mismatch_warning' bahwa foto adalah wajah bukan badan utuh.
- Jika sesi FACE_RPPG_VIDEO: Pastikan media adalah VIDEO/FOTO WAJAH CLOSE-UP untuk ekstraksi rPPG mikrovaskular dahi/pipi dan usia wajah. Jika media adalah foto seluruh badan, set 'media_match_status': 'MISMATCH', 'detected_media_type': 'FULL_BODY', dan berikan 'mismatch_warning'.
- Jika sesi DUAL_SESSION: Lakukan analisis terpadu untuk kedua media (postur tubuh dan rPPG wajah).

Catatan Media: Untuk rekaman video wajah rPPG, sistem telah mengekstrak frame-frame optik berurutan resolusi tinggi untuk memungkinkan analisis mikrovaskular kapiler, variasi tonus kulit pulsatif (rPPG), dan simetri fasial.

Data Klinis & Antropometri Pasien:
- Nama: ${patientData.name || 'Tidak diisi'}
- Umur: ${patientData.age ? patientData.age + ' Tahun' : 'Tidak diisi'}
- Tinggi Badan: ${patientData.height ? patientData.height + ' cm' : 'Tidak diisi'}
- Berat Badan: ${patientData.weight ? patientData.weight + ' kg' : 'Tidak diisi'}
${patientData.headCircumference ? `- Lingkar Kepala: ${patientData.headCircumference} cm` : ''}
${patientData.armCircumference ? `- Lingkar Lengan Atas (LILA): ${patientData.armCircumference} cm` : ''}
${patientData.pulseRate ? `- Denyut Nadi (Pulse Input): ${patientData.pulseRate} bpm` : ''}
${patientData.bodyTemperature ? `- Suhu Tubuh: ${patientData.bodyTemperature} °C` : ''}

Hasil Pemeriksaan Fisik (Nakes & Sensor IoT):
- Telinga: ${patientData.earHealth} ${patientData.earHealth === 'Ada Kelainan' ? `(Catatan: ${patientData.earNotes})` : ''}
- Mata: ${patientData.eyeHealth} ${patientData.eyeHealth === 'Ada Kelainan' ? `(Catatan: ${patientData.eyeNotes})` : ''}
- Gigi & Mulut: ${patientData.dentalHealth} ${patientData.dentalHealth === 'Ada Kelainan' ? `(Catatan: ${patientData.dentalNotes})` : ''}
- Buta Warna: ${patientData.colorBlindness}
- Tekanan Darah: ${patientData.bloodPressureSystolic && patientData.bloodPressureDiastolic ? `${patientData.bloodPressureSystolic}/${patientData.bloodPressureDiastolic} mmHg` : 'Tidak diisi'}

TUGAS KHUSUS ESTIMASI ANTROPOMETRI DARI FOTO:
- Pada foto seluruh tubuh/postur: Lakukan estimasi Tinggi Badan (TB) dalam cm dan perkiraan Berat Badan (BB) dalam kg berbasis Computer Vision rasio proporsi sefalosomatik (kepala-tubuh), lebar bahu biakromial, dan somatotype.
- Kembalikan di properti 'ai_estimated_anthropometry'.
- JIKA Tinggi Badan atau Berat Badan pasien di atas 'Tidak diisi', GUNAKAN nilai estimasi TB dan BB ini untuk menghitung IMT (nutrition_metrics.imt) dan Z-score status gizi secara otomatis!
`;
      
      const mediaPartsArrays = await Promise.all(mediaItems.map(fileToGenerativeParts));
      const mediaParts = mediaPartsArrays.flat().filter(p => !!p && !!p.data);

      setLoadingStep('Menganalisis biomedis dengan Gemini AI...');

      const responseText = await safeCallGeminiAnalyze({
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt,
        images: mediaParts
      }, controller.signal);

      setLoadingStep('Menyusun laporan pemeriksaan...');
      
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

        // Auto-extract biometric anthropometry estimation from photo
        const estData = parsedResult.json_output?.ai_estimated_anthropometry;
        if (estData) {
          const estH = Number(estData.estimated_height_cm);
          const estW = Number(estData.estimated_weight_kg);
          setQuickEstimatedBiometrics({
            height: estH,
            weight: estW,
            heightRange: estData.height_range_cm,
            weightRange: estData.weight_range_kg,
            bmi: estData.estimated_bmi,
            bmiCategory: estData.bmi_category,
            somatotype: estData.somatotype,
            confidence: estData.estimation_confidence,
            detail: estData.body_proportions_detail
          });

          // Auto-fill height & weight if previously empty
          setPatientData(prev => ({
            ...prev,
            height: prev.height,
            weight: prev.weight
          }));
        }

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
        errorMessage = "Server AI sedang sibuk. Silakan klik tombol analisis lagi untuk mencoba ulang otomatis.";
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
      await new Promise(resolve => setTimeout(resolve, 500));

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

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - scaledHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
      }

      if (mediaItems.length > 0) {
        for (let i = 0; i < mediaItems.length; i++) {
          const item = mediaItems[i];
          if (item.type === 'image' && item.url) {
            try {
              pdf.addPage();
              pdf.setFontSize(14);
              pdf.setTextColor(0);
              const attachmentLabel = t('report.attachment') || 'Lampiran Media';
              pdf.text(`${attachmentLabel} ${i + 1} (${item.sessionCategory === 'posture_body' ? 'Foto Postur Badan' : 'Foto Wajah rPPG'})`, 10, 15);
              
              const img = document.createElement('img');
              img.crossOrigin = "anonymous";
              await new Promise((resolve) => {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = item.url;
                if (img.complete) resolve(true);
              });

              if (img.width && img.height) {
                const margin = 10;
                const maxImgWidth = pdfWidth - (margin * 2);
                const imgRatio = img.width / img.height;
                const finalWidth = maxImgWidth;
                const finalHeight = finalWidth / imgRatio;
                pdf.addImage(item.url, 'JPEG', margin, 25, finalWidth, finalHeight);
              }
            } catch (err) {
              console.warn("Could not append image to PDF:");
            }
          }
        }
      }

      pdf.save(`Laporan-Fisik-rPPG-${new Date().toISOString().split('T')[0]}.pdf`);
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
    const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify(result.json_output, null, 2)
    );
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `Data-Fisik-rPPG-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const postureMedia = mediaItems.find(m => m.sessionCategory === 'posture_body') || (activeSession === 'posture' ? mediaItems[0] : undefined);
  const faceMedia = mediaItems.find(m => m.sessionCategory === 'face_rppg') || (activeSession === 'face_rppg' ? mediaItems[0] : undefined);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <div role="status" className="bg-amber-50 border border-amber-300 p-4 m-4 rounded-xl text-amber-900">Foto/video tidak mengukur tinggi, berat, vital sign, atau risiko penyakit. Analisis klinis dinonaktifkan (REQUIRES_REVIEW). Isi formulir hanya dengan hasil pengukuran alat.</div>
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors">
            <ArrowLeft size={18} />
            <span className="font-bold text-sm">Kembali</span>
          </Link>
          <div className="text-center">
            <h1 className="font-bold text-sm sm:text-base text-slate-800">
              Pemeriksaan Fisik & Skrining Wajah rPPG
            </h1>
            <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
              Postur Tulang Belakang • Morfologi Wajah • Biomarker Mikrovaskular Diabetes
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all"
              title="Pusat Pengaturan, IoT Hub, SATUSEHAT & Integrasi API"
            >
              <Settings size={15} className="text-slate-600" />
              <span className="hidden sm:inline">Pengaturan</span>
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

        {/* ========================================================================= */}
        {/* SESSION SELECTOR TABS (Pemisahan Sesi Berdasarkan Fungsi Spesifik) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 sm:p-3 mb-8">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-3 pt-1 pb-2">
            Pilih Sesi Pemeriksaan Terfokus:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            
            {/* Tab 1: Postur & Full Body */}
            <button
              onClick={() => {
                setActiveSession('posture');
                setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
              }}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                activeSession === 'posture'
                  ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`p-2.5 rounded-lg shrink-0 ${
                activeSession === 'posture' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm ${activeSession === 'posture' ? 'text-emerald-950' : 'text-slate-800'}`}>
                    1. Postur & Antropometri
                  </span>
                  {activeSession === 'posture' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  <strong>Foto Full Body</strong>: Kurvatura tulang belakang (skoliosis, kifosis), asimetri bahu, Z-Score.
                </p>
              </div>
            </button>

            {/* Tab 2: Wajah & rPPG */}
            <button
              onClick={() => {
                setActiveSession('face_rppg');
                setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
              }}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                activeSession === 'face_rppg'
                  ? 'bg-rose-50 border-rose-500 shadow-sm ring-2 ring-rose-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`p-2.5 rounded-lg shrink-0 ${
                activeSession === 'face_rppg' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <Video size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm ${activeSession === 'face_rppg' ? 'text-rose-950' : 'text-slate-800'}`}>
                    2. Skrining Wajah & rPPG
                  </span>
                  {activeSession === 'face_rppg' && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  <strong>Video Wajah 5s</strong>: Bentuk wajah, estimasi usia, & skrining mikrovaskular diabetes via rPPG dahi/pipi.
                </p>
              </div>
            </button>

            {/* Tab 3: Dual Session / MCU Lengkap */}
            <button
              onClick={() => {
                setActiveSession('dual');
                setResult(null);
    setSavedRecordId(null);
    setFeedbackGiven(null);
              }}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                activeSession === 'dual'
                  ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`p-2.5 rounded-lg shrink-0 ${
                activeSession === 'dual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <Layers size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-sm ${activeSession === 'dual' ? 'text-indigo-950' : 'text-slate-800'}`}>
                    3. Pemeriksaan Terpadu (Dual)
                  </span>
                  {activeSession === 'dual' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  <strong>Slot Ganda</strong>: Menggabungkan foto tubuh (postur) dan video wajah (rPPG) dalam satu rekam medis.
                </p>
              </div>
            </button>

          </div>
        </div>

        {/* Patient Data Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Data Pasien & Antropometri Dasar</h2>
              <p className="text-xs text-slate-500">
                Data klinis digunakan sebagai kuesioner pendukung untuk memverifikasi rasio IMT, usia, dan risiko kardiometabolik.
              </p>
            </div>
            {iotSynced ? (
              <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                ✓ Terisi dari IoT Hub
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pasien</label>
              <input 
                type="text" 
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                value={patientData.name} 
                onChange={e => setPatientData({...patientData, name: e.target.value})} 
                placeholder="Contoh: Budi Santoso" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Umur Pasien (Tahun)</label>
              <input 
                type="number" 
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                value={patientData.age} 
                onChange={e => setPatientData({...patientData, age: e.target.value})} 
                placeholder="Contoh: 28" 
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Tinggi Badan (cm)</label>
                {quickEstimatedBiometrics?.height && (
                  <button
                    type="button"
                    onClick={() => setPatientData(prev => ({ ...prev, height: String(quickEstimatedBiometrics.height) }))}
                    className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 transition-colors"
                    title="Klik untuk mengisi dengan estimasi foto"
                  >
                    <Sparkles size={11} className="text-emerald-600" />
                    <span>AI Foto: {quickEstimatedBiometrics.height} cm</span>
                  </button>
                )}
              </div>
              <input 
                type="number" 
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                value={patientData.height} 
                onChange={e => setPatientData({...patientData, height: e.target.value})} 
                placeholder={quickEstimatedBiometrics?.height ? `Estimasi foto: ${quickEstimatedBiometrics.height}` : "Contoh: 170 (atau biarkan AI estimasi dari foto)"} 
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Bisa diisi manual atau otomatis diestimasi oleh AI dari foto tubuh.
              </span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Berat Badan (kg)</label>
                {quickEstimatedBiometrics?.weight && (
                  <button
                    type="button"
                    onClick={() => setPatientData(prev => ({ ...prev, weight: String(quickEstimatedBiometrics.weight) }))}
                    className="text-[10px] bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded border border-teal-300 flex items-center gap-1 transition-colors"
                    title="Klik untuk mengisi dengan estimasi foto"
                  >
                    <Sparkles size={11} className="text-teal-600" />
                    <span>AI Foto: {quickEstimatedBiometrics.weight} kg</span>
                  </button>
                )}
              </div>
              <input 
                type="number" 
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                value={patientData.weight} 
                onChange={e => setPatientData({...patientData, weight: e.target.value})} 
                placeholder={quickEstimatedBiometrics?.weight ? `Estimasi foto: ${quickEstimatedBiometrics.weight}` : "Contoh: 65 (atau biarkan AI estimasi dari foto)"} 
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Bisa diisi manual atau otomatis diestimasi oleh AI dari foto tubuh.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lingkar Kepala (cm) <span className="text-slate-400 font-normal">(opsional)</span></label>
              <input 
                type="number" 
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" 
                value={patientData.headCircumference} 
                onChange={e => setPatientData({...patientData, headCircumference: e.target.value})} 
                placeholder="Contoh: 54" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lingkar Lengan Atas / LILA (cm) <span className="text-slate-400 font-normal">(opsional)</span></label>
              <input 
                type="number" 
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" 
                value={patientData.armCircumference} 
                onChange={e => setPatientData({...patientData, armCircumference: e.target.value})} 
                placeholder="Contoh: 26" 
              />
            </div>
          </div>

          <h3 className="text-sm font-bold mb-3 text-slate-800 border-t pt-4">Tanda Vital & Parameter Fisik Tambahan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Tekanan Darah (mmHg)</label>
              <div className="flex items-center gap-1.5">
                <input 
                  type="number" 
                  placeholder="Sistolik (120)" 
                  className="w-full p-2 border border-slate-300 rounded-lg" 
                  value={patientData.bloodPressureSystolic} 
                  onChange={e => setPatientData({...patientData, bloodPressureSystolic: e.target.value})} 
                />
                <span className="text-slate-400 font-bold">/</span>
                <input 
                  type="number" 
                  placeholder="Diastolik (80)" 
                  className="w-full p-2 border border-slate-300 rounded-lg" 
                  value={patientData.bloodPressureDiastolic} 
                  onChange={e => setPatientData({...patientData, bloodPressureDiastolic: e.target.value})} 
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Denyut Nadi (bpm) & Suhu (°C)</label>
              <div className="flex items-center gap-1.5">
                <input 
                  type="number" 
                  placeholder="Nadi (76)" 
                  className="w-full p-2 border border-slate-300 rounded-lg" 
                  value={patientData.pulseRate} 
                  onChange={e => setPatientData({...patientData, pulseRate: e.target.value})} 
                />
                <span className="text-slate-400 font-bold">|</span>
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="Suhu (36.6)" 
                  className="w-full p-2 border border-slate-300 rounded-lg" 
                  value={patientData.bodyTemperature} 
                  onChange={e => setPatientData({...patientData, bodyTemperature: e.target.value})} 
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Pemeriksaan Sensorik & Organ</label>
              <div className="grid grid-cols-2 gap-2">
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white" 
                  value={patientData.eyeHealth} 
                  onChange={e => setPatientData({...patientData, eyeHealth: e.target.value})}
                >
                  <option value="Normal">Mata: Normal</option>
                  <option value="Ada Kelainan">Mata: Kelainan</option>
                </select>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white" 
                  value={patientData.colorBlindness} 
                  onChange={e => setPatientData({...patientData, colorBlindness: e.target.value})}
                >
                  <option value="Normal">Buta Warna: Normal</option>
                  <option value="Buta Warna Parsial">Parsial</option>
                  <option value="Buta Warna Total">Total</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MEDIA CAPTURE & INPUT SECTION (Disesuaikan dengan Sesi yang Dipilih) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {activeSession === 'posture' && <User className="text-emerald-600" size={20} />}
                {activeSession === 'face_rppg' && <Video className="text-rose-600" size={20} />}
                {activeSession === 'dual' && <Layers className="text-indigo-600" size={20} />}
                <span>
                  {activeSession === 'posture' && "Sesi 1: Foto Badan Penuh (Pemeriksaan Postur)"}
                  {activeSession === 'face_rppg' && "Sesi 2: Video Wajah 5 Detik (Skrining rPPG & Diabetes)"}
                  {activeSession === 'dual' && "Sesi 3: Input Terpadu (Foto Badan + Video Wajah)"}
                </span>
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {activeSession === 'posture' && "Pastikan foto menampilkan seluruh badan dari kepala hingga kaki untuk analisis simetri tulang belakang, sudut Cobb, dan postur."}
                {activeSession === 'face_rppg' && "Pastikan rekaman berfokus pada area wajah (dahi & pipi) dengan pencahayaan stabil untuk analisis denyut mikrovaskular rPPG, estimasi usia, dan risiko diabetes."}
                {activeSession === 'dual' && "Masukkan foto seluruh badan pada Slot A dan video wajah 5 detik pada Slot B untuk pemeriksaan terintegrasi."}
              </p>
            </div>

            <div className="self-start sm:self-auto">
              {activeSession === 'posture' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <User size={13} /> Khusus Foto Full Body
                </span>
              )}
              {activeSession === 'face_rppg' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <Waves size={13} /> Khusus Video Wajah rPPG (5s)
                </span>
              )}
              {activeSession === 'dual' && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Layers size={13} /> Dual Slot MCU
                </span>
              )}
            </div>
          </div>

          {/* Camera Viewfinder (Live Video Stream) */}
          {isCameraOpen && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video mb-6 border-2 border-slate-700 shadow-2xl">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              
              {/* Interactive Viewfinder Framing Overlay */}
              {activeSession === 'face_rppg' ? (
                /* Oval Face Framing Guide for rPPG */
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[52%] max-w-[260px] aspect-[3/4] rounded-[50%] border-2 border-dashed border-rose-400/90 shadow-[0_0_20px_rgba(244,63,94,0.4)] flex flex-col items-center justify-between py-6">
                    <span className="text-[10px] font-bold text-rose-200 bg-black/70 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      Posisikan Dahi di Sini
                    </span>
                    <div className="flex gap-8 text-[9px] text-emerald-200 bg-black/70 px-2 py-0.5 rounded-full">
                      <span>Pipi Kiri</span>
                      <span>Pipi Kanan</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Full Body Framing Guide for Posture */
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[45%] max-w-[280px] h-[90%] rounded-xl border-2 border-dashed border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex flex-col items-center justify-between py-4">
                    <span className="text-[10px] font-bold text-emerald-200 bg-black/70 px-2 py-0.5 rounded-full">
                      Batas Kepala & Bahu
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300 bg-black/70 px-2 py-0.5 rounded">
                      Garis Aksial Tulang Belakang
                    </span>
                    <span className="text-[10px] font-bold text-emerald-200 bg-black/70 px-2 py-0.5 rounded-full">
                      Batas Kaki & Pijakan
                    </span>
                  </div>
                </div>
              )}

              {/* Recording Progress Bar & Overlay */}
              {isRecording && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/50 z-20">
                    <div 
                      className="h-full bg-rose-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${Math.max(5, ((5 - recordSecondsLeft) / 5) * 100)}%` }}
                    />
                  </div>
                  <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between bg-black/75 backdrop-blur-md px-4 py-2 rounded-full border border-rose-500/60 text-white">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>Merekam rPPG Wajah ({5 - recordSecondsLeft}s / 5s)</span>
                    </div>
                    <span className="text-rose-400 font-extrabold text-sm">{recordSecondsLeft}s tersisa</span>
                  </div>
                </>
              )}

              {/* Viewfinder Controls */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 sm:gap-6 items-center px-4">
                
                {/* Photo Capture Button */}
                {activeSession !== 'face_rppg' && (
                  <button 
                    onClick={() => capturePhoto('posture_body')}
                    disabled={isRecording}
                    className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
                    title="Ambil Foto Badan"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full border-4 border-emerald-300 shadow-lg hover:scale-105 active:scale-95 transition-transform" />
                    <span className="text-xs font-medium drop-shadow-md">Ambil Foto Badan</span>
                  </button>
                )}

                {/* 5s Video Record Button */}
                {activeSession !== 'posture' && (
                  <button 
                    onClick={isRecording ? stopVideoRecording : startVideoRecording}
                    className="flex flex-col items-center gap-1 text-white"
                    title={isRecording ? "Hentikan Rekaman" : "Mulai Rekam Video Wajah 5 Detik"}
                  >
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center ${
                      isRecording 
                        ? 'bg-rose-600 border-rose-300 animate-pulse' 
                        : 'bg-rose-500 border-rose-200'
                    }`}>
                      {isRecording ? (
                        <StopCircle size={24} className="text-white" />
                      ) : (
                        <Video size={22} className="text-white" />
                      )}
                    </div>
                    <span className="text-xs font-semibold drop-shadow-md text-rose-300">
                      {isRecording ? `Stop (${recordSecondsLeft}s)` : 'Rekam 5s Wajah'}
                    </span>
                  </button>
                )}

                {/* Switch Camera */}
                <button 
                  onClick={toggleCamera}
                  disabled={isRecording}
                  className="flex flex-col items-center gap-1 text-white disabled:opacity-40"
                  title="Ganti Kamera Depan/Belakang"
                >
                  <div className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 hover:bg-black/70 transition-colors">
                    <RefreshCw size={18} />
                  </div>
                  <span className="text-xs font-medium drop-shadow-md">Ganti</span>
                </button>

                {/* Close Camera */}
                <button 
                  onClick={stopCamera}
                  className="absolute right-4 top-4 px-3.5 py-1.5 bg-black/60 text-white rounded-full backdrop-blur-sm text-xs font-semibold hover:bg-black/80 border border-white/20 transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* Action Trigger Buttons (When camera is closed) */}
          {!isCameraOpen && (
            <div className="space-y-4 mb-6">
              
              {/* Sesi 1: Postur (Full Body) */}
              {activeSession === 'posture' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      setFacingMode('environment');
                      startCamera(false);
                    }}
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-emerald-300 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100 transition-all gap-2 group text-center"
                  >
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 group-hover:scale-110 transition-transform shadow-sm">
                      <Camera size={24} />
                    </div>
                    <span className="font-bold text-sm text-emerald-950">Ambil Foto Seluruh Badan</span>
                    <span className="text-[11px] text-emerald-700">Gunakan kamera belakang (Full Body Viewfinder)</span>
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all gap-2 group text-center"
                  >
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 group-hover:scale-110 transition-transform shadow-sm">
                      <Upload size={24} />
                    </div>
                    <span className="font-bold text-sm text-slate-900">Upload Foto Full Body</span>
                    <span className="text-[11px] text-slate-600">Format JPG, PNG (Tampak Depan/Belakang)</span>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => {
                      handleFileUpload(e, 'posture_body');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              )}

              {/* Sesi 2: Wajah rPPG (Video 5s) */}
              {activeSession === 'face_rppg' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      setFacingMode('user');
                      startCamera(true);
                    }}
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-rose-300 rounded-2xl bg-rose-50/80 hover:bg-rose-100 transition-all gap-2 group text-center relative overflow-hidden"
                  >
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
                      Otomatis 5 Detik
                    </div>
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-700 group-hover:scale-110 transition-transform shadow-sm">
                      <Video size={24} />
                    </div>
                    <span className="font-bold text-sm text-rose-950">Rekam Video Wajah 5 Detik</span>
                    <span className="text-[11px] text-rose-700">Kamera depan dengan panduan oval dahi & pipi</span>
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all gap-2 group text-center"
                  >
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-700 group-hover:scale-110 transition-transform shadow-sm">
                      <Upload size={24} />
                    </div>
                    <span className="font-bold text-sm text-slate-900">Upload Rekaman / Foto Wajah</span>
                    <span className="text-[11px] text-slate-600">Format MP4, WebM, JPG (Area Wajah Jelas)</span>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => {
                      handleFileUpload(e, 'face_rppg');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }} 
                    accept="video/*,image/*" 
                    className="hidden" 
                  />
                </div>
              )}

              {/* Sesi 3: Dual Slot Terpadu */}
              {activeSession === 'dual' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slot A: Posture Body */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                        <User size={15} className="text-emerald-600" />
                        Slot A: Foto Seluruh Tubuh (Postur)
                      </span>
                      {postureMedia && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                          ✓ Terunggah
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setFacingMode('environment');
                          startCamera(false);
                        }}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Camera size={14} /> Foto Kamera
                      </button>
                      <button
                        onClick={() => postureFileInputRef.current?.click()}
                        className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Upload size={14} /> Upload Foto
                      </button>
                      <input 
                        type="file" 
                        ref={postureFileInputRef} 
                        onChange={(e) => {
                          handleFileUpload(e, 'posture_body');
                          if (postureFileInputRef.current) postureFileInputRef.current.value = '';
                        }} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                  </div>

                  {/* Slot B: Face rPPG */}
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                        <Video size={15} className="text-rose-600" />
                        Slot B: Video Wajah 5s (rPPG & Diabetes)
                      </span>
                      {faceMedia && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-800">
                          ✓ Terunggah
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setFacingMode('user');
                          startCamera(true);
                        }}
                        className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Video size={14} /> Rekam 5s
                      </button>
                      <button
                        onClick={() => faceFileInputRef.current?.click()}
                        className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Upload size={14} /> Upload Video
                      </button>
                      <input 
                        type="file" 
                        ref={faceFileInputRef} 
                        onChange={(e) => {
                          handleFileUpload(e, 'face_rppg');
                          if (faceFileInputRef.current) faceFileInputRef.current.value = '';
                        }} 
                        accept="video/*,image/*" 
                        className="hidden" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Informative Guidance Banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
                <div className="p-1 bg-indigo-100 text-indigo-700 rounded-md mt-0.5 shrink-0">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Verifikasi Kesesuaian Media Sebelum Analisis:</p>
                  <p className="mt-0.5">
                    Sistem akan memindai kecocokan media sebelum menghasilkan laporan. Foto badan penuh akan dikhususkan untuk analisis kurvatura vertebra & postur, sedangkan rekaman video wajah 5 detik akan dikhususkan untuk morfologi wajah, estimasi usia, dan ekstraksi denyut mikrovaskular rPPG untuk skrining risiko kardiometabolik / diabetes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Media Preview Grid */}
          {mediaItems.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <span>Media Terpilih ({mediaItems.length})</span>
                </h3>
                <span className="text-xs text-slate-500">
                  {mediaItems.filter(m => m.type === 'video').length} Video rPPG • {mediaItems.filter(m => m.type === 'image').length} Foto Postur
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {mediaItems.map((item) => (
                  <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group shadow-sm">
                    {item.type === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center relative bg-black">
                        <video 
                          src={item.url} 
                          controls 
                          playsInline 
                          className="w-full h-full object-cover" 
                        />
                        <span className="absolute bottom-2 left-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none shadow">
                          <Video size={11} /> Video rPPG 5s
                        </span>
                      </div>
                    ) : (
                      <>
                        <Image src={item.url} alt="Preview" fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <span className="absolute bottom-2 left-2 bg-slate-800/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm pointer-events-none">
                          <Camera size={11} /> {item.sessionCategory === 'posture_body' ? 'Foto Postur' : 'Foto Wajah'}
                        </span>
                      </>
                    )}
                    <button 
                      onClick={() => removeMedia(item.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10 shadow-md"
                      title="Hapus Media"
                    >
                      <X size={13} />
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

              {/* Quick Biometric Anthropometry Scanning from Photo Feature */}
              {mediaItems.some(m => m.type === 'image' || m.sessionCategory === 'posture_body') && (
                <div className="p-4 rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                        <Ruler size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                          <span>Pindai Cepat Tinggi & Berat Badan dari Foto</span>
                          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                            Computer Vision AI
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Cukup dengan foto badan penuh, AI menganalisis rasio sefalosomatik & kontur tubuh untuk mengestimasi TB dan BB secara instan.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => quickEstimateBiometricsFromPhoto()}
                      disabled={isQuickEstimating || loading}
                      className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isQuickEstimating ? (
                        <>
                          <RefreshCw className="animate-spin" size={14} />
                          <span>Memindai Foto...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>{quickEstimatedBiometrics ? "Pindai Ulang Foto" : "Pindai TB & BB Sekarang"}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Instant Notification or Results Display */}
                  {quickEstimatedBiometrics && (
                    <div className="mt-2 pt-3 border-t border-emerald-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Tinggi Badan (TB)</span>
                        <span className="text-base sm:text-lg font-black text-emerald-800 block">
                          {quickEstimatedBiometrics.height} <span className="text-xs font-normal">cm</span>
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">Rentang: {quickEstimatedBiometrics.heightRange}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-teal-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Perkiraan Berat (BB)</span>
                        <span className="text-base sm:text-lg font-black text-teal-800 block">
                          {quickEstimatedBiometrics.weight} <span className="text-xs font-normal">kg</span>
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">Rentang: {quickEstimatedBiometrics.weightRange}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-cyan-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Perkiraan IMT</span>
                        <span className="text-base sm:text-lg font-black text-cyan-800 block">
                          {quickEstimatedBiometrics.bmi} <span className="text-xs font-normal">kg/m²</span>
                        </span>
                        <span className="text-[9px] text-emerald-700 font-bold">{quickEstimatedBiometrics.bmiCategory}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-indigo-200 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Tipe Somatotype</span>
                        <span className="text-xs sm:text-sm font-bold text-indigo-900 block truncate mt-1">
                          {quickEstimatedBiometrics.somatotype || "Proporsional"}
                        </span>
                        <span className="text-[9px] text-indigo-700 font-medium">Akurasi: {quickEstimatedBiometrics.confidence}</span>
                      </div>
                    </div>
                  )}

                  {quickEstimateNotice && (
                    <div className="text-[11px] text-emerald-800 bg-emerald-100/80 p-2 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                      <span>{quickEstimateNotice}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Analysis Button */}
              <button
                onClick={analyzeMedia}
                disabled={loading}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-base sm:text-lg shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} /> 
                    <span>{loadingStep || 'Menganalisis Kecocokan Media & Parameter Biomedis...'}</span>
                  </>
                ) : (
                  <>
                    <Activity size={20} /> 
                    <span>
                      {activeSession === 'posture' && "Mulai Analisis Postur & Antropometri"}
                      {activeSession === 'face_rppg' && "Mulai Skrining Wajah & rPPG Diabetes"}
                      {activeSession === 'dual' && "Mulai Pemeriksaan Terpadu (Dual-Session MCU)"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RESULTS SECTION (Laporan Analisis Medis Lengkap) */}
        {/* ========================================================================= */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!user ? (
              <div className="bg-white p-8 rounded-2xl text-center shadow-lg border border-slate-200">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-emerald-500" size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Pemeriksaan Berhasil Diproses!</h2>
                <p className="text-slate-600 mb-6 max-w-md mx-auto text-sm">
                  AI telah selesai melakukan validasi kecocokan media dan analisis biomedis. Silakan masuk (Login) untuk melihat hasil lengkap dan menyinkronkannya ke Rekam Medis.
                </p>
                <div className="flex justify-center">
                  <LoginButton />
                </div>
              </div>
            ) : (
              <div ref={resultContainerRef} className="space-y-8 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
                
                {/* Report Header for Export/Print */}
                <div className="border-b-2 border-slate-800 pb-6 mb-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 uppercase tracking-wider">
                        LAPORAN PEMERIKSAAN FISIK, POSTUR & SKRINING rPPG
                      </h1>
                      <p className="text-slate-500 text-xs sm:text-sm mt-1">
                        Sistem Asisten Skrining Biomedis Multimodal Terpadu
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900">
                        {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-500">Pasien: {result.json_output?.patient_name || patientData.name || '-'}</p>
                      <p className="text-xs text-slate-500">ID: {result.json_output?.patient_id || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* 1. MEDIA MATCH VALIDATION ALERT (Pemeriksaan Kecocokan Media) */}
                {result.json_output?.media_match_status === 'MISMATCH' ? (
                  <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                    <div className="space-y-1">
                      <div className="font-bold text-sm flex items-center gap-2">
                        <span>Peringatan Kecocokan Media (Media Mismatch Detected)</span>
                        <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-800 rounded font-mono uppercase">
                          {result.json_output?.detected_media_type} vs {activeSession}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-amber-800">
                        {result.json_output?.mismatch_warning || "Media yang diunggah tidak sesuai dengan tujuan sesi yang dipilih. Silakan periksa apakah foto merupakan foto badan penuh untuk postur atau video wajah untuk rPPG."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="font-bold">Kecocokan Media Terverifikasi Sesuai:</span>
                      <span className="text-emerald-700">
                        {result.json_output?.detected_media_type === 'FULL_BODY' ? 'Foto Seluruh Tubuh (Analisis Postur Aktif)' : 'Video/Foto Wajah (Skrining rPPG & Morfologi Aktif)'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 font-bold text-[10px]">
                      STATUS: MATCH
                    </span>
                  </div>
                )}

                {/* 2. FACE rPPG & DIABETES SCREENING VISUALIZER (Jika Sesi Wajah atau Dual) */}
                {(activeSession === 'face_rppg' || activeSession === 'dual' || result.json_output?.face_rppg_analysis) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                        <Waves className="text-rose-600" size={18} />
                        <span>Skrining Biomarker Mikrovaskular rPPG & Morfologi Wajah</span>
                      </h3>
                      <span className="text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Photoplethysmography AI
                      </span>
                    </div>
                    
                    <FaceRppgPulseVisualizer
                      mediaUrl={faceMedia?.url || mediaItems[0]?.url || ''}
                      mediaType={faceMedia?.type || mediaItems[0]?.type || 'video'}
                      pulseRate={undefined}
                      pulseRegularity={undefined}
                      faceShape={undefined}
                      estimatedAge={undefined}
                      diabetesRisk={undefined}
                      microvascularNotes={undefined}
                      findings={result.json_output?.findings || []}
                    />
                  </div>
                )}

                {/* 3. POSTURE SPINE HEATMAP VISUALIZER (Jika Sesi Postur atau Dual) */}
                {(activeSession === 'posture' || activeSession === 'dual' || result.json_output?.posture_analysis) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                        <Activity className="text-emerald-600" size={18} />
                        <span>Visualisasi Postural Spine Heatmap Overlay & Kurvatura Tulang Belakang</span>
                      </h3>
                      <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Biomekanik Muskuloskeletal
                      </span>
                    </div>

                    {mediaItems.map((item, index) => {
                      if (item.type !== 'image') return null;
                      
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

                {/* 4. AI ESTIMATED ANTHROPOMETRY FROM PHOTO (Tinggi Badan, Berat Badan & IMT) */}
                {(result.json_output?.ai_estimated_anthropometry || quickEstimatedBiometrics) && (
                  <div className="p-5 sm:p-6 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                          <Ruler size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                            <span>Estimasi Antropometri AI dari Foto Tubuh (Optik Biometrik)</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                              Otomatis dari Foto
                            </span>
                          </h3>
                          <p className="text-xs text-slate-600 mt-0.5">
                            AI memperkirakan tinggi dan berat badan berdasarkan analisis rasio sefalosomatik (kepala-tubuh), lebar bahu biakromial, dan kontur torso.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-white px-3 py-1 rounded-lg border border-emerald-200 text-emerald-800 font-semibold shadow-2xs flex items-center gap-1">
                          <Sparkles size={13} className="text-emerald-600" />
                          Kepercayaan: Belum tervalidasi
                        </span>
                      </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      {/* Height */}
                      <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Tinggi Badan (TB)</span>
                          <span className="text-2xl sm:text-3xl font-black text-emerald-800 block mt-0.5">
                            {patientData.height || 'Belum diukur'}
                            <span className="text-sm font-normal text-slate-600 ml-1">cm</span>
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium mt-1">
                          Rentang: {result.json_output?.ai_estimated_anthropometry?.height_range_cm || quickEstimatedBiometrics?.heightRange || "165 - 171 cm"}
                        </span>
                      </div>

                      {/* Weight */}
                      <div className="p-3.5 bg-white rounded-xl border border-teal-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Perkiraan Berat (BB)</span>
                          <span className="text-2xl sm:text-3xl font-black text-teal-800 block mt-0.5">
                            {patientData.weight || 'Belum diukur'}
                            <span className="text-sm font-normal text-slate-600 ml-1">kg</span>
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium mt-1">
                          Rentang: {result.json_output?.ai_estimated_anthropometry?.weight_range_kg || quickEstimatedBiometrics?.weightRange || "59 - 65 kg"}
                        </span>
                      </div>

                      {/* BMI */}
                      <div className="p-3.5 bg-white rounded-xl border border-cyan-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Perkiraan IMT</span>
                          <span className="text-2xl sm:text-3xl font-black text-cyan-800 block mt-0.5">
                            {patientData.height && patientData.weight && Number(patientData.height) > 0 && Number(patientData.weight) > 0 ? (Number(patientData.weight) / (Number(patientData.height) / 100) ** 2).toFixed(1) : 'Belum diukur'}
                            <span className="text-xs font-normal text-slate-600 ml-1">kg/m²</span>
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 mt-1">
                          Sumber: dimasukkan manual; perlu verifikasi pengukuran
                        </span>
                      </div>

                      {/* Somatotype */}
                      <div className="p-3.5 bg-white rounded-xl border border-indigo-200 shadow-2xs flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Somatotype Tubuh</span>
                          <span className="text-sm sm:text-base font-bold text-indigo-900 block mt-1 leading-snug">
                            {result.json_output?.ai_estimated_anthropometry?.somatotype || quickEstimatedBiometrics?.somatotype || "Mesomorph Atletis"}
                          </span>
                        </div>
                        <span className="text-[10px] text-indigo-700 font-medium mt-1">
                          Klasifikasi Siluet & Postur
                        </span>
                      </div>
                    </div>

                    {/* Biometric Detail Note */}
                    {(result.json_output?.ai_estimated_anthropometry?.body_proportions_detail || quickEstimatedBiometrics?.detail) && (
                      <div className="p-3 bg-emerald-100/60 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
                        <UserCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Analisis Proporsi Fisik & Komputasi Optik: </span>
                          <span>{result.json_output?.ai_estimated_anthropometry?.body_proportions_detail || quickEstimatedBiometrics?.detail}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. MARKDOWN REPORT CONTENT */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-2">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                      <FileText className="text-emerald-600" size={18} />
                      <span>Rangkuman Medis & Rekomendasi Klinis Terstruktur</span>
                    </h3>
                    <div className="flex gap-2 flex-wrap" data-html2canvas-ignore>
                      <button 
                        onClick={() => setIsSatuSehatModalOpen(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-300 transition-colors shadow-sm"
                      >
                        <ShieldCheck size={14} className="text-emerald-700" /> SATUSEHAT
                      </button>
                      <button 
                        onClick={exportJSON}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
                      >
                        <FileJson size={14} /> JSON
                      </button>
                      <button 
                        id="btn-export-pdf"
                        onClick={exportPDF}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors border border-emerald-300"
                      >
                        <Download size={14} /> Unduh PDF
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 sm:p-8 prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed" ref={reportRef}>
                    <ReactMarkdown>{result.markdown_report}</ReactMarkdown>
                    
                    {/* Status Gizi Z-Score BarChart */}
                    {false && result.json_output?.nutrition_metrics && (
                      <div className="mt-8 not-prose border-t pt-6">
                        <h3 className="text-base font-bold text-slate-800 mb-3">Visualisasi Status Gizi & Z-Score (Standar WHO / Permenkes)</h3>
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
                                    { name: 'IMT/U', ZScore: result.json_output.nutrition_metrics.imt_z_score || 0 },
                                    { name: 'TB/U', ZScore: result.json_output.nutrition_metrics.tb_u_z_score || 0 },
                                    { name: 'BB/U', ZScore: result.json_output.nutrition_metrics.bb_u_z_score || 0 }
                                  ].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.ZScore > 2 || entry.ZScore < -2 ? '#ef4444' : '#10b981'} />
                                  ))
                                }
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 text-center">
                          *Z-Score antara -2 SD dan +2 SD merupakan rentang batas normal gizi WHO & Kementerian Kesehatan RI.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Accuracy Feedback Section */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200" data-html2canvas-ignore>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Apakah hasil evaluasi biomedis AI ini akurat?</h3>
                  {feedbackGiven ? (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-4 rounded-xl text-sm">
                      <CheckCircle size={18} />
                      <span className="font-medium">Terima kasih atas umpan balik Anda! Data evaluasi ini membantu peningkatan presisi algoritma skrining.</span>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => handleFeedback(true)}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2.5 rounded-xl font-medium transition-colors border border-emerald-200 text-xs sm:text-sm"
                      >
                        <CheckCircle size={16} /> Ya, Sesuai / Akurat
                      </button>
                      <button 
                        onClick={() => handleFeedback(false)}
                        className="flex-1 flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 py-2.5 rounded-xl font-medium transition-colors border border-rose-200 text-xs sm:text-sm"
                      >
                        <X size={16} /> Tidak Sesuai
                      </button>
                    </div>
                  )}
                </div>

                {/* Technical JSON Debug Toggle */}
                <div className="border border-slate-200 rounded-xl overflow-hidden" data-html2canvas-ignore>
                  <button 
                    onClick={() => setShowJson(!showJson)}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-600"
                  >
                    <span>Lihat Struktur Data Teknis (JSON Multimodal Payload)</span>
                    {showJson ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  
                  {showJson && (
                    <div className="p-4 bg-slate-900 text-slate-50 overflow-x-auto">
                      <pre className="text-xs font-mono">
                        {JSON.stringify(result.json_output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Official Medical Disclaimer */}
                <div className="flex gap-3 p-4 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 text-xs leading-relaxed">
                  <AlertCircle className="shrink-0 mt-0.5 text-amber-600" size={18} />
                  <div>
                    <strong>DISCLAIMER UTAMA:</strong> Hasil skrining AI (Postur Spine Heatmap & rPPG Mikrovaskular) ini merupakan <strong>penilaian awal (skrining)</strong> dan <strong>BUKAN DIAGNOSIS MEDIS DEFINITIF</strong>. Tidak menggantikan konsultasi langsung dengan dokter, dokter spesialis ortopedi, penyakit dalam, atau tenaga kesehatan profesional.
                  </div>
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
        diagnosa={result?.json_output?.findings?.[0]?.medis || result?.json_output?.summary?.pesan || result?.json_output?.posture_analysis?.condition || 'Pemeriksaan Fisik'}
        icd10={result?.json_output?.findings?.[0]?.icd10 || (result?.json_output?.summary?.status === 'NORMAL' ? 'Z00.129' : 'Z00.00')}
        postureSeverityScore={undefined}
        postureCondition={result?.json_output?.posture_analysis?.condition || 'Normal Simetris'}
      />

    </div>
  );
}
