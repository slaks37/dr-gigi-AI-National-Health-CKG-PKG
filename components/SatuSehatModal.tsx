'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Send, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  Code2, 
  Building2, 
  X, 
  RefreshCw, 
  AlertCircle, 
  Database,
  Layers,
  ArrowRight,
  User,
  HeartPulse,
  Scale,
  FileCheck
} from 'lucide-react';

interface SatuSehatModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientData: {
    name?: string;
    age?: string;
    height?: string;
    weight?: string;
    headCircumference?: string;
    bloodPressureSystolic?: string;
    bloodPressureDiastolic?: string;
    pulseRate?: string;
    bodyTemperature?: string;
    [key: string]: any;
  };
  diagnosa?: string;
  icd10?: string;
  postureSeverityScore?: number;
  postureCondition?: string;
}

export default function SatuSehatModal({ 
  isOpen, 
  onClose, 
  patientData, 
  diagnosa, 
  icd10,
  postureSeverityScore,
  postureCondition
}: SatuSehatModalProps) {
  const [activeTab, setActiveTab] = useState<'mapping' | 'sync' | 'raw_fhir'>('mapping');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [patientNik, setPatientNik] = useState('3171010101950001');
  const [organizationId, setOrganizationId] = useState('1008271');
  const [practitionerIhs, setPractitionerIhs] = useState('N10000001');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen) return null;

  // Calculate IMT
  const hM = patientData.height ? parseFloat(patientData.height) / 100 : 0;
  const wKg = patientData.weight ? parseFloat(patientData.weight) : 0;
  const imtVal = hM > 0 && wKg > 0 ? (wKg / (hM * hM)).toFixed(1) : '-';

  // FHIR Resource Mapping Schema definitions for preview
  const fhirMappings = [
    {
      resource: 'Patient',
      icon: User,
      field: 'Identitas Pasien',
      loinc_snomed: 'IHS / NIK Kemenkes',
      raw_val: `${patientData.name || 'Pasien'} (${patientData.age || '25'} th)`,
      fhir_target: `Patient.identifier[NIK=${patientNik}]`,
      status: 'Mapped'
    },
    {
      resource: 'Encounter',
      icon: Building2,
      field: 'Kunjungan Poliklinik',
      loinc_snomed: 'SNOMED-CT 308335008',
      raw_val: 'Pemeriksaan Fisik & Antropometri',
      fhir_target: `Encounter.serviceProvider[${organizationId}]`,
      status: 'Mapped'
    },
    {
      resource: 'Observation',
      icon: Scale,
      field: 'Tinggi Badan (Body Height)',
      loinc_snomed: 'LOINC 8302-2',
      raw_val: patientData.height ? `${patientData.height} cm` : 'Belum diisi',
      fhir_target: 'Observation.valueQuantity { value, unit: "cm" }',
      status: patientData.height ? 'Ready' : 'Pending'
    },
    {
      resource: 'Observation',
      icon: Scale,
      field: 'Berat Badan (Body Weight)',
      loinc_snomed: 'LOINC 29463-7',
      raw_val: patientData.weight ? `${patientData.weight} kg` : 'Belum diisi',
      fhir_target: 'Observation.valueQuantity { value, unit: "kg" }',
      status: patientData.weight ? 'Ready' : 'Pending'
    },
    {
      resource: 'Observation',
      icon: Scale,
      field: 'Indeks Massa Tubuh (BMI)',
      loinc_snomed: 'LOINC 39156-5',
      raw_val: imtVal !== '-' ? `${imtVal} kg/m²` : '-',
      fhir_target: 'Observation.valueQuantity { value, unit: "kg/m2" }',
      status: imtVal !== '-' ? 'Ready' : 'Pending'
    },
    {
      resource: 'Observation',
      icon: HeartPulse,
      field: 'Tekanan Darah (Blood Pressure)',
      loinc_snomed: 'LOINC 85354-9',
      raw_val: patientData.bloodPressureSystolic && patientData.bloodPressureDiastolic 
        ? `${patientData.bloodPressureSystolic}/${patientData.bloodPressureDiastolic} mmHg`
        : 'Belum diisi',
      fhir_target: 'Observation.component [8480-6 (Systolic), 8462-4 (Diastolic)]',
      status: patientData.bloodPressureSystolic ? 'Ready' : 'Pending'
    },
    {
      resource: 'Observation',
      icon: Layers,
      field: 'Evaluasi Postur & Tulang Belakang',
      loinc_snomed: 'LOINC 88062-5 / SNOMED 298382003',
      raw_val: `${postureCondition || 'Normal'} (Severity: ${postureSeverityScore || 0}/10)`,
      fhir_target: 'Observation.valueCodeableConcept [Scoliosis/Posture]',
      status: 'Ready'
    },
    {
      resource: 'Condition',
      icon: FileCheck,
      field: 'Diagnosa Klinis / Skrining',
      loinc_snomed: `ICD-10 ${icd10 || 'Z00.00'}`,
      raw_val: diagnosa || 'Pemeriksaan Kesehatan Fisik Komprehensif',
      fhir_target: `Condition.code.coding[ICD-10=${icd10 || 'Z00.00'}]`,
      status: 'Ready'
    }
  ];

  const handleSyncSatuSehat = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const payload = {
        patient_id: `P-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        patient_name: patientData.name || 'Pasien Uji Coba',
        patient_nik: patientNik,
        patient_age: patientData.age || '25',
        clinic_id: organizationId,
        practitioner_id: practitionerIhs,
        environment,
        antropometri: {
          height_cm: patientData.height,
          weight_kg: patientData.weight,
          head_circumference_cm: patientData.headCircumference
        },
        vital_signs: {
          systolic_mmhg: patientData.bloodPressureSystolic || 120,
          diastolic_mmhg: patientData.bloodPressureDiastolic || 80,
          pulse_bpm: patientData.pulseRate || 78,
          temperature_c: patientData.bodyTemperature || 36.6
        },
        posture_finding: {
          condition: postureCondition || 'Normal',
          severity_score: postureSeverityScore || 0
        },
        diagnosa: diagnosa || 'Pemeriksaan Fisik, Skrining Postur & Antropometri',
        icd10: icd10 || 'Z00.00'
      };

      const res = await fetch('/api/satusehat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyinkronkan dengan SATUSEHAT');
      }

      setSyncResult(data);
      setActiveTab('sync');
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat sinkronisasi SATUSEHAT');
    } finally {
      setSyncing(false);
    }
  };

  const copyPayload = () => {
    if (!syncResult) return;
    navigator.clipboard.writeText(JSON.stringify(syncResult.fhir_bundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-cyan-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 text-emerald-300 shadow-inner">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-white">Integrasi SATUSEHAT Kemenkes RI</h2>
                <span className="bg-emerald-400/20 text-emerald-200 text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 font-medium">
                  HL7 FHIR R4 Interoperable
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">
                Pemetaan Rekam Medis Elektronik (RME) Terstandar & Push API Kemenkes (Permenkes No. 24/2022)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2">
          <button
            onClick={() => setActiveTab('mapping')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'mapping'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            1. FHIR Resource Mapping Schema
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'sync'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send size={14} />
            2. Push Data ke SATUSEHAT
          </button>
          <button
            onClick={() => setActiveTab('raw_fhir')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'raw_fhir'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 size={14} />
            3. Raw FHIR R4 Bundle JSON
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: FHIR Resource Mapping Interface */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Database size={16} className="text-emerald-600" />
                    Skema Pemetaan FHIR R4 & Kodifikasi Internasional
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Setiap data antropometri, tanda vital, dan skrining postur dikonversikan ke struktur <code>HL7 FHIR Release 4</code> dengan standar terminologi <strong>LOINC</strong>, <strong>SNOMED-CT</strong>, dan <strong>ICD-10</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg text-xs shrink-0">
                  <span className="font-semibold text-slate-700 px-2">Env:</span>
                  <button
                    onClick={() => setEnvironment('sandbox')}
                    className={`px-2 py-0.5 rounded font-medium ${environment === 'sandbox' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                  >
                    Sandbox
                  </button>
                  <button
                    onClick={() => setEnvironment('production')}
                    className={`px-2 py-0.5 rounded font-medium ${environment === 'production' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                  >
                    Production
                  </button>
                </div>
              </div>

              {/* Mapping Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">FHIR Resource</th>
                      <th className="p-3">Elemen Klinis</th>
                      <th className="p-3">Terminologi / Kode</th>
                      <th className="p-3">Nilai Pasien</th>
                      <th className="p-3">Target Payload FHIR</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fhirMappings.map((map, i) => {
                      const IconComp = map.icon;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-800 flex items-center gap-1.5">
                            <IconComp size={14} className="text-emerald-600" />
                            {map.resource}
                          </td>
                          <td className="p-3 font-medium text-slate-800">{map.field}</td>
                          <td className="p-3 font-mono text-slate-600 bg-slate-50/50">{map.loinc_snomed}</td>
                          <td className="p-3 font-bold text-slate-900">{map.raw_val}</td>
                          <td className="p-3 font-mono text-slate-500 text-[11px] truncate max-w-[200px]" title={map.fhir_target}>
                            {map.fhir_target}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              map.status === 'Ready' || map.status === 'Mapped'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {map.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveTab('sync')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
                >
                  Lanjut ke Push Data SATUSEHAT <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Push Data & Configuration */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Building2 size={14} className="text-emerald-600" />
                    Kredensial Faskes & NIK Pasien (Kemenkes Registry)
                  </h3>
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                    OAuth 2.0 Auth Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">NIK Pasien (IHS Patient)</label>
                    <input
                      type="text"
                      value={patientNik}
                      onChange={(e) => setPatientNik(e.target.value)}
                      placeholder="16 digit NIK Pasien"
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Organization ID (Faskes)</label>
                    <input
                      type="text"
                      value={organizationId}
                      onChange={(e) => setOrganizationId(e.target.value)}
                      placeholder="Contoh: 1008271"
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Practitioner IHS ID (Nakes)</label>
                    <input
                      type="text"
                      value={practitionerIhs}
                      onChange={(e) => setPractitionerIhs(e.target.value)}
                      placeholder="Contoh: N10000001"
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sync Trigger Button */}
              <div>
                <button
                  onClick={handleSyncSatuSehat}
                  disabled={syncing}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      Mengirim Bundle FHIR R4 ke Server SATUSEHAT Kemenkes RI...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Kirim & Sinkronkan Laporan ke SATUSEHAT Kemenkes RI
                    </>
                  )}
                </button>
              </div>

              {/* Result Banner */}
              {syncResult && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      {syncResult.satusehat_status || 'Sinkronisasi Berhasil (HTTP 201 Created)'}
                    </div>
                    <span className="text-[11px] font-mono bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded font-bold">
                      FHIR R4 BUNDLE ACCEPTED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-slate-400 block text-[11px]">SATUSEHAT Bundle ID</span>
                      <span className="font-mono font-bold text-slate-900">{syncResult.satusehat_id}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-slate-400 block text-[11px]">Encounter Reference ID</span>
                      <span className="font-mono font-bold text-slate-900">{syncResult.encounter_id}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-slate-400 block text-[11px]">Observasi Fisik & Postur Tersinkron</span>
                      <span className="font-bold text-emerald-700">{syncResult.synced_observations_count} Resource (TB, BB, IMT, BP, Postur)</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-slate-400 block text-[11px]">Kemenkes IHS Patient ID</span>
                      <span className="font-mono font-bold text-slate-900">{syncResult.patient_ihs || 'P-3171010101950001'}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => setActiveTab('raw_fhir')}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5"
                    >
                      <Code2 size={14} />
                      Buka Payload FHIR R4 Bundle Lengkap
                    </button>

                    <button
                      onClick={copyPayload}
                      className="text-xs font-semibold px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5"
                    >
                      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copied ? 'Tersalin ke Clipboard' : 'Salin JSON'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Raw FHIR R4 Bundle JSON */}
          {activeTab === 'raw_fhir' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-slate-700 flex items-center gap-2">
                  <Code2 size={14} className="text-emerald-600" />
                  Struktur FHIR R4 Bundle Payload (application/fhir+json)
                </h3>
                <button
                  onClick={copyPayload}
                  className="text-xs font-semibold px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 flex items-center gap-1.5"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copied ? 'Tersalin' : 'Salin JSON'}
                </button>
              </div>

              <div className="p-4 bg-slate-900 text-emerald-300 rounded-xl text-xs font-mono overflow-x-auto max-h-[350px] border border-slate-800">
                <pre>{JSON.stringify(syncResult?.fhir_bundle || {
                  resourceType: "Bundle",
                  type: "transaction",
                  entry: fhirMappings.map(m => ({
                    resource: {
                      resourceType: m.resource,
                      code: m.loinc_snomed,
                      target: m.fhir_target,
                      value: m.raw_val
                    }
                  }))
                }, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Legal / SATUSEHAT Guidelines */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-slate-500" />
            <p>
              Sistem ini mematuhi standar interoperabilitas REST API SATUSEHAT Kementerian Kesehatan RI berbasis <code>HL7 FHIR Release 4</code> untuk resource <code>Patient</code>, <code>Encounter</code>, <code>Observation (Vital-Signs & Antropometri)</code>, serta <code>Condition</code> sesuai Permenkes No. 24 Tahun 2022.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <a
            href="https://satusehat.kemkes.go.id/platform/docs/id/interoperability"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium"
          >
            Dokumentasi Resmi SATUSEHAT Kemenkes <ExternalLink size={12} />
          </a>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
