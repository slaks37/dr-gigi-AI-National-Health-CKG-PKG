'use client';

import React, { useState } from 'react';
import { 
  Cpu, 
  Wifi, 
  Bluetooth, 
  CheckCircle2, 
  Copy, 
  Check, 
  Activity, 
  ArrowRight, 
  Send, 
  Code, 
  BookOpen, 
  Layers, 
  X, 
  RefreshCw, 
  Gauge, 
  Zap 
} from 'lucide-react';

interface IoTTelemetryData {
  weight_kg?: number;
  height_cm?: number;
  systolic_mmhg?: number;
  diastolic_mmhg?: number;
  pulse_bpm?: number;
  spo2_percent?: number;
  temperature_c?: number;
  head_circumference_cm?: number;
}

interface IoTDeviceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyData: (data: IoTTelemetryData) => void;
}

export default function IoTDeviceHubModal({ isOpen, onClose, onApplyData }: IoTDeviceHubModalProps) {
  const [activeTab, setActiveTab] = useState<'devices' | 'sdk' | 'mqtt_rest'>('devices');
  const [selectedSdkLang, setSelectedSdkLang] = useState<'esp32' | 'python' | 'nodejs' | 'curl'>('esp32');
  const [copied, setCopied] = useState(false);
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [btStatus, setBtStatus] = useState<string | null>(null);

  // Simulated IoT devices state
  const [deviceMeasurements, setDeviceMeasurements] = useState<IoTTelemetryData>({
    weight_kg: 58.5,
    height_cm: 165.0,
    systolic_mmhg: 120,
    diastolic_mmhg: 80,
    pulse_bpm: 78,
    spo2_percent: 98,
    temperature_c: 36.6,
    head_circumference_cm: 54.0
  });

  const [connectedDevices, setConnectedDevices] = useState([
    { id: 'SCALE-BT-092', name: 'Smart Digital Scale v2', type: 'scale', status: 'online', protocol: 'BLE / GATT 0x181D', battery: '92%' },
    { id: 'STADIO-WIFI-11', name: 'Ultrasonic Stadiometer IoT', type: 'stadiometer', status: 'online', protocol: 'HTTP REST / WiFi', battery: '100%' },
    { id: 'BP-OMRON-IOT', name: 'Smart Blood Pressure Monitor', type: 'blood_pressure', status: 'online', protocol: 'BLE / GATT 0x1810', battery: '85%' },
    { id: 'OXI-PULSE-44', name: 'Pulse Oximeter & Temp IR', type: 'oximeter', status: 'standby', protocol: 'MQTT / TLS', battery: '76%' }
  ]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToForm = () => {
    onApplyData(deviceMeasurements);
    onClose();
  };

  // Web Bluetooth Integration (Browser Native)
  const handleConnectBluetooth = async () => {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!nav || !nav.bluetooth) {
      setBtStatus('Web Bluetooth API tidak didukung di browser ini. Gunakan Chrome/Edge di desktop atau Android.');
      return;
    }

    try {
      setIsScanningBt(true);
      setBtStatus('Mencari perangkat BLE kesehatan sekitar (Smart Scale, Tensimeter, Oximeter)...');
      
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'weight_scale', 
          'blood_pressure', 
          'pulse_oximeter', 
          'health_thermometer',
          0x181D, 
          0x1810, 
          0x1822, 
          0x1809
        ]
      });

      setBtStatus(`Terhubung ke perangkat: ${device.name || 'Unknown Device'} (${device.id})`);
      setConnectedDevices(prev => [
        {
          id: device.id.substring(0, 10),
          name: device.name || 'BLE Health Sensor',
          type: 'scale',
          status: 'online',
          protocol: 'Web Bluetooth GATT',
          battery: '100%'
        },
        ...prev
      ]);
    } catch (err: any) {
      console.warn('Bluetooth pairing cancelled or failed:', err);
      setBtStatus(err.message || 'Pencarian Bluetooth dibatalkan.');
    } finally {
      setIsScanningBt(false);
    }
  };

  const codeSnippets = {
    esp32: `// =================================================================
// SDK dr Gigi AI - ESP32 / Arduino C++ IoT Health Gateway
// Mengirim data Antropometri & Tanda Vital langsung via WiFi HTTP POST
// =================================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "NAMA_WIFI_KLINIK";
const char* password = "PASSWORD_WIFI";
const char* serverUrl = "https://YOUR_APP_URL/api/iot/ingest";
const char* deviceToken = "DRGIGI_DEV_SECRET_TOKEN_9921";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Terhubung ke dr Gigi AI IoT Hub!");
}

void loop() {
  // 1. Baca sensor (misal Load Cell HX711 & Ultrasonic HC-SR04)
  float beratBadanKg = 58.50;    // Contoh hasil baca timbangan
  float tinggiBadanCm = 165.00;  // Contoh hasil baca stadiometer
  int sistolik = 120;
  int diastolik = 80;
  int denyutNadi = 78;

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Token", deviceToken);

    StaticJsonDocument<512> doc;
    doc["device_id"] = "ESP32-ANTROPO-01";
    doc["device_type"] = "smart_scale_stadiometer";
    doc["firmware_version"] = "2.1.0";
    doc["battery_level"] = 98;

    JsonObject measurements = doc.createNestedObject("measurements");
    measurements["weight_kg"] = beratBadanKg;
    measurements["height_cm"] = tinggiBadanCm;
    measurements["systolic_mmhg"] = sistolik;
    measurements["diastolic_mmhg"] = diastolik;
    measurements["pulse_bpm"] = denyutNadi;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Berhasil dikirim ke dr Gigi AI & SATUSEHAT!");
      Serial.println(response);
    } else {
      Serial.printf("Gagal kirim, Error: %s\\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }
  delay(10000); // Kirim setiap 10 detik atau trigger tombol
}`,

    python: `# =================================================================
# SDK dr Gigi AI - Python 3 / Raspberry Pi IoT Gateway
# Cocok untuk Serial USB / BLE Reader / Linux Clinic Gateway
# =================================================================
import requests
import json
import time

SERVER_URL = "https://YOUR_APP_URL/api/iot/ingest"
DEVICE_TOKEN = "DRGIGI_DEV_SECRET_TOKEN_9921"

def send_telemetry(weight_kg, height_cm, systolic, diastolic, pulse, temp_c=36.5):
    payload = {
        "device_id": "RASPI-CLINIC-GATEWAY-01",
        "device_type": "all_in_one_station",
        "firmware_version": "1.4.2",
        "battery_level": 100,
        "measurements": {
            "weight_kg": weight_kg,
            "height_cm": height_cm,
            "systolic_mmhg": systolic,
            "diastolic_mmhg": diastolic,
            "pulse_bpm": pulse,
            "temperature_c": temp_c,
            "head_circumference_cm": 54.0
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Device-Token": DEVICE_TOKEN
    }
    
    try:
        response = requests.post(SERVER_URL, json=payload, headers=headers, timeout=5)
        if response.status_code in [200, 201]:
            print("✅ Telemetri IoT Berhasil Tercatat:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"❌ Gagal mengirim: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"⚠️ Error koneksi: {e}")

# Contoh Eksekusi saat pasien naik ke timbangan
if __name__ == "__main__":
    print("Mengirim hasil pemeriksaan fisik IoT...")
    send_telemetry(weight_kg=62.4, height_cm=168.5, systolic=118, diastolic=78, pulse=74, temp_c=36.7)
`,

    nodejs: `// =================================================================
// SDK dr Gigi AI - Node.js / TypeScript Client SDK
// =================================================================
import axios from 'axios';

interface VitalMeasurement {
  weight_kg?: number;
  height_cm?: number;
  systolic_mmhg?: number;
  diastolic_mmhg?: number;
  pulse_bpm?: number;
  spo2_percent?: number;
  temperature_c?: number;
}

export class DrGigiIoTSDK {
  private endpoint: string;
  private token: string;

  constructor(endpoint: string, token: string) {
    this.endpoint = endpoint;
    this.token = token;
  }

  async sendMeasurement(deviceId: string, data: VitalMeasurement) {
    const response = await axios.post(\`\${this.endpoint}/api/iot/ingest\`, {
      device_id: deviceId,
      device_type: 'smart_monitor',
      measurements: data,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Token': this.token
      }
    });

    return response.data;
  }
}

// Inisialisasi & Kirim:
const client = new DrGigiIoTSDK('https://YOUR_APP_URL', 'DRGIGI_DEV_SECRET_TOKEN_9921');
client.sendMeasurement('NODE-GW-01', {
  weight_kg: 55.2,
  height_cm: 160.0,
  systolic_mmhg: 115,
  diastolic_mmhg: 75,
  pulse_bpm: 72
}).then(res => console.log('Tercatat di sistem dr Gigi AI:', res));
`,

    curl: `# =================================================================
# dr Gigi AI - REST API Webhook / cURL Ingestion Endpoint
# =================================================================

curl -X POST "https://YOUR_APP_URL/api/iot/ingest" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Token: DRGIGI_DEV_SECRET_TOKEN_9921" \\
  -d '{
    "device_id": "SCALE-OMRON-092",
    "device_type": "smart_scale",
    "patient_id": "P-2026-0081",
    "measurements": {
      "weight_kg": 64.2,
      "height_cm": 170.5,
      "systolic_mmhg": 122,
      "diastolic_mmhg": 81,
      "pulse_bpm": 76,
      "spo2_percent": 99,
      "temperature_c": 36.5,
      "head_circumference_cm": 55.0
    }
  }'
`
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-white">IoT Health Device Hub & SDK</h2>
                <span className="bg-emerald-500/30 text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1 font-mono">
                  <Zap size={10} /> Live Ingestion
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Hubungkan Timbangan Digital, Stadiometer TB, Tensimeter, & Oximeter ke sistem dr Gigi AI & SATUSEHAT
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 gap-4">
          <button
            onClick={() => setActiveTab('devices')}
            className={`py-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'devices' 
                ? 'border-emerald-600 text-emerald-700' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity size={16} />
            Perangkat Terhubung & Live Stream
          </button>
          
          <button
            onClick={() => setActiveTab('sdk')}
            className={`py-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sdk' 
                ? 'border-emerald-600 text-emerald-700' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code size={16} />
            SDK & Contoh Kode (ESP32 / Python / Node)
          </button>

          <button
            onClick={() => setActiveTab('mqtt_rest')}
            className={`py-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'mqtt_rest' 
                ? 'border-emerald-600 text-emerald-700' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen size={16} />
            Dokumentasi REST & SATUSEHAT Bridge
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: CONNECTED DEVICES & LIVE STREAM */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              
              {/* Web Bluetooth Action Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="text-emerald-400 animate-pulse" size={20} />
                    <h3 className="font-bold text-white text-base">Direct Web Bluetooth Pairing</h3>
                  </div>
                  <p className="text-xs text-slate-200">
                    Sambungkan timbangan pintar BLE atau tensimeter digital langsung dari browser tanpa driver tambahan.
                  </p>
                </div>

                <button
                  onClick={handleConnectBluetooth}
                  disabled={isScanningBt}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 transition-all shadow-md shrink-0"
                >
                  {isScanningBt ? <RefreshCw className="animate-spin" size={14} /> : <Bluetooth size={14} />}
                  {isScanningBt ? 'Memindai BLE...' : 'Pindai Perangkat Bluetooth'}
                </button>
              </div>

              {btStatus && (
                <div className="text-xs p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 flex items-center gap-2 font-mono">
                  <Zap size={14} className="text-amber-500" />
                  <span>{btStatus}</span>
                </div>
              )}

              {/* Connected Devices Grid */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Wifi size={16} className="text-emerald-600" />
                  Daftar Perangkat IoT Terdeteksi di Klinik
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {connectedDevices.map((dev) => (
                    <div key={dev.id} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-colors flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                          {dev.type === 'scale' && <Gauge size={20} className="text-emerald-600" />}
                          {dev.type === 'stadiometer' && <Layers size={20} className="text-blue-600" />}
                          {dev.type === 'blood_pressure' && <Activity size={20} className="text-rose-600" />}
                          {dev.type === 'oximeter' && <Zap size={20} className="text-amber-600" />}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-900">{dev.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{dev.id} • {dev.protocol}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 size={10} /> {dev.status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">Bat: {dev.battery}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Telemetry Values (Simulated / Ingested) */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Nilai Pengukuran Terakhir dari Sensor IoT</h3>
                    <p className="text-xs text-slate-500">Data live siap diinjeksikan langsung ke form pemeriksaan pasien</p>
                  </div>
                  <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-1 rounded">
                    Endpoint: /api/iot/ingest
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Berat Badan (BB)</div>
                    <div className="text-xl font-bold text-slate-800">{deviceMeasurements.weight_kg} <span className="text-xs font-normal text-slate-500">kg</span></div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Tinggi Badan (TB)</div>
                    <div className="text-xl font-bold text-slate-800">{deviceMeasurements.height_cm} <span className="text-xs font-normal text-slate-500">cm</span></div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Tekanan Darah (BP)</div>
                    <div className="text-xl font-bold text-slate-800">{deviceMeasurements.systolic_mmhg}/{deviceMeasurements.diastolic_mmhg} <span className="text-xs font-normal text-slate-500">mmHg</span></div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Denyut Nadi (Pulse)</div>
                    <div className="text-xl font-bold text-slate-800">{deviceMeasurements.pulse_bpm} <span className="text-xs font-normal text-slate-500">bpm</span></div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Suhu Tubuh (Temp)</div>
                    <div className="text-xl font-bold text-slate-800">{deviceMeasurements.temperature_c} <span className="text-xs font-normal text-slate-500">°C</span></div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Saturasi O2 (SpO2)</div>
                    <div className="text-xl font-bold text-slate-800">{deviceMeasurements.spo2_percent} <span className="text-xs font-normal text-slate-500">%</span></div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Lingkar Kepala</div>
                    <div className="text-xl font-bold text-slate-800">{deviceMeasurements.head_circumference_cm} <span className="text-xs font-normal text-slate-500">cm</span></div>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col justify-center items-center text-center">
                    <div className="text-xs text-emerald-800 font-semibold">Status IoT</div>
                    <div className="text-xs font-bold text-emerald-600 mt-1">Siap Sinkron</div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleApplyToForm}
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <ArrowRight size={16} />
                    Terapkan Nilai IoT ke Form Pasien
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: SDK & CODE EXAMPLES */}
          {activeTab === 'sdk' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Pilih Bahasa Pemrograman / Platform Hardware</h3>
                  <p className="text-xs text-slate-500">Kode siap pakai untuk menghubungkan mikroprosesor/perangkat ke sistem dr Gigi AI</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  {(['esp32', 'python', 'nodejs', 'curl'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedSdkLang(lang)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        selectedSdkLang === lang 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lang === 'esp32' && 'ESP32 (C++)'}
                      {lang === 'python' && 'Python / RasPi'}
                      {lang === 'nodejs' && 'Node.js / TS'}
                      {lang === 'curl' && 'cURL / REST'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
                  <span>
                    {selectedSdkLang === 'esp32' && 'drgigi_iot_esp32_gateway.ino'}
                    {selectedSdkLang === 'python' && 'drgigi_telemetry_client.py'}
                    {selectedSdkLang === 'nodejs' && 'drgigi-iot-sdk.ts'}
                    {selectedSdkLang === 'curl' && 'send_iot_telemetry.sh'}
                  </span>
                  <button
                    onClick={() => copyToClipboard(codeSnippets[selectedSdkLang])}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? 'Tersalin!' : 'Salin Kode'}
                  </button>
                </div>

                <pre className="p-4 text-xs font-mono overflow-x-auto text-emerald-300 leading-relaxed max-h-[360px]">
                  {codeSnippets[selectedSdkLang]}
                </pre>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2">
                <BookOpen size={16} className="shrink-0 mt-0.5 text-blue-600" />
                <p>
                  <strong>Catatan Integrator:</strong> Setiap data yang dikirim ke endpoint <code>/api/iot/ingest</code> akan otomatis distrukturkan dan dapat langsung disinkronkan ke platform <strong>SATUSEHAT Kemenkes RI</strong> melalui protokol standar FHIR R4.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: REST API & SATUSEHAT BRIDGE DOCUMENTATION */}
          {activeTab === 'mqtt_rest' && (
            <div className="space-y-6">
              
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono text-xs font-bold rounded">POST</span>
                    <span className="font-mono text-xs font-bold text-slate-800">/api/iot/ingest</span>
                  </div>
                  <span className="text-xs text-slate-500">Format: JSON (UTF-8)</span>
                </div>
                <p className="text-xs text-slate-600">
                  Endpoint utama untuk menerima telemetri antropometri dan tanda vital dari mikrokontroler (ESP32/Arduino), Raspberry Pi, ataupun aplikasi mobile scanner Bluetooth.
                </p>

                <div className="p-3 bg-slate-900 rounded-lg text-slate-200 font-mono text-xs overflow-x-auto">
                  <div className="text-slate-400">{'// Headers'}</div>
                  <div>Content-Type: application/json</div>
                  <div>X-Device-Token: DRGIGI_DEV_SECRET_TOKEN_9921</div>
                </div>
              </div>

              {/* Mapping to SATUSEHAT LOINC Codes */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" />
                  Kamus Pemetaan Parameter IoT ke Standar SATUSEHAT Kemenkes (FHIR R4)
                </h4>
                <p className="text-xs text-slate-600">
                  Data yang diterima secara otomatis dikonversi menjadi <em>Observation Resource</em> standar FHIR R4 dengan kodefikasi LOINC resmi Kemenkes:
                </p>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                        <th className="p-2 font-semibold">Parameter Sensor</th>
                        <th className="p-2 font-semibold">Field JSON</th>
                        <th className="p-2 font-semibold">Kode LOINC</th>
                        <th className="p-2 font-semibold">Satuan Standar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Tinggi Badan (Stadiometer)</td>
                        <td className="p-2 text-emerald-600">height_cm</td>
                        <td className="p-2 text-slate-700">8302-2 (Body height)</td>
                        <td className="p-2">cm</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Berat Badan (Smart Scale)</td>
                        <td className="p-2 text-emerald-600">weight_kg</td>
                        <td className="p-2 text-slate-700">29463-7 (Body weight)</td>
                        <td className="p-2">kg</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Indeks Massa Tubuh</td>
                        <td className="p-2 text-emerald-600">imt / bmi</td>
                        <td className="p-2 text-slate-700">39156-5 (BMI Ratio)</td>
                        <td className="p-2">kg/m2</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Tekanan Darah Sistolik</td>
                        <td className="p-2 text-emerald-600">systolic_mmhg</td>
                        <td className="p-2 text-slate-700">8480-6 (Systolic BP)</td>
                        <td className="p-2">mm[Hg]</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Tekanan Darah Diastolik</td>
                        <td className="p-2 text-emerald-600">diastolic_mmhg</td>
                        <td className="p-2 text-slate-700">8462-4 (Diastolic BP)</td>
                        <td className="p-2">mm[Hg]</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Denyut Nadi / Heart Rate</td>
                        <td className="p-2 text-emerald-600">pulse_bpm</td>
                        <td className="p-2 text-slate-700">8867-4 (Heart rate)</td>
                        <td className="p-2">/min</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Lingkar Kepala</td>
                        <td className="p-2 text-emerald-600">head_circumference_cm</td>
                        <td className="p-2 text-slate-700">9843-4 (Head circumference)</td>
                        <td className="p-2">cm</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            IoT Ingestion Gateway Active • Port 3000
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
