'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { LayoutDashboard, ArrowLeft, Search, Calendar, User, FileText, Trash2, Eye, Download, Activity, AlertCircle, FileJson, FileType, Archive, X, Smile, MapPin, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { getAllRecords, deleteRecord, migrateFromLocalStorage, saveAppointment, getAllUsers, getAllAppointments, getAllPatients } from '../lib/db';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useLanguage } from '../../components/LanguageProvider';
import LoginButton from '../../components/LoginButton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useAuth } from '../../components/AuthProvider';

type MedicalRecord = {
  id: string;
  timestamp: string;
  patient_id: string;
  type?: string;
  diagnosa: string;
  icd10: string;
  confidence: string;
  image_url: string;
  json_output: any;
  markdown_report: string;
  is_accurate?: boolean | null;
};

export default function DashboardPage() {
  const { role, user } = useAuth();
  const { language, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusGiziFilter, setStatusGiziFilter] = useState('All');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('report');
  const [dashboardView, setDashboardView] = useState<'crm' | 'rme'>('rme');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', doctor: '', notes: '' });
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [users, setUsers] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (role === 'admin') {
      setDashboardView('crm');
    }
  }, [role]);

  useEffect(() => {
    const loadData = async () => {
      try {
        await migrateFromLocalStorage();
        const data = await getAllRecords(role) as MedicalRecord[];
        // Sort by timestamp (newest first)
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecords(data);

        const patientsData = await getAllPatients(role);
        setPatients(patientsData);

        // if admin, load users
        if (role === 'admin' || role === 'doctor') {
             const usersData = await getAllUsers(role);
             setUsers(usersData);
        }
      } catch (e) {
        console.error("Failed to load records:");
      }
    };

    loadData();
  }, [user, role]);

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus data rekam medis ini?')) {
      await deleteRecord(id);
      const newRecords = records.filter(r => r.id !== id);
      setRecords(newRecords);
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
        setIsMobileDetailOpen(false);
      }
    }
  };

  const handleExportJSON = () => {
    if (records.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    const jsonString = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    saveAs(blob, `Data_Pasien_${new Date().toISOString().split('T')[0]}.json`);
  };

  const handleExportAll = async () => {
    if (records.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    try {
      const zip = new JSZip();
      
      // Add JSON file with all data
      const allDataJson = JSON.stringify(records, null, 2);
      zip.file(language === 'en' ? "all_patient_data.json" : "semua_data_pasien.json", allDataJson);

      // Create a folder for images
      const imgFolder = zip.folder(language === 'en' ? "patient_photos" : "foto_pasien");

      records.forEach((record, index) => {
        if (record.image_url && record.image_url.startsWith('data:image')) {
          // Extract base64 data
          const base64Data = record.image_url.split(',')[1];
          const extension = record.image_url.substring("data:image/".length, record.image_url.indexOf(";base64"));
          const fileName = `${record.patient_id}_${record.id}.${extension || 'jpg'}`;
          imgFolder?.file(fileName, base64Data, { base64: true });
        }
      });

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${language === 'en' ? 'Export_Dental_dr_Gigi_AI_Data' : 'Export_Data_dr_Gigi_AI_Gigi'}_${new Date().toISOString().split('T')[0]}.zip`);
    } catch (error) {
      console.error("Export failed:");
      alert("Gagal mengekspor data.");
    }
  };

  const handleDownloadJSON = () => {
    if (!selectedRecord) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedRecord, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${language === 'en' ? 'medical_record' : 'rekam_medis'}_${selectedRecord.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !selectedRecord) return;

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        logging: false,
        useCORS: true, // Important for images
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${language === 'en' ? 'medical_report' : 'laporan_medis'}_${selectedRecord.patient_id}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:");
      alert("Gagal membuat PDF. Pastikan gambar telah dimuat sepenuhnya.");
    }
  };

  const getPatientName = (patient_id: string, record: any) => {
    const p = patients.find(p => p.id === patient_id);
    if (p && p.name) return p.name;
    return record.json_output?.patient_name || patient_id;
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      getPatientName(record.patient_id, record).toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.diagnosa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.icd10.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(record.timestamp) >= new Date(startDate);
    }
    if (endDate) {
      // Add 1 day to include the end date fully
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      matchesDate = matchesDate && new Date(record.timestamp) < end;
    }

    let matchesStatus = true;
    if (statusGiziFilter !== 'All') {
      const status = record.json_output?.clinical_summary?.nutritional_status?.toLowerCase() || '';
      const filterLower = statusGiziFilter.toLowerCase();
      if (filterLower === 'normal') {
        matchesStatus = status.includes('normal') || status.includes('baik');
      } else if (filterLower === 'kurang') {
        matchesStatus = status.includes('kurang') || status.includes('buruk') || status.includes('kurus');
      } else if (filterLower === 'obesitas') {
        matchesStatus = status.includes('obesitas') || status.includes('lebih');
      }
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper to calculate box style for visualization in detail view
  const getBoxStyle = (box: any) => {
    if (!box || (box.ymin === 0 && box.ymax === 0 && box.xmin === 0 && box.xmax === 0)) return null;
    const top = (box.ymin / 1000) * 100;
    const left = (box.xmin / 1000) * 100;
    const height = ((box.ymax - box.ymin) / 1000) * 100;
    const width = ((box.xmax - box.xmin) / 1000) * 100;
    
    return {
      top: `${top}%`,
      left: `${left}%`,
      height: `${height}%`,
      width: `${width}%`
    };
  };

  const totalRecords = records.length;
  const evaluatedRecords = records.filter(r => r.is_accurate !== undefined && r.is_accurate !== null);
  const accurateRecords = evaluatedRecords.filter(r => r.is_accurate === true);
  const accuracyRate = evaluatedRecords.length > 0 
    ? Math.round((accurateRecords.length / evaluatedRecords.length) * 100) 
    : 0;

  const getPatientHistory = () => {
    if (!selectedRecord) return [];
    return records
      .filter(r => r.patient_id === selectedRecord.patient_id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    
    const appointmentDate = new Date(`${scheduleData.date}T${scheduleData.time}`);
    const appointment = {
      id: Math.random().toString(36).substring(7),
      patient_id: selectedRecord.patient_id,
      patient_name: getPatientName(selectedRecord.patient_id, selectedRecord),
      date: appointmentDate.toISOString(),
      doctor: scheduleData.doctor,
      notes: scheduleData.notes,
      created_at: new Date().toISOString()
    };

    try { await saveAppointment(appointment); }
    catch { window.alert('Janji temu belum tersimpan. Periksa koneksi dan izin akun, lalu coba lagi.'); return; }
    
    // Generate Google Calendar Link
    const endTime = new Date(appointmentDate.getTime() + 60 * 60 * 1000); // 1 hour later
    const formatGCalDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Konsultasi+Follow-up:+${encodeURIComponent(selectedRecord.patient_id)}&dates=${formatGCalDate(appointmentDate)}/${formatGCalDate(endTime)}&details=${encodeURIComponent(scheduleData.notes)}&location=${encodeURIComponent(scheduleData.doctor)}`;
    
    setShowScheduleModal(false);
    setScheduleData({ date: '', time: '', doctor: '', notes: '' });
    
    if (confirm('Jadwal berhasil disimpan! Apakah Anda ingin menambahkannya ke Google Calendar?')) {
      window.open(gcalUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div role="status" className="bg-amber-50 border border-amber-300 p-4 m-4 rounded-xl">Rekam tersimpan adalah catatan/draf yang belum diverifikasi dokter. Hasil AI dan umpan balik pengguna tidak membuktikan diagnosis atau akurasi klinis. Data SQL lama perlu rekonsiliasi oleh administrator.</div>
      <div className="max-w-6xl mx-auto px-4 flex gap-4"><Link href="/clinical-review" className="text-emerald-700 underline">Tinjauan dokter</Link><Link href="/dataset-review" className="text-emerald-700 underline">Tinjauan dataset berizin</Link></div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-2 text-emerald-700">
              <Smile size={24} />
              <h1 className="font-bold text-xl">Dashboard dr Gigi AI</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-all"
              title="Pusat Pengaturan, IoT Hub, SATUSEHAT & Integrasi API"
            >
              <Settings size={15} className="text-slate-600" />
              <span className="hidden sm:inline">Pengaturan & Integrasi</span>
            </Link>
            <LoginButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {role === 'admin' && (
          <div className="flex border-b border-slate-200 mb-8 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setDashboardView('rme')}
              className={`pb-4 px-4 font-medium transition-colors whitespace-nowrap ${
                dashboardView === 'rme' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Rekam Medis (RME)
            </button>
            <button
              onClick={() => setDashboardView('crm')}
              className={`pb-4 px-4 font-medium transition-colors whitespace-nowrap ${
                dashboardView === 'crm' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Super Admin CRM
            </button>
          </div>
        )}

        {!user && (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-emerald-950 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                i
              </div>
              <div>
                <p className="font-semibold text-sm text-emerald-900">Mode Tamu Aktif • Menampilkan Rekam Medis Lokal</p>
                <p className="text-xs text-slate-600 mt-0.5">Hasil pemeriksaan Anda tersimpan di peramban ini. Masuk akun dengan Google untuk sinkronisasi permanen ke Cloud & SATUSEHAT.</p>
              </div>
            </div>
            <LoginButton />
          </div>
        )}

        {dashboardView === 'rme' ? (
          <>
            {/* Accuracy Metrics Banner */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6" suppressHydrationWarning>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Performa Diagnosa AI</h2>
              <p className="text-sm text-slate-500">Berdasarkan umpan balik akurasi dari pengguna</p>
            </div>
          </div>
          <div className="flex gap-8" suppressHydrationWarning>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{mounted ? `${accuracyRate}%` : '0%'}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Tingkat Akurasi</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-700">{mounted ? evaluatedRecords.length : 0}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Dievaluasi</div>
            </div>
            <div className="text-center hidden sm:block">
              <div className="text-3xl font-bold text-slate-700">{mounted ? totalRecords : 0}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Total Rekam Medis</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sidebar List */}
          <div className={`lg:col-span-1 space-y-4 ${isMobileDetailOpen ? 'hidden lg:block' : 'block'}`}>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-24">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-slate-800">Filter Data</h2>
                <div className="flex gap-2">
                    <button 
                      onClick={handleExportJSON}
                      className="text-xs flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-medium transition-colors border border-emerald-200"
                      title="Export semua data ke JSON"
                    >
                      <FileJson size={14} /> Export JSON
                    </button>
                    <button 
                      onClick={handleExportAll}
                      className="text-xs flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium transition-colors border border-indigo-200"
                      title="Export semua data ke ZIP"
                    >
                      <Archive size={14} /> Export ZIP
                    </button>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Cari pasien, diagnosa, ICD-10..." 
                    className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm min-h-[44px] sm:min-h-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Dari Tanggal</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm min-h-[44px] sm:min-h-0"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Sampai Tanggal</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2.5 sm:py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm min-h-[44px] sm:min-h-0"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Status Gizi</label>
                  <select 
                    className="w-full px-3 py-2.5 sm:py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm min-h-[44px] sm:min-h-0 bg-white"
                    value={statusGiziFilter}
                    onChange={(e) => setStatusGiziFilter(e.target.value)}
                  >
                    <option value="All">Semua Status</option>
                    <option value="Normal">Normal / Baik</option>
                    <option value="Kurang">Gizi Kurang / Buruk</option>
                    <option value="Obesitas">Gizi Lebih / Obesitas</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <p>Tidak ada data ditemukan</p>
                  </div>
                ) : (
                  filteredRecords.map(record => (
                    <div 
                      key={record.id}
                      onClick={() => {
                        setSelectedRecord(record);
                        setIsMobileDetailOpen(true);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md flex gap-3 ${
                        selectedRecord?.id === record.id 
                          ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                          : 'bg-white border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={record.image_url} alt="Thumbnail" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-bold text-slate-800 text-sm truncate">
                              {getPatientName(record.patient_id, record)}
                            </span>
                            <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mt-0.5 truncate">
                              {record.type || 'Dental Check-up Umum'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0">
                            {new Date(record.timestamp).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                            record.diagnosa.toLowerCase().includes('sehat') || record.diagnosa.toLowerCase().includes('normal')
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {record.icd10}
                          </span>
                          <span className="text-xs text-slate-600 truncate">
                            {record.diagnosa}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Detail View */}
          <div className={`lg:col-span-2 ${!isMobileDetailOpen ? 'hidden lg:block' : 'block'}`}>
            {selectedRecord ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Detail Header */}
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-start gap-3 w-full sm:w-auto">
                    <button 
                      onClick={() => setIsMobileDetailOpen(false)}
                      className="lg:hidden p-2 -ml-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">Detail Pemeriksaan</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                        <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <Activity size={14} /> {selectedRecord.type || 'Dental Check-up Umum'}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={16} /> {getPatientName(selectedRecord.patient_id, selectedRecord)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={16} /> {formatDate(selectedRecord.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <Link 
                      href="/clinics"
                      className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex items-center gap-1.5 no-underline"
                    >
                      <MapPin size={16} /> Book Appointment
                    </Link>
                    <button 
                      onClick={() => setShowScheduleModal(true)}
                      className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 flex items-center gap-1.5"
                    >
                      <Calendar size={16} /> Jadwalkan
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedRecord.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                      title="Hapus Data"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6 bg-slate-50">
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'report' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Laporan Medis
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Riwayat Pasien
                  </button>
                </div>

                <div className="p-6 bg-white">
                  {activeTab === 'report' ? (
                    <div className="space-y-8" ref={reportRef}>
                      {/* Header for PDF only - hidden in view */}
                      <div className="hidden print-header mb-6 text-center border-b pb-4">
                        <h1 className="text-2xl font-bold text-slate-900">{t('report.titleDashboard')}</h1>
                        <p className="text-slate-500">dr Gigi AI - Healthy Teeth, Healthy Life</p>
                        <div className="mt-2 text-sm text-slate-600 flex justify-center gap-4">
                            <span>{t('report.name')}: {getPatientName(selectedRecord.patient_id, selectedRecord)}</span>
                            <span>{t('report.date')}: {formatDate(selectedRecord.timestamp)}</span>
                        </div>
                      </div>

                      {/* Image & Visualization */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="w-full">
                          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                            <Eye size={18} /> {language === 'en' ? 'Clinical Visualization' : 'Visualisasi Klinis'}
                          </h3>
                          <div className="relative rounded-xl overflow-hidden bg-black border border-slate-200 w-full aspect-video group">
                            {/* Use standard img tag for better compatibility with html2canvas */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={selectedRecord.image_url} 
                              alt="Clinical" 
                              className="w-full h-full object-contain"
                              crossOrigin="anonymous"
                            />
                            
                            {/* Bounding Box Overlay */}
                            {selectedRecord.json_output?.findings?.map((finding: any, index: number) => {
                                const style = getBoxStyle(finding.lokasi_sakit);
                                if (!style) return null;
                                return (
                                    <div 
                                        key={index}
                                        className="absolute border-2 border-red-500 shadow-[0_0_5px_rgba(255,0,0,0.5)] bg-red-500/10"
                                        style={style}
                                    >
                                        <span className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10">
                                            {finding.medis}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Backward Compatibility */}
                            {selectedRecord.json_output?.diagnosa_utama?.lokasi_sakit?.ymin > 0 && !selectedRecord.json_output.findings && (
                              <div 
                                className="absolute border-2 border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.5)] bg-red-500/10"
                                style={getBoxStyle(selectedRecord.json_output.diagnosa_utama.lokasi_sakit) || { display: 'none' }}
                              >
                                <span className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                                  {selectedRecord.diagnosa}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4 w-full">
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Diagnosa Utama</div>
                            <div className="text-lg font-bold text-slate-900">{selectedRecord.diagnosa}</div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-mono rounded">
                                ICD-10: {selectedRecord.icd10}
                              </span>
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded flex items-center gap-1">
                                <Activity size={12} /> Confidence: Belum tervalidasi
                              </span>
                            </div>
                          </div>

                          {selectedRecord.json_output?.findings && selectedRecord.json_output.findings.length > 1 && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Temuan Lainnya</div>
                                <ul className="space-y-2">
                                    {selectedRecord.json_output.findings.slice(1).map((f: any, i: number) => (
                                        <li key={i} className="text-sm flex justify-between">
                                            <span>{f.medis}</span>
                                            <span className="font-mono text-xs bg-slate-200 px-1 rounded">{f.icd10}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                          )}

                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <div className="text-xs text-amber-600 uppercase tracking-wider font-semibold mb-1">Tindakan Diperlukan</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedRecord.json_output?.action_required?.map((action: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-white border border-amber-200 text-amber-800 text-xs rounded-lg shadow-sm">
                                  {action}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Full Report */}
                      <div className="w-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <FileText size={18} /> Laporan Lengkap
                          </h3>
                          <div className="flex gap-2 self-start sm:self-auto">
                            <button 
                              onClick={handleDownloadJSON}
                              className="text-xs flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 sm:py-1.5 rounded-lg font-medium transition-colors border border-slate-200 min-h-[44px] sm:min-h-0"

                        >
                          <FileJson size={14} /> Unduh JSON
                        </button>
                        <button 
                          onClick={handleDownloadPDF}
                          className="text-xs flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2.5 sm:py-1.5 rounded-lg font-medium transition-colors border border-emerald-200 min-h-[44px] sm:min-h-0"
                        >
                          <FileType size={14} /> Unduh PDF
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-sm sm:prose-base prose-slate max-w-none bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200 overflow-x-auto">
                      <ReactMarkdown>{selectedRecord.markdown_report}</ReactMarkdown>
                      
                      {selectedRecord.json_output?.nutrition_metrics && (
                        <div className="mt-8 not-prose">
                          <h3 className="text-lg font-semibold text-slate-800 mb-4">Visualisasi Status Gizi (Z-Score)</h3>
                          <div className="h-64 w-full bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={[
                                  {
                                    name: 'IMT/U',
                                    ZScore: selectedRecord.json_output.nutrition_metrics.imt_z_score || 0,
                                  },
                                  {
                                    name: 'TB/U',
                                    ZScore: selectedRecord.json_output.nutrition_metrics.tb_u_z_score || 0,
                                  },
                                  {
                                    name: 'BB/U',
                                    ZScore: selectedRecord.json_output.nutrition_metrics.bb_u_z_score || 0,
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
                                      { ZScore: selectedRecord.json_output.nutrition_metrics.imt_z_score || 0 },
                                      { ZScore: selectedRecord.json_output.nutrition_metrics.tb_u_z_score || 0 },
                                      { ZScore: selectedRecord.json_output.nutrition_metrics.bb_u_z_score || 0 }
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
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Activity size={20} className="text-emerald-600" /> Riwayat Konsultasi: {getPatientName(selectedRecord.patient_id, selectedRecord)}
                  </h3>
                  <div className="relative border-l-2 border-emerald-100 ml-3 space-y-8">
                    {getPatientHistory().map((historyRecord, index) => (
                      <div key={historyRecord.id} className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white"></div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold text-slate-800">{formatDate(historyRecord.timestamp)}</span>
                            <span className="text-xs font-medium bg-slate-200 text-slate-700 px-2 py-1 rounded-md">
                              {historyRecord.type || 'Pemeriksaan'}
                            </span>
                          </div>
                          <div className="mb-3">
                            <p className="text-sm text-slate-600 font-medium">Diagnosa Utama:</p>
                            <p className="text-sm text-slate-800">{historyRecord.diagnosa}</p>
                          </div>
                          <div className="prose prose-sm prose-slate max-w-none">
                            <ReactMarkdown>
                              {historyRecord.markdown_report.split('### 💡 Rekomendasi Kesehatan')[1] 
                                ? '### Rekomendasi\n' + historyRecord.markdown_report.split('### 💡 Rekomendasi Kesehatan')[1].split('---')[0]
                                : '*Detail rekomendasi tidak tersedia*'}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <LayoutDashboard size={48} className="mb-4 opacity-20" />
                <p className="font-medium">Pilih data pasien dari daftar untuk melihat detail</p>
              </div>
            )}
          </div>
        </div>
          </>
        ) : (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-slate-800">Super Admin CRM</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                  <User size={24} />
                </div>
                <div className="text-3xl font-bold text-slate-800">{users.length}</div>
                <div className="text-sm text-slate-500 mt-1">Total Users</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                  <Activity size={24} />
                </div>
                <div className="text-3xl font-bold text-slate-800">{records.length}</div>
                <div className="text-sm text-slate-500 mt-1">Total RME Records</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <User size={18} className="text-emerald-600" />
                  Daftar Pengguna
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bergabung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.uid || i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="p-4 text-sm font-medium text-slate-800">{u.email}</td>
                        <td className="p-4 text-sm">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'doctor' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {u.role || 'patient'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-500">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-500">
                          Tidak ada pengguna ditemukan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-indigo-600" size={20} /> Jadwalkan Konsultasi
              </h3>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                <input 
                  type="date" 
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={scheduleData.date}
                  onChange={e => setScheduleData({...scheduleData, date: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Waktu</label>
                <input 
                  type="time" 
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={scheduleData.time}
                  onChange={e => setScheduleData({...scheduleData, time: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dokter / Klinik</label>
                <input 
                  type="text" 
                  required
                  placeholder="Nama dokter atau klinik"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={scheduleData.doctor}
                  onChange={e => setScheduleData({...scheduleData, doctor: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea 
                  rows={3}
                  placeholder="Catatan untuk konsultasi..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={scheduleData.notes}
                  onChange={e => setScheduleData({...scheduleData, notes: e.target.value})}
                ></textarea>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Simpan & Buat Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
