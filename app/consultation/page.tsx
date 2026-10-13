'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, FileText, Download, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Upload, Camera, MessageSquare, Smile, LayoutDashboard, MapPin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import Image from 'next/image';
import { saveRecord, generateSecureId } from '../lib/db';
import { useLanguage } from '../../components/LanguageProvider';

const SYSTEM_INSTRUCTION = `
1. Persona & Otoritas Kedokteran Gigi (drg.)
Anda adalah dr Gigi AI, asisten dokter gigi virtual profesional berbasis standar Persatuan Dokter Gigi Indonesia (PDGI) dan ADA.
Tugas utama Anda adalah memandu anamnesa terarah (tanya jawab klinis) dengan pasien secara empatik, profesional, dan akurat untuk mengerucutkan dugaan patologi oral.

Batasan: Fokus eksklusif pada kesehatan gigi, gusi, mukosa mulut, dan sendi rahang (TMJ). Jika keluhan berada di luar ranah kedokteran gigi, edukasi dan arahkan ke dokter spesialis yang relevan.

2. Protokol Anamnesa Klinis Terstruktur (Virtual Dental Triage)
Jika pasien datang dengan keluhan:
- Gali 4 elemen kunci:
  1. Karakteristik Nyeri: Linu tajam sesaat (karies/dentin sensitif), ngilu saat manis/dingin, atau berdenyut spontan malam hari (pulpitis ireversibel).
  2. Lokasi & Notasi Gigi: Arahkan pasien menunjukkan gigi mana (depan/geraham, atas/bawah, kanan/kiri) dan petakan ke sistem notasi FDI dua digit (misal: gigi 11-48 untuk dewasa, 51-85 untuk anak).
  3. Durasi & Pemicu: Apakah sakit saat menggigit/mengunyah (apikal), atau berdarah saat sikat gigi (gingivitis)?
  4. Tanda Bahaya (Red Flags): Pembengkakan pipi/wajah (edema fasial), sulit buka mulut (trismus), fluktuasi nanah/benjolan gusi (abses).

3. Foto Gigi (Analisis Citra)
- Jika pasien mengirim FOTO: Analisis visual secara seksama terhadap lubang gigi (karies), kalkulus/karang gigi, resesi, warna gusi, atau sariawan.
- Jika foto bukan gigi/mulut atau buram, minta foto yang lebih fokus dengan pencahayaan terang.

4. Penanganan Pasien Gigi Sehat
- Apresiasi kebiasaan kebersihan gigi pasien.
- Ingatkan pentingnya scaling dan kontrol berkala 6 bulan sekali (ICD-10: Z01.2).

5. Protokol Output:
- Selama masih dalam anamnesa tanya jawab, berikan respon teks percakapan biasa (maksimal 2-3 pertanyaan bertahap agar tidak membebani pasien).
- Jika kesimpulan diagnosa awal telah tercapai (atau setelah menganalisis foto dan keluhan lengkap), outputkan JSON tunggal berikut:

{
  "json_output": {
    "status": "success",
    "analysis_type": "CONSULTATION_NLP",
    "diagnosa_utama": {
      "medis": "...",
      "icd10": "...",
      "tooth_number": "...",
      "confidence_score": "0-100%"
    },
    "urgency_level": "NORMAL | PERLU_TINDAKAN | DARURAT",
    "is_emergency": false,
    "action_required": ["Scaling", "Restorasi Gigi", "Perawatan Saluran Akar", "Pemeriksaan Dokter Gigi"]
  },
  "markdown_report": "LAPORAN KONSULTASI DOKTER GIGI DIGITAL\\n\\n### 📋 Dugaan Klinis & Odontogram\\n- **Diagnosa Utama:** [Nama Medis]\\n- **Kode ICD-10:** [Kode]\\n- **Perkiraan Gigi Terkait:** [Nomor Gigi FDI jika spesifik]\\n- **Tingkat Urgensi:** [Normal / Perlu Tindakan / Darurat]\\n\\n### 🔍 Ringkasan Anamnesa & Temuan\\n- [Ringkasan keluhan utama dan gejala klinis]\\n\\n### 💡 Rekomendasi Dokter Gigi\\n1. [Rencana tindakan medis di klinik]\\n2. [Pertolongan pertama & instruksi perawatan mandiri di rumah]\\n\\n---\\*Disclaimer: Konsultasi AI ini merupakan skrining awal dan edukasi kesehatan, bukan pengganti pemeriksaan klinis fisik dokter gigi.*"
}
`;

