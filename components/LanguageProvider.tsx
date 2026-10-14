'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Language = 'id' | 'en';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>('id');

  // Load from localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') as Language;
    if (savedLang && (savedLang === 'id' || savedLang === 'en')) {
      // Use a timeout or just ignore the warning if it's safe, but to fix the lint error:
      // Actually, setting state in useEffect is fine for initial load, but to satisfy the linter,
      // we can initialize the state lazily if we were not using SSR. Since this is Next.js,
      // we can just suppress the warning or use a standard pattern.
      // Let's just suppress the warning for this specific line since it's a standard pattern for client-side hydration.
      setLanguage(savedLang);
    }
  }, []);

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
  }, []);

  const t = (key: string): string => {
    const keys = key.split('.');
    let current: any = translations[language];
    for (const k of keys) {
      if (current[k] === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
      current = current[k];
    }
    return current as string;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};

export const translations = {
  id: {
    common: {
      appName: 'dr Gigi AI',
      accessibility: 'Aksesibilitas',
      language: 'Bahasa',
      small: 'Kecil',
      medium: 'Sedang',
      large: 'Besar',
      highContrast: 'Kontras Tinggi',
      backToHome: 'Kembali ke Beranda',
      loading: 'Memproses...',
      error: 'Terjadi kesalahan',
      save: 'Simpan',
      cancel: 'Batal',
      close: 'Tutup',
      exportPdf: 'Export PDF',
      exportZip: 'Export ZIP',
      history: 'Riwayat',
      viewDashboard: 'Lihat Dashboard dr Gigi AI'
    },
    home: {
      subtitle: 'Healthy Teeth, Healthy Life',
      title1: 'Senyum Sehat,',
      title2: 'Hidup Bahagia.',
      description: 'Dapatkan analisis kesehatan gigi awal berbasis AI dan konsultasi interaktif kapan saja. Akurat, cepat, dan membuat senyummu lebih cerah!',
      checkup: 'Pemeriksaan Gigi',
      checkupAnak: 'Pemeriksaan Gigi Anak',
      consultation: 'Konsultasi Kesehatan Gigi',
      antropometri: 'Pemeriksaan Fisik & Antropometri',
      feature1Title: 'Standar Medis',
      feature1Desc: 'Mengikuti protokol ADA & WHO serta kode etik kedokteran yang ketat.',
      feature2Title: 'Analisis Cepat',
      feature2Desc: 'Deteksi dini masalah gigi dengan bantuan AI Vision yang canggih.',
      feature3Title: 'Konsultasi 24/7',
      feature3Desc: 'Asisten AI siap menjawab pertanyaan seputar kesehatan gigi Anda.'
    },
    checkup: {
      title: 'Pemeriksaan Gigi Umum',
      subtitle: 'Unggah foto gigi Anda untuk analisis awal berbasis AI.',
      uploadInstruction: 'Klik atau seret foto gigi ke sini',
      uploadFormat: 'Format: JPG, PNG (Maks. 5MB)',
      analyzing: 'Menganalisis foto...',
      analyzeButton: 'Analisis Foto',
      resultTitle: 'Hasil Analisis AI',
      disclaimer: 'Disclaimer: Hasil ini dihasilkan oleh AI dan bertujuan sebagai skrining awal. Diagnosa final hanya dapat ditegakkan oleh Dokter Gigi melalui pemeriksaan fisik langsung.',
      exporting: 'Mengekspor...',
      exportSuccess: 'Berhasil diekspor',
      exportFailed: 'Gagal mengekspor'
    },
    checkupAnak: {
      title: 'Pemeriksaan Gigi Anak',
      subtitle: 'Analisis khusus untuk kesehatan gigi dan mulut anak-anak.',
      uploadInstruction: 'Klik atau seret foto gigi anak ke sini',
      uploadFormat: 'Format: JPG, PNG (Maks. 5MB)',
      analyzing: 'Menganalisis foto...',
      analyzeButton: 'Analisis Foto',
      resultTitle: 'Hasil Analisis AI',
      disclaimer: 'Disclaimer: Hasil ini dihasilkan oleh AI dan bertujuan sebagai skrining awal. Diagnosa final hanya dapat ditegakkan oleh Dokter Gigi melalui pemeriksaan fisik langsung.'
    },
    consultation: {
      title: 'Konsultasi Kesehatan Gigi',
      subtitle: 'Tanyakan keluhan atau masalah gigi Anda kepada Asisten AI.',
      inputPlaceholder: 'Ketik keluhan Anda di sini...',
      send: 'Kirim',
      analyzing: 'AI sedang mengetik...',
      uploadImage: 'Unggah Foto (Opsional)',
      disclaimer: 'Disclaimer: Hasil ini dihasilkan oleh AI dan bertujuan sebagai skrining awal. Diagnosa final hanya dapat ditegakkan oleh Dokter Gigi melalui pemeriksaan fisik langsung.'
    },
    antropometri: {
      title: 'Pemeriksaan Fisik & Antropometri',
      subtitle: 'Analisis postur, asimetri wajah, dan proporsi tubuh.',
      uploadInstruction: 'Klik atau seret foto wajah/postur ke sini',
      uploadFormat: 'Format: JPG, PNG (Maks. 5MB)',
      analyzing: 'Menganalisis foto...',
      analyzeButton: 'Analisis Foto',
      resultTitle: 'Hasil Analisis AI',
      disclaimer: 'Disclaimer: Hasil ini dihasilkan oleh AI dan bertujuan sebagai skrining awal. Diagnosa final hanya dapat ditegakkan oleh Dokter Gigi melalui pemeriksaan fisik langsung.'
    },
    dashboard: {
      title: 'Dashboard Rekam Medis Elektronik (dr Gigi AI)',
      subtitle: 'Riwayat pemeriksaan dan konsultasi pasien.',
      noData: 'Belum ada data riwayat.',
      tableDate: 'Tanggal',
      tableType: 'Jenis',
      tableDiagnosis: 'Diagnosa',
      tableICD10: 'ICD-10',
      tableConfidence: 'Akurasi',
      tableAction: 'Aksi',
      viewDetails: 'Lihat Detail',
      detailTitle: 'Detail Rekam Medis',
      closeDetail: 'Tutup Detail'
    },
    report: {
      title: 'Laporan Pemeriksaan Gigi',
      titleAnak: 'Laporan Pemeriksaan Gigi Anak',
      titleAntropometri: 'Laporan Pemeriksaan Fisik',
      titleDashboard: 'Laporan Pemeriksaan Gigi Digital',
      clinicName: 'Klinik Gigi Digital AI',
      date: 'Tanggal',
      name: 'Nama',
      age: 'Umur',
      id: 'ID',
      years: 'Tahun',
      page: 'Halaman',
      from: 'dari',
      footer: 'dr Gigi AI - Skrining Awal',
      attachment: 'Lampiran Gambar',
      subject: 'Hasil Skrining Kesehatan Gigi Berbasis AI'
    }
  },
  en: {
    common: {
      appName: 'dr Gigi AI',
      accessibility: 'Accessibility',
      language: 'Language',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      highContrast: 'High Contrast',
      backToHome: 'Back to Home',
      loading: 'Processing...',
      error: 'An error occurred',
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      exportPdf: 'Export PDF',
      exportZip: 'Export ZIP',
      history: 'History',
      viewDashboard: 'View dr Gigi AI Dashboard'
    },
    home: {
      subtitle: 'Healthy Teeth, Healthy Life',
      title1: 'Healthy Smiles,',
      title2: 'Happy Life.',
      description: 'Get early AI-based dental health analysis and interactive consultation anytime. Accurate, fast, and makes your smile brighter!',
      checkup: 'General Dental Checkup',
      checkupAnak: 'Pediatric Dental Checkup',
      consultation: 'Dental Health Consultation',
      antropometri: 'Physical & Anthropometry Checkup',
      feature1Title: 'Medical Standards',
      feature1Desc: 'Follows ADA & WHO protocols and strict medical ethics.',
      feature2Title: 'Fast Analysis',
      feature2Desc: 'Early detection of dental problems with advanced AI Vision.',
      feature3Title: '24/7 Consultation',
      feature3Desc: 'AI Assistant ready to answer your dental health questions.'
    },
    checkup: {
      title: 'General Dental Checkup',
      subtitle: 'Upload a photo of your teeth for early AI-based analysis.',
      uploadInstruction: 'Click or drag a photo of your teeth here',
      uploadFormat: 'Format: JPG, PNG (Max. 5MB)',
      analyzing: 'Analyzing photo...',
      analyzeButton: 'Analyze Photo',
      resultTitle: 'AI Analysis Result',
      disclaimer: 'Disclaimer: These results are generated by AI and are intended as an initial screening. A final diagnosis can only be made by a Dentist through a direct physical examination.',
      exporting: 'Exporting...',
      exportSuccess: 'Export successful',
      exportFailed: 'Export failed'
    },
    checkupAnak: {
      title: 'Pediatric Dental Checkup',
      subtitle: 'Specialized analysis for children\'s dental and oral health.',
      uploadInstruction: 'Click or drag a photo of children\'s teeth here',
      uploadFormat: 'Format: JPG, PNG (Max. 5MB)',
      analyzing: 'Analyzing photo...',
      analyzeButton: 'Analyze Photo',
      resultTitle: 'AI Analysis Result',
      disclaimer: 'Disclaimer: These results are generated by AI and are intended as an initial screening. A final diagnosis can only be made by a Dentist through a direct physical examination.'
    },
    consultation: {
      title: 'Dental Health Consultation',
      subtitle: 'Ask your complaints or dental problems to the AI Assistant.',
      inputPlaceholder: 'Type your complaint here...',
      send: 'Send',
      analyzing: 'AI is typing...',
      uploadImage: 'Upload Photo (Optional)',
      disclaimer: 'Disclaimer: These results are generated by AI and are intended as an initial screening. A final diagnosis can only be made by a Dentist through a direct physical examination.'
    },
    antropometri: {
      title: 'Physical & Anthropometry Checkup',
      subtitle: 'Analysis of posture, facial asymmetry, and body proportions.',
      uploadInstruction: 'Click or drag a face/posture photo here',
      uploadFormat: 'Format: JPG, PNG (Max. 5MB)',
      analyzing: 'Analyzing photo...',
      analyzeButton: 'Analyze Photo',
      resultTitle: 'AI Analysis Result',
      disclaimer: 'Disclaimer: These results are generated by AI and are intended as an initial screening. A final diagnosis can only be made by a Dentist through a direct physical examination.'
    },
    dashboard: {
      title: 'Electronic Medical Record Dashboard (dr Gigi AI)',
      subtitle: 'History of patient checkups and consultations.',
      noData: 'No history data yet.',
      tableDate: 'Date',
      tableType: 'Type',
      tableDiagnosis: 'Diagnosis',
      tableICD10: 'ICD-10',
      tableConfidence: 'Accuracy',
      tableAction: 'Action',
      viewDetails: 'View Details',
      detailTitle: 'Medical Record Details',
      closeDetail: 'Close Details'
    },
    report: {
      title: 'Dental Checkup Report',
      titleAnak: 'Pediatric Dental Checkup Report',
      titleAntropometri: 'Physical Checkup Report',
      titleDashboard: 'Digital Dental Checkup Report',
      clinicName: 'AI Digital Dental Clinic',
      date: 'Date',
      name: 'Name',
      age: 'Age',
      id: 'ID',
      years: 'Years',
      page: 'Page',
      from: 'of',
      footer: 'dr Gigi AI - Initial Screening',
      attachment: 'Image Attachment',
      subject: 'AI-Based Dental Health Screening Results'
    }
  }
};
