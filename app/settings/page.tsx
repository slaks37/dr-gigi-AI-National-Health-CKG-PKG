'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Settings, 
  Cpu, 
  ShieldCheck, 
  Globe, 
  Type, 
  Contrast, 
  Key, 
  Radio, 
  Server, 
  Database, 
  CheckCircle2, 
  ExternalLink,
  Code,
  Zap,
  Sliders,
  Bell,
  Lock,
  RefreshCw,
  Copy,
  Check,
  Battery,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  Wifi,
  WifiOff,
  RotateCcw,
  Trash2,
  AlertTriangle,
  XCircle,
  CheckCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Search,
  Eye,
  X
} from 'lucide-react';
import { useLanguage } from '../../components/LanguageProvider';
import { useAccessibility } from '../../components/AccessibilityProvider';
import LoginButton from '../../components/LoginButton';
import IoTDeviceHubModal from '../../components/IoTDeviceHubModal';
import SatuSehatModal from '../../components/SatuSehatModal';

export default function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const { textSize, setTextSize, highContrast, setHighContrast } = useAccessibility();

  const [activeSection, setActiveSection] = useState<'iot' | 'satusehat' | 'api' | 'database' | 'accessibility' | 'security'>('iot');
  
  // Modals
  const [isIotModalOpen, setIsIotModalOpen] = useState(false);
  const [isSatuSehatModalOpen, setIsSatuSehatModalOpen] = useState(false);

  // Database Stats & Logs
  const [dbStats, setDbStats] = useState<any>({
    database: { engine: 'PostgreSQL (Cloud SQL / Supabase compatible)', region: 'asia-southeast1', status: 'CONNECTED' },
    stats: { totalUsers: 1, totalRecords: 0, totalAppointments: 0, totalActivityLogs: 0 },
    users: [],
    recentActivityLogs: []
  });
  const [isLoadingDbStats, setIsLoadingDbStats] = useState(false);

  const fetchDbTelemetry = async () => {
    setIsLoadingDbStats(true);
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
      }
    } catch (e) {
      console.warn('Failed to fetch DB stats:', e);
    } finally {
      setIsLoadingDbStats(false);
    }
  };

  React.useEffect(() => {
    fetchDbTelemetry();
  }, []);

  // Settings State
  const [orgId, setOrgId] = useState('10082910');
  const [clientId, setClientId] = useState('satusehat_client_id_live_99214');
  const [clientSecret, setClientSecret] = useState('••••••••••••••••••••••••••••••••');
  const [webhookUrl, setWebhookUrl] = useState('https://faskes.id/api/v1/rme/webhook');
  const [apiKey, setApiKey] = useState('drgigi_live_sec_88491028471928');
  const [autoSyncSatusehat, setAutoSyncSatusehat] = useState(true);
  const [autoPairBle, setAutoPairBle] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Diagnostic IoT Paired Devices
  const [devices, setDevices] = useState([
    {
      id: 'dev-1',
      name: 'Omron HN-289BT Digital Scale',
      type: 'Timbangan Digital',
      mac: 'C4:7E:AB:89:12:01',
      serviceUuid: '0x181D (Weight Scale)',
      battery: 92,
      rssi: -58, // dBm
      firmware: 'v2.4.1-med',
      status: 'online',
      lastTelemetry: '10 detik yang lalu',
      lastValue: '64.5 kg'
    },
    {
      id: 'dev-2',
      name: 'Seca 284 Wireless Stadiometer',
      type: 'Stadiometer Ultrasonik',
      mac: 'E2:15:77:40:99:3F',
      serviceUuid: '0x181C (User Data)',
      battery: 84,
      rssi: -64,
      firmware: 'v1.8.0-pro',
      status: 'online',
      lastTelemetry: '1 menit yang lalu',
      lastValue: '172.0 cm'
    },
    {
      id: 'dev-3',
      name: 'Beurer BM 85 Bluetooth Tensimeter',
      type: 'Tensimeter Digital',
      mac: 'A0:B1:C2:55:88:90',
      serviceUuid: '0x1810 (Blood Pressure)',
      battery: 48,
      rssi: -78,
      firmware: 'v3.1.2-ble',
      status: 'standby',
      lastTelemetry: '12 menit yang lalu',
      lastValue: '118/78 mmHg'
    },
    {
      id: 'dev-4',
      name: 'Nonin 3230 BLE Pulse Oximeter',
      type: 'Oximeter Sensor',
      mac: '74:D0:2B:11:45:67',
      serviceUuid: '0x1822 (Pulse Oximeter)',
      battery: 18,
      rssi: -86,
      firmware: 'v1.2.4-lite',
      status: 'low_battery',
      lastTelemetry: '25 menit yang lalu',
      lastValue: '99% SpO2 | 72 bpm'
    },
    {
      id: 'dev-5',
      name: 'DrGigi Micro ESP32 Gateway Node',
      type: 'Bridge IoT Faskes',
      mac: '24:6F:28:9C:14:B8',
      serviceUuid: '0xFFE0 (Custom UART)',
      battery: 100, // AC Powered
      rssi: -42,
      firmware: 'v4.0.0-esp32-freertos',
      status: 'online',
      lastTelemetry: 'Baru saja',
      lastValue: 'Telemetry Relay Active'
    }
  ]);

  const [isPingingDevices, setIsPingingDevices] = useState(false);

  const handlePingDiagnostics = () => {
    setIsPingingDevices(true);
    setTimeout(() => {
      setDevices(prev => prev.map(d => ({
        ...d,
        lastTelemetry: 'Baru saja',
        rssi: Math.min(-40, Math.max(-90, d.rssi + Math.floor(Math.random() * 7 - 3)))
      })));
      setIsPingingDevices(false);
    }, 1200);
  };

  // SATUSEHAT Sync Log History
  const [syncLogs, setSyncLogs] = useState([
    {
      id: 'log-101',
      timestamp: '30 Agu 2026, 09:42:15',
      patientName: 'Ananda Rizky (NIK: 3171028309190001)',
      resourceType: 'Observation (Weight & Height)',
      loincCode: '29463-7 / 8302-2',
      fhirId: 'obs-weight-99210-482',
      statusCode: 201,
      statusText: 'Created',
      errorDetail: null,
      rawPayload: '{"resourceType":"Observation","status":"final","code":{"coding":[{"system":"http://loinc.org","code":"29463-7","display":"Body weight"}]},"valueQuantity":{"value":64.5,"unit":"kg"}}'
    },
    {
      id: 'log-102',
      timestamp: '30 Agu 2026, 09:42:16',
      patientName: 'Ananda Rizky (NIK: 3171028309190001)',
      resourceType: 'Observation (Spinal Posture Cobb Angle)',
      loincCode: '96766-1 (Thoracolumbar spine Cobb angle)',
      fhirId: 'obs-cobb-angle-33910',
      statusCode: 201,
      statusText: 'Created',
      errorDetail: null,
      rawPayload: '{"resourceType":"Observation","code":{"coding":[{"system":"http://loinc.org","code":"96766-1"}]},"valueQuantity":{"value":4.2,"unit":"deg"}}'
    },
    {
      id: 'log-103',
      timestamp: '30 Agu 2026, 09:30:08',
      patientName: 'Siti Rahmawati (NIK: 3174095810290003)',
      resourceType: 'Condition (ICD-10 M41.9)',
      loincCode: 'SNOMED 203639008 (Scoliosis)',
      fhirId: null,
      statusCode: 422,
      statusText: 'Unprocessable Entity',
      errorDetail: 'ERR_FHIR_422_SUBJECT_REFERENCE: Patient resource reference ID not found in SATUSEHAT Master Patient Index. Pastikan NIK terdaftar di Dukcapil.',
      rawPayload: '{"resourceType":"Condition","code":{"coding":[{"system":"http://hl7.org/fhir/sid/icd-10","code":"M41.9"}]},"subject":{"reference":"Patient/NIK-3174095810290003"}}'
    },
    {
      id: 'log-104',
      timestamp: '30 Agu 2026, 09:15:22',
      patientName: 'Budi Santoso (NIK: 3172081905820002)',
      resourceType: 'Encounter (Rawat Jalan Poli Spesialis)',
      loincCode: 'AMB (Ambulatory)',
      fhirId: 'enc-poliklinik-88401',
      statusCode: 200,
      statusText: 'Updated',
      errorDetail: null,
      rawPayload: '{"resourceType":"Encounter","status":"finished","class":{"system":"http://terminology.hl7.org/CodeSystem/v3-ActCode","code":"AMB"}}'
    },
    {
      id: 'log-105',
      timestamp: '30 Agu 2026, 08:50:41',
      patientName: 'Dewi Lestari (NIK: 3201089201930005)',
      resourceType: 'Observation (Blood Pressure)',
      loincCode: '85354-9 (Blood pressure panel)',
      fhirId: null,
      statusCode: 401,
      statusText: 'Unauthorized',
      errorDetail: 'ERR_AUTH_TOKEN_EXPIRED: OAuth2 Bearer Access Token Kemenkes expired. Silakan periksa kembali Client ID & Secret faskes.',
      rawPayload: '{"resourceType":"Observation","code":{"coding":[{"system":"http://loinc.org","code":"85354-9"}]}}'
    }
  ]);

  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(null);

  const handleRetrySync = (logId: string) => {
    setRetryingLogId(logId);
    setTimeout(() => {
      setSyncLogs(prev => prev.map(item => {
        if (item.id === logId) {
          return {
            ...item,
            statusCode: 201,
            statusText: 'Created (Retried)',
            fhirId: `obs-retried-${Math.floor(10000 + Math.random() * 90000)}`,
            errorDetail: null,
            timestamp: 'Baru saja'
          };
        }
        return item;
      }));
      setRetryingLogId(null);
    }, 1500);
  };

  const handleClearLogs = () => {
    setSyncLogs([]);
  };

  const filteredLogs = syncLogs.filter(log => {
    if (logFilter === 'success') return log.statusCode >= 200 && log.statusCode < 300;
    if (logFilter === 'failed') return log.statusCode >= 400;
    return true;
  });

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-slate-600 hover:text-emerald-600 transition-colors font-semibold text-sm">
              <ArrowLeft size={18} />
              <span>Kembali</span>
            </Link>
            <div className="h-5 w-[1px] bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <Settings size={18} />
              </div>
              <h1 className="font-bold text-base sm:text-lg text-slate-800">
                Pusat Pengaturan & Integrasi Medis
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hidden sm:block">
              Dashboard RME
            </Link>
            <LoginButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {saveSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <span className="text-sm font-semibold">Pengaturan integrasi berhasil disimpan & disinkronkan!</span>
            </div>
            <button onClick={() => setSaveSuccess(false)} className="text-xs font-bold text-emerald-700 hover:underline">Tutup</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar Menu */}
          <aside className="md:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1.5 sticky top-24">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Konektivitas & Integrasi
            </div>

            <button
              onClick={() => setActiveSection('iot')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeSection === 'iot'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Cpu size={18} className={activeSection === 'iot' ? 'text-blue-600' : 'text-slate-400'} />
                <span>Hub Perangkat IoT Medis</span>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">BLE/GATT</span>
            </button>

            <button
              onClick={() => setActiveSection('satusehat')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeSection === 'satusehat'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={18} className={activeSection === 'satusehat' ? 'text-emerald-600' : 'text-slate-400'} />
                <span>SATUSEHAT Kemenkes RI</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">FHIR R4</span>
            </button>

            <button
              onClick={() => setActiveSection('api')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeSection === 'api'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Key size={18} className={activeSection === 'api' ? 'text-purple-600' : 'text-slate-400'} />
                <span>API & Webhook Gateway</span>
              </div>
              <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">REST</span>
            </button>

            <button
              onClick={() => {
                setActiveSection('database');
                fetchDbTelemetry();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeSection === 'database'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Database size={18} className={activeSection === 'database' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Database & Supabase / SQL</span>
              </div>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">PostgreSQL</span>
            </button>

            <div className="pt-3 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100">
              Preferensi Aplikasi
            </div>

            <button
              onClick={() => setActiveSection('accessibility')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeSection === 'accessibility'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe size={18} className={activeSection === 'accessibility' ? 'text-amber-600' : 'text-slate-400'} />
                <span>Bahasa & Aksesibilitas</span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('security')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeSection === 'security'
                  ? 'bg-slate-100 text-slate-900 border border-slate-300 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Lock size={18} className="text-slate-400" />
                <span>Keamanan & Hak Akses</span>
              </div>
            </button>
          </aside>

          {/* Content Pane */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Section 1: IoT Medis */}
            {activeSection === 'iot' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Cpu className="text-blue-600" size={22} />
                      Hub Perangkat Medis & Telemetri IoT
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Koneksikan instrumen antropometri digital (Timbangan, Stadiometer, Tensimeter, Oximeter) melalui Web Bluetooth BLE atau REST Gateway.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePingDiagnostics}
                      disabled={isPingingDevices}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all"
                      title="Periksa level baterai dan sinyal perangkat secara real-time"
                    >
                      <RefreshCw size={14} className={isPingingDevices ? 'animate-spin text-blue-600' : ''} />
                      <span>{isPingingDevices ? 'Memindai...' : 'Ping Diagnostik'}</span>
                    </button>
                    <button
                      onClick={() => setIsIotModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                    >
                      <Zap size={15} />
                      Buka Hub & SDK
                    </button>
                  </div>
                </div>

                {/* IoT Diagnostic Card */}
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/70 via-white to-slate-50 p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-blue-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <Activity size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Diagnostik Perangkat Medis Terpasang (Hardware Health)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Monitoring level daya baterai, kekuatan sinyal Bluetooth (RSSI), dan versi firmware instrumen.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        4/5 Terhubung
                      </span>
                    </div>
                  </div>

                  {/* Device Diagnostic Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    {devices.map((dev) => {
                      const isLowBattery = dev.battery <= 20 && dev.battery !== 100;
                      const isMediumBattery = dev.battery > 20 && dev.battery <= 50;
                      
                      // RSSI signal bar calculation
                      const getSignalQuality = (rssi: number) => {
                        if (rssi >= -60) return { label: 'Sangat Kuat', bars: 4, color: 'text-emerald-600 bg-emerald-500' };
                        if (rssi >= -70) return { label: 'Kuat', bars: 3, color: 'text-blue-600 bg-blue-500' };
                        if (rssi >= -80) return { label: 'Sedang', bars: 2, color: 'text-amber-600 bg-amber-500' };
                        return { label: 'Lemah', bars: 1, color: 'text-rose-600 bg-rose-500' };
                      };

                      const sig = getSignalQuality(dev.rssi);

                      return (
                        <div 
                          key={dev.id}
                          className={`p-4 rounded-xl border transition-all ${
                            dev.status === 'low_battery' 
                              ? 'bg-rose-50/40 border-rose-200' 
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          } shadow-xs space-y-3`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                dev.status === 'low_battery'
                                  ? 'bg-rose-100 text-rose-700'
                                  : dev.status === 'standby'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                <Cpu size={18} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-slate-800">{dev.name}</span>
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                    {dev.type}
                                  </span>
                                  {dev.status === 'online' && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                      Online
                                    </span>
                                  )}
                                  {dev.status === 'standby' && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                      Standby
                                    </span>
                                  )}
                                  {dev.status === 'low_battery' && (
                                    <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                      <AlertTriangle size={10} /> Baterai Lemah
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-3">
                                  <span>MAC: {dev.mac}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="hidden sm:inline">GATT: {dev.serviceUuid}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right sm:text-right">
                              <div className="text-xs font-semibold text-slate-700">Data Terakhir:</div>
                              <div className="text-xs font-mono font-bold text-blue-700">{dev.lastValue}</div>
                            </div>
                          </div>

                          {/* Diagnostic Metrics: Battery, Signal, Firmware */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                            
                            {/* Battery Diagnostic */}
                            <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                              isLowBattery 
                                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                                : isMediumBattery 
                                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                              <div className="flex items-center gap-2">
                                {dev.battery === 100 ? (
                                  <Zap size={16} className="text-amber-500" />
                                ) : isLowBattery ? (
                                  <BatteryWarning size={16} className="text-rose-600 animate-pulse" />
                                ) : isMediumBattery ? (
                                  <BatteryMedium size={16} className="text-amber-600" />
                                ) : (
                                  <Battery size={16} className="text-emerald-600" />
                                )}
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-slate-500">Level Daya</div>
                                  <div className="text-xs font-bold font-mono">
                                    {dev.battery === 100 ? 'AC 220V (Daya Listrik)' : `${dev.battery}% Kapasitas`}
                                  </div>
                                </div>
                              </div>

                              {dev.battery !== 100 && (
                                <div className="w-12 bg-slate-200 h-2 rounded-full overflow-hidden shrink-0">
                                  <div 
                                    className={`h-full ${
                                      isLowBattery ? 'bg-rose-500' : isMediumBattery ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${dev.battery}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Signal Strength (RSSI) Diagnostic */}
                            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Wifi size={16} className={sig.color.split(' ')[0]} />
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-slate-500">Sinyal BLE (RSSI)</div>
                                  <div className="text-xs font-bold font-mono text-slate-800">
                                    {dev.rssi} dBm <span className="text-[10px] font-sans font-normal text-slate-500">({sig.label})</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-end gap-0.5 h-4">
                                {[1, 2, 3, 4].map((bar) => (
                                  <div
                                    key={bar}
                                    className={`w-1 rounded-xs ${
                                      bar <= sig.bars ? sig.color.split(' ')[1] : 'bg-slate-200'
                                    }`}
                                    style={{ height: `${bar * 25}%` }}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Firmware Version */}
                            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Code size={16} className="text-purple-600" />
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-slate-500">Firmware Medis</div>
                                  <div className="text-xs font-mono font-bold text-purple-700">
                                    {dev.firmware}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-semibold">
                                Valid
                              </span>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-bold text-slate-800">Opsi Konektivitas & Otomatisasi Perangkat</h3>
                  
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Pemindaian BLE Otomatis saat Form Terbuka</div>
                      <div className="text-xs text-slate-500">Mencoba mendeteksi timbangan & stadiometer aktif saat membuka form pemeriksaan.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={autoPairBle} 
                      onChange={(e) => setAutoPairBle(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded cursor-pointer accent-blue-600"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-slate-200 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>SDK Microcontroller / Firmware Snippet (ESP32 / Arduino BLE GATT)</span>
                    <button 
                      onClick={() => setIsIotModalOpen(true)}
                      className="text-blue-400 hover:underline flex items-center gap-1 font-sans text-xs"
                    >
                      Lihat Semua SDK <ExternalLink size={12} />
                    </button>
                  </div>
                  <pre className="overflow-x-auto text-[11px] text-emerald-400 p-2 bg-black/40 rounded-lg">
{`#include <BLEDevice.h>
#define SERVICE_UUID "0000181d-0000-1000-8000-00805f9b34fb"
// Transmisi telemetri otomatis timbangan & stadiometer ke dr Gigi AI Hub`}
                  </pre>
                </div>
              </div>
            )}

            {/* Section 2: SATUSEHAT Kemenkes */}
            {activeSection === 'satusehat' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <ShieldCheck className="text-emerald-600" size={22} />
                      Integrasi Rekam Medis SATUSEHAT Kemenkes RI
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Standar HL7 FHIR R4 & Permenkes No. 24/2022 untuk interoperabilitas data antropometri dan diagnosa klinis nasional.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSatuSehatModalOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                  >
                    <ShieldCheck size={15} />
                    Buka Schema Bridge
                  </button>
                </div>

                {/* Configuration Credentials */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Organization ID Faskes (Kemenkes)
                    </label>
                    <input 
                      type="text" 
                      value={orgId} 
                      onChange={(e) => setOrgId(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                      placeholder="Contoh: 10082910"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Client ID (OAuth2)
                      </label>
                      <input 
                        type="text" 
                        value={clientId} 
                        onChange={(e) => setClientId(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Client Secret
                      </label>
                      <input 
                        type="password" 
                        value={clientSecret} 
                        onChange={(e) => setClientSecret(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Sinkronisasi Otomatis FHIR R4 setelah Analisis</div>
                      <div className="text-xs text-slate-500">Mempersiapkan Resource Observation (LOINC 8302-2, 29463-7) & Condition secara otomatis.</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={autoSyncSatusehat} 
                      onChange={(e) => setAutoSyncSatusehat(e.target.checked)}
                      className="w-5 h-5 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                    />
                  </div>
                </div>

                {/* SATUSEHAT Sync Log History Table */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">
                          Riwayat Log Sinkronisasi FHIR R4 (SATUSEHAT Sync Log)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Audit trail transmisi resource medis, status respon HTTP Kemenkes, dan identifikasi error code.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                        <button
                          onClick={() => setLogFilter('all')}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            logFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Semua ({syncLogs.length})
                        </button>
                        <button
                          onClick={() => setLogFilter('success')}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            logFilter === 'success' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Sukses
                        </button>
                        <button
                          onClick={() => setLogFilter('failed')}
                          className={`px-2.5 py-1 rounded-md transition-all ${
                            logFilter === 'failed' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Gagal ({syncLogs.filter(l => l.statusCode >= 400).length})
                        </button>
                      </div>

                      <button
                        onClick={handleClearLogs}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Bersihkan Log Riwayat"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Logs Table */}
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Tidak ada data riwayat log sinkronisasi yang sesuai dengan filter.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500">
                            <th className="py-2.5 px-3">Waktu & Pasien</th>
                            <th className="py-2.5 px-3">Resource FHIR</th>
                            <th className="py-2.5 px-3">Status HTTP</th>
                            <th className="py-2.5 px-3">FHIR ID / Error</th>
                            <th className="py-2.5 px-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredLogs.map((log) => {
                            const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                            const isRetrying = retryingLogId === log.id;

                            return (
                              <tr key={log.id} className={`hover:bg-slate-50/80 transition-colors ${
                                !isSuccess ? 'bg-rose-50/20' : ''
                              }`}>
                                <td className="py-3 px-3 align-top">
                                  <div className="font-semibold text-slate-800">{log.patientName}</div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{log.timestamp}</div>
                                </td>

                                <td className="py-3 px-3 align-top">
                                  <div className="font-bold text-slate-700">{log.resourceType}</div>
                                  <div className="text-[11px] text-emerald-700 font-mono mt-0.5">{log.loincCode}</div>
                                </td>

                                <td className="py-3 px-3 align-top">
                                  {isSuccess ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 size={12} className="text-emerald-600" />
                                      {log.statusCode} {log.statusText}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      <XCircle size={12} className="text-rose-600" />
                                      {log.statusCode} {log.statusText}
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 align-top max-w-xs">
                                  {isSuccess ? (
                                    <div className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block">
                                      {log.fhirId}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-rose-700 font-medium bg-rose-50 border border-rose-200 p-2 rounded-lg space-y-1">
                                      <div className="font-bold font-mono text-[10px] text-rose-900">
                                        {log.errorDetail?.split(':')[0]}
                                      </div>
                                      <p className="text-[10px] leading-tight text-rose-700">
                                        {log.errorDetail?.split(':')[1] || log.errorDetail}
                                      </p>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-3 align-top text-right space-y-1">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setSelectedLogPayload(log)}
                                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                      title="Lihat Payload JSON Resource"
                                    >
                                      <Eye size={12} />
                                      JSON
                                    </button>

                                    {!isSuccess && (
                                      <button
                                        onClick={() => handleRetrySync(log.id)}
                                        disabled={isRetrying}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all"
                                        title="Kirim Ulang ke Endpoint SATUSEHAT"
                                      >
                                        <RotateCcw size={12} className={isRetrying ? 'animate-spin' : ''} />
                                        {isRetrying ? 'Mengirim...' : 'Retry'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs text-emerald-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-emerald-700" />
                    Kamus Standar Medis Aktif
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    Sistem secara otomatis mengonversi hasil skrining foto dan antropometri ke <strong>LOINC</strong> (Tinggi, Berat, IMT, Sumbu Vertebra), <strong>SNOMED-CT</strong>, dan kode diagnosa <strong>ICD-10</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Section 3: API & Webhook */}
            {activeSection === 'api' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="pb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Key className="text-purple-600" size={22} />
                    API & Webhook Gateway External RME
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Hubungkan database SIMRS faskes internal atau aplikasi pihak ketiga melalui REST API terenkripsi.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Secret API Key
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={apiKey} 
                        className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-mono text-slate-700 select-all" 
                      />
                      <button
                        onClick={handleCopyKey}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copiedKey ? 'Disalin' : 'Salin Key'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Webhook URL Endpoint (SIMRS)
                    </label>
                    <input 
                      type="url" 
                      value={webhookUrl} 
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                      placeholder="https://faskes.com/api/webhook"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-slate-200 space-y-2 font-mono text-xs">
                  <div className="text-slate-400">cURL Trigger Test Endpoint:</div>
                  <pre className="text-purple-300 overflow-x-auto text-[11px]">
{`curl -X POST https://ais-pre-73s67y7jwz2ymxlaq2fhjk-359954748179.asia-east1.run.app/api/iot/telemetry \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Token: ${apiKey}" \\
  -d '{"weight_kg": 64.5, "height_cm": 172.0, "systolic_mmhg": 118}'`}
                  </pre>
                </div>
              </div>
            )}

            {/* Section 4: Accessibility & Language */}
            {activeSection === 'accessibility' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="pb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Globe className="text-amber-600" size={22} />
                    Bahasa & Aksesibilitas
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan bahasa dan kenyamanan visual membaca laporan medis.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Globe size={20} className="text-slate-500" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Bahasa Tampilan (Language)</div>
                        <div className="text-xs text-slate-500">Pilih bahasa untuk navigasi dan laporan medis</div>
                      </div>
                    </div>
                    <select 
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value as any)} 
                      className="border border-slate-300 rounded-xl p-2 text-sm bg-slate-50 font-medium"
                    >
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English (US)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Type size={20} className="text-slate-500" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Ukuran Font Laporan</div>
                        <div className="text-xs text-slate-500">Mengubah skala teks pada seluruh halaman</div>
                      </div>
                    </div>
                    <select 
                      value={textSize} 
                      onChange={(e) => setTextSize(e.target.value as any)} 
                      className="border border-slate-300 rounded-xl p-2 text-sm bg-slate-50 font-medium"
                    >
                      <option value="small">Kecil (Compact)</option>
                      <option value="medium">Sedang (Standar)</option>
                      <option value="large">Besar (Readability)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <Contrast size={20} className="text-slate-500" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Mode Kontras Tinggi</div>
                        <div className="text-xs text-slate-500">Meningkatkan keterbacaan teks dan batas elemen</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setHighContrast(!highContrast)} 
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        highContrast ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {highContrast ? 'Aktif' : 'Non-Aktif'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Database & SQL / Supabase */}
            {activeSection === 'database' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Database className="text-indigo-600" size={22} />
                      Database Relasional & Cloud Persistence
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Integrasi PostgreSQL (Cloud SQL & Supabase Compatible) untuk menyimpan data user terdaftar, riwayat antropometri, rekam medis (RME), dan log aktivitas seluruh penggunaan aplikasi.
                    </p>
                  </div>
                  <button
                    onClick={fetchDbTelemetry}
                    disabled={isLoadingDbStats}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <RefreshCw size={13} className={isLoadingDbStats ? 'animate-spin' : ''} />
                    <span>Perbarui Data</span>
                  </button>
                </div>

                {/* Connection Status Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Database Engine</div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Server size={16} className="text-indigo-600" />
                      PostgreSQL v16 (Relational)
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Status: {dbStats?.database?.status || 'CONNECTED'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Region & Latensi</div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe size={16} className="text-blue-600" />
                      asia-southeast1 (Jakarta)
                    </div>
                    <div className="text-[11px] text-slate-500">Pooling: pg.Pool (Max 10)</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Keamanan & ORM</div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      Drizzle ORM + SSL/TLS
                    </div>
                    <div className="text-[11px] text-slate-500">Dual-Write: SQL + Firestore</div>
                  </div>
                </div>

                {/* Database Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
                    <div className="text-xs text-indigo-700 font-semibold">User Terdaftar</div>
                    <div className="text-2xl font-black text-indigo-950 mt-1">{dbStats?.stats?.totalUsers ?? 1}</div>
                    <div className="text-[10px] text-indigo-600 mt-0.5">Tabel: users</div>
                  </div>
                  <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
                    <div className="text-xs text-emerald-700 font-semibold">Rekam Medis (RME)</div>
                    <div className="text-2xl font-black text-emerald-950 mt-1">{dbStats?.stats?.totalRecords ?? 0}</div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">Tabel: medical_records</div>
                  </div>
                  <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50">
                    <div className="text-xs text-purple-700 font-semibold">Janji Temu Poli</div>
                    <div className="text-2xl font-black text-purple-950 mt-1">{dbStats?.stats?.totalAppointments ?? 0}</div>
                    <div className="text-[10px] text-purple-600 mt-0.5">Tabel: appointments</div>
                  </div>
                  <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50">
                    <div className="text-xs text-amber-800 font-semibold">Log Penggunaan</div>
                    <div className="text-2xl font-black text-amber-950 mt-1">{dbStats?.stats?.totalActivityLogs ?? 0}</div>
                    <div className="text-[10px] text-amber-700 mt-0.5">Tabel: activity_logs</div>
                  </div>
                </div>

                {/* Registered Users List from DB */}
                {dbStats?.users && dbStats.users.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Daftar Pengguna Tersimpan di Database
                      </h3>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {dbStats.users.length} Akun Terdaftar
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                            <th className="py-2.5 px-3">Pengguna</th>
                            <th className="py-2.5 px-3">Role</th>
                            <th className="py-2.5 px-3">User UID</th>
                            <th className="py-2.5 px-3 text-right">Terakhir Aktif</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dbStats.users.map((u: any, idx: number) => (
                            <tr key={u.uid || idx} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {u.displayName || u.email.split('@')[0]}
                                <div className="text-[11px] font-normal text-slate-500 font-mono">{u.email}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  u.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {u.role || 'user'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                {u.uid?.substring(0, 14)}...
                              </td>
                              <td className="py-2.5 px-3 text-right text-[11px] text-slate-500">
                                {u.lastActive ? new Date(u.lastActive).toLocaleString('id-ID') : 'Baru saja'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Live Activity & Usage Logs Table */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={14} className="text-indigo-600" />
                      Live Usage & Activity Audit Trail (activity_logs)
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium">Tersimpan Otomatis di PostgreSQL</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Waktu</th>
                            <th className="py-2.5 px-3">Modul</th>
                            <th className="py-2.5 px-3">Aksi / Event</th>
                            <th className="py-2.5 px-3">User UID</th>
                            <th className="py-2.5 px-3">Detail Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {dbStats?.recentActivityLogs && dbStats.recentActivityLogs.length > 0 ? (
                            dbStats.recentActivityLogs.map((log: any, idx: number) => (
                              <tr key={log.id || idx} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                  {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('id-ID') : '-'}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                    {log.module}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {log.action}
                                </td>
                                <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">
                                  {log.userEmail || log.userUid}
                                </td>
                                <td className="py-2 px-3 text-slate-600 truncate max-w-[200px]" title={log.details}>
                                  {log.details || '-'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                                Belum ada log aktivitas. Setiap tindakan (skrining, konsultasi, janji temu) akan tercatat di sini secara otomatis.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Section 5: Security */}
            {activeSection === 'security' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="pb-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Lock className="text-slate-700" size={22} />
                    Keamanan Data & Privasi Medis
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Enkripsi dan perlindungan data rekam medis pasien sesuai standar kepatuhan medis.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-800">Enkripsi End-to-End & Standar HIPAA / Permenkes</div>
                  <p className="leading-relaxed">
                    Seluruh rekaman foto antropometri dan data diagnostik diproses melalui jalur terenkripsi HTTPS/TLS 1.3 dan disimpan dengan perlindungan Firebase Security Rules berbasis Role (Dokter, Admin, Pasien).
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Save Action */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <span className="text-xs text-slate-500">Perubahan konfigurasi berlaku instan di seluruh modul.</span>
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={18} />
                Simpan Pengaturan
              </button>
            </div>

          </div>

        </div>

      </main>

      {/* Global Modals for IoT & SATUSEHAT */}
      <IoTDeviceHubModal 
        isOpen={isIotModalOpen} 
        onClose={() => setIsIotModalOpen(false)}
        onApplyData={() => {}}
      />

      <SatuSehatModal
        isOpen={isSatuSehatModalOpen}
        onClose={() => setIsSatuSehatModalOpen(false)}
      />

      {/* JSON Payload Inspector Modal */}
      {selectedLogPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Code size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">FHIR R4 Raw JSON Payload</h3>
                  <p className="text-[11px] text-slate-500">{selectedLogPayload.resourceType} • {selectedLogPayload.timestamp}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLogPayload(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Pasien: {selectedLogPayload.patientName}</span>
                <span className="font-mono text-emerald-700 font-bold">{selectedLogPayload.statusCode} {selectedLogPayload.statusText}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
                <pre>{JSON.stringify(JSON.parse(selectedLogPayload.rawPayload), null, 2)}</pre>
              </div>

              {selectedLogPayload.errorDetail && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-rose-900">
                    <AlertTriangle size={14} /> Diagnostic Error Details:
                  </div>
                  <p className="font-mono text-[11px] text-rose-700 leading-relaxed">
                    {selectedLogPayload.errorDetail}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedLogPayload.rawPayload);
                }}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Copy size={13} />
                Salin JSON
              </button>
              <button
                onClick={() => setSelectedLogPayload(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