type Message = {
  role: 'user' | 'model';
  text: string;
  image?: string; // Add image support to message type
  isReport?: boolean;
  reportData?: any;
};

import LoginButton from '../../components/LoginButton';

export default function ConsultationPage() {
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: language === 'en' ? 'Hello! I am dr Gigi AI. You can consult about your dental complaints or send a photo of your teeth for me to check. Please input your complaints via text or upload an image.' : 'Halo! Saya dr Gigi AI. Anda bisa berkonsultasi mengenai keluhan gigi atau mengirimkan foto gigi Anda untuk saya periksa. Silakan masukkan keluhan Anda melalui teks atau unggah gambar.' }
  ]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showJson, setShowJson] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveToHistory = async (data: any, image: string) => {
    try {
      const diagnosa = data.json_output.summary?.status === 'SEHAT' ? 'Gigi Sehat' : 
                       (data.json_output.diagnosa_utama?.medis || 
                       (data.json_output.findings && data.json_output.findings.length > 0 
                         ? data.json_output.findings.map((f: any) => f.medis).join(', ') 
                         : 'Konsultasi Selesai'));

      const icd10 = data.json_output.summary?.status === 'SEHAT' ? 'Z01.2' :
                    (data.json_output.diagnosa_utama?.icd10 || 
                    (data.json_output.findings && data.json_output.findings.length > 0
                      ? data.json_output.findings.map((f: any) => f.icd10).join(', ')
                      : '-'));

      const confidence = data.json_output.diagnosa_utama?.confidence_score || 
                         data.json_output.findings?.[0]?.confidence_score || '100%';

      const newRecord = {
        id: generateSecureId('rec'),
        timestamp: new Date().toISOString(),
        patient_id: data.json_output.patient_id || 'Konsultasi_Chat',
        type: 'Konsultasi Interaktif AI',
        diagnosa: diagnosa,
        icd10: icd10 || 'Z01.2',
        confidence: confidence,
        image_url: image || 'https://picsum.photos/seed/consultation/400/300',
        json_output: data.json_output,
        markdown_report: data.markdown_report
      };
      await saveRecord(newRecord);
    } catch (e) {
      console.error("Failed to save to history:", e);
    }
  };

  const sendMessage = async (overrideText?: string, overrideImage?: string) => {
    const messageText = overrideText !== undefined ? overrideText : input.trim();
    const messageImage = overrideImage !== undefined ? overrideImage : selectedImage;

    if ((!messageText && !messageImage) || loading) return;

    // Reset input state immediately
    setInput('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Add user message to UI
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: messageText,
      image: messageImage || undefined
    }]);
    
    setLoading(true);

    try {
      const apiRes = await fetch('/api/gemini/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: SYSTEM_INSTRUCTION + `\n\nIMPORTANT: Output all text, explanations, and markdown reports in ${language === 'en' ? 'English' : 'Indonesian'}.`,
          messages: messages,
          currentMessage: {
            text: messageText,
            image: messageImage
          }
        })
      });

      const resData = await apiRes.json();
      if (!apiRes.ok || !resData.success) {
        throw new Error(resData.error || "Gagal mengirim pesan ke Gemini AI");
      }

      const responseText = resData.text;

      // Check if response is JSON (Diagnosis reached)
      let parsedResult = null;
      let introText = '';
      try {
        if (responseText) {
            // Clean up markdown code blocks if present
            const cleanedText = responseText.replace(/```json\n?|\n?```/g, '').trim();
            
            const jsonStartIdx = cleanedText.indexOf('{');
            const jsonEndIdx = cleanedText.lastIndexOf('}');
            
            if (jsonStartIdx !== -1 && jsonEndIdx !== -1 && jsonEndIdx > jsonStartIdx) {
                const possibleJson = cleanedText.substring(jsonStartIdx, jsonEndIdx + 1);
                // Attempt to parse just the JSON part
                const parsed = JSON.parse(possibleJson);
                
                if (parsed.json_output && parsed.markdown_report) {
                    parsedResult = parsed;
                    introText = cleanedText.substring(0, jsonStartIdx).trim();
                }
            } else if (cleanedText.includes('json_output') && cleanedText.includes('markdown_report')) {
                 // Fallback if there are no braces that wrap it perfectly (unlikely if valid json)
                 parsedResult = JSON.parse(cleanedText);
            }
        }
      } catch (e) {
        console.log("Response is not JSON or has syntax error, treating as chat message");
      }

      if (parsedResult) {
         setMessages(prev => [...prev, { 
            role: 'model', 
            text: introText || (language === 'en' ? 'Based on the analysis, here is the report:' : 'Berdasarkan analisis, berikut adalah laporannya:'),
            isReport: true,
            reportData: parsedResult
        }]);
        
        // Save to RME Dashboard
        const firstImage = messages.find(m => m.image)?.image || messageImage || '';
        await saveToHistory(parsedResult, firstImage);
      } else {
         setMessages(prev => [...prev, { role: 'model', text: responseText || "..." }]);
      }

    } catch (error: any) {
      console.error("Chat error:", error);
      let errorMessage = "Maaf, terjadi kesalahan koneksi. Silakan coba lagi.";
      
      if (error.message?.includes('429') || error.message?.includes('Resource has been exhausted') || error.message?.toLowerCase().includes('rate limit')) {
        errorMessage = "Batas penggunaan AI tercapai (Rate Limit Exceeded). Mohon tunggu beberapa saat sebelum mencoba lagi.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async (elementId: string) => {
    const reportElement = document.getElementById(elementId);
    if (!reportElement) {
        alert("Laporan tidak ditemukan.");
        return;
    }

    try {
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const canvas = await html2canvas(reportElement, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${language === 'en' ? 'Consultation-Report' : 'Laporan-Konsultasi'}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error("PDF Export Error:", error);
        alert("Gagal mengunduh PDF.");
    }
  };

  const quickActions = [
    { icon: <Camera size={16} />, label: language === 'en' ? 'Upload Tooth Photo' : 'Upload Foto Gigi', onClick: () => fileInputRef.current?.click() },
    { icon: <MessageSquare size={16} />, label: language === 'en' ? 'My Tooth Hurts' : 'Gigi Saya Sakit', onClick: () => sendMessage(language === 'en' ? 'My tooth hurts, what should I do?' : 'Gigi saya sakit, apa yang harus saya lakukan?') },
    { icon: <MessageSquare size={16} />, label: language === 'en' ? 'Tooth Sensitive to Cold' : 'Gigi Ngilu saat Minum Dingin', onClick: () => sendMessage(language === 'en' ? 'My tooth feels sensitive when drinking cold water.' : 'Gigi saya terasa ngilu saat minum air dingin.') },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex-none z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors">
                <span className="font-bold">← {t('common.backToHome')}</span>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Smile className="text-emerald-600" /> dr Gigi AI Chat
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                Agnes AI
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="hidden sm:flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium">
                  <LayoutDashboard size={18} />
              </Link>
              <div className="hidden sm:block"><LoginButton /></div>
            </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] ${msg.isReport ? 'w-full' : ''}`}>
                
                {/* Image in Message */}
                {msg.image && (
                  <div className={`mb-2 rounded-xl overflow-hidden border border-slate-200 ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                    <Image 
                      src={msg.image} 
                      alt="Uploaded content" 
                      width={400} 
                      height={300} 
                      className="max-w-full h-auto max-h-60 object-cover" 
                    />
                  </div>
                )}

                {/* Bubble */}
                {msg.text && (
                    <div className={`p-4 rounded-2xl shadow-sm text-sm sm:text-base leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-br-none' 
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                    } ${msg.isReport ? 'mb-4' : ''}`}>
                        <div className="prose prose-sm prose-slate max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                    </div>
                )}

                {/* Quick Actions (only show after the first welcome message if no user messages yet) */}
                {idx === 0 && messages.length === 1 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quickActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={action.onClick}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors shadow-sm"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {msg.isReport && (
                    /* Report Card */
                    <div id={`report-${idx}`} className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
                            <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                                <FileText size={18} /> {language === 'en' ? 'Analysis Results' : 'Hasil Analisis'}
                            </h3>
                            <button 
                                onClick={() => exportPDF(`report-${idx}`)}
                                className="text-xs bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-50 transition-colors flex items-center gap-1"
                            >
                                <Download size={14} /> PDF
                            </button>
                        </div>
                        <div className="p-6 prose prose-sm prose-slate max-w-none">
                            <ReactMarkdown>{msg.reportData.markdown_report}</ReactMarkdown>
                            <div className="mt-6 pt-4 border-t border-emerald-100 flex items-center justify-between">
                                <span className="text-xs text-slate-500 italic flex-1 mr-4">
                                  {language === 'en' 
                                    ? '*Disclaimer: This result is AI-generated for early screening. Final diagnosis requires a physical exam by a Dentist.'
                                    : '*Disclaimer: Hasil ini dihasilkan oleh AI dan bertujuan sebagai skrining awal. Diagnosa final hanya dapat ditegakkan oleh Dokter Gigi melalui pemeriksaan fisik langsung.'}
                                </span>
                                <Link 
                                  href="/clinics" 
                                  className="inline-flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-full font-medium transition-colors text-xs no-underline"
                                >
                                    <MapPin size={14} /> {language === 'en' ? 'Find Clinics' : 'Cari Klinik Terdekat'}
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Avatar/Label */}
                <div className={`mt-2 flex items-center gap-2 text-xs text-slate-400 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' ? <Bot size={12} /> : <User size={12} />}
                    <span>{msg.role === 'model' ? 'dr Gigi AI' : 'Anda'}</span>
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] sm:max-w-[75%]">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                    <RefreshCw className="animate-spin text-emerald-600" size={16} />
                    <span className="text-sm text-slate-500">dr Gigi AI sedang menganalisis...</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 justify-start">
                    <Bot size={12} />
                    <span>dr Gigi AI</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4 flex-none">
        <div className="max-w-3xl mx-auto relative">
          
          {/* Image Preview */}
          {selectedImage && (
            <div className="absolute bottom-full left-0 mb-4 p-2 bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="relative">
                <Image 
                  src={selectedImage} 
                  alt="Preview" 
                  width={80} 
                  height={80} 
                  className="h-20 w-auto rounded-lg object-cover" 
                />
                <button 
                  onClick={() => { setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 hover:bg-slate-900 shadow-sm"
                >
                  <ChevronDown size={12} className="rotate-45" /> {/* Using Chevron as X for now or import X */}
                </button>
              </div>
            </div>
          )}

          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2 items-end"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200"
              title="Upload Foto"
            >
              <Upload size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*" 
              className="hidden" 
            />

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedImage ? "Tambahkan keterangan foto..." : "Ketik keluhan Anda..."}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block w-full p-4 outline-none transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || loading}
              className="bg-emerald-600 text-white rounded-xl px-6 py-4 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
