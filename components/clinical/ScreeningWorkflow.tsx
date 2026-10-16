'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ModuleSummary from './ModuleSummary';
import Image from 'next/image';
import { SymptomsSchema, symptomKeys, ScreeningSchema, Screening, Symptoms } from '../../src/clinical-engine/types/schema';
import { triage } from '../../src/clinical-engine/core/triage-engine';
import { getAllPatients, savePatient } from '../../app/lib/db';
import { authenticatedFetch } from '../../app/lib/apiClient';
import { compressImageToGenerativePart } from '../../app/lib/imageUtils';
import { useAuth } from '../AuthProvider';
const labels:Record<typeof symptomKeys[number],string>={pain:'Nyeri gigi/mulut',spontaneous_pain:'Nyeri tanpa pemicu',cold_pain:'Nyeri saat dingin',heat_pain:'Nyeri saat panas',sweet_pain:'Nyeri saat makanan manis',chewing_pain:'Nyeri saat mengunyah',gum_bleeding:'Gusi berdarah',gingival_swelling:'Gusi bengkak',facial_swelling:'Wajah/rahang bengkak',pus_or_drainage:'Nanah atau cairan keluar',fever:'Demam',difficulty_swallowing:'Sulit menelan',difficulty_breathing:'Sulit bernapas',difficulty_opening_mouth:'Sulit membuka mulut',recent_extraction:'Baru mencabut gigi',recent_trauma:'Cedera gigi baru-baru ini',persistent_oral_ulcer:'Sariawan/lesi menetap'};
const fieldOrder=['difficulty_breathing','difficulty_swallowing',...symptomKeys.filter(k=>!['difficulty_breathing','difficulty_swallowing'].includes(k))] as typeof symptomKeys[number][];
const statusLabels:Record<Screening['screening_status'],string>={EMERGENCY:'Perlu pertolongan darurat',INVALID_IMAGE:'Foto tidak dapat diproses',RETAKE_REQUIRED:'Ambil ulang foto',NO_ORAL_REGION:'Area mulut tidak terlihat',LOW_QUALITY:'Kualitas foto belum memadai',INCONCLUSIVE:'Bukti belum cukup',NO_VISIBLE_FINDINGS:'Tidak tampak temuan visual; bukan bukti sehat',FINDINGS_PRESENT:'Temuan visual perlu dokter',REVIEW_REQUIRED:'Perlu tinjauan dokter',CLINICIAN_CONFIRMED:'Dikonfirmasi dokter berwenang',PROCESSING_ERROR:'Pemrosesan belum berhasil'};
type Media={file:File;url:string};
export default function ScreeningWorkflow({context}:{context:'ADULT'|'PEDIATRIC'}) {
 const {user}=useAuth();
 const [patients,setPatients]=useState<{id:string;name:string}[]>([]),[subject,setSubject]=useState(''),[profileLabel,setProfileLabel]=useState(''),[guardian,setGuardian]=useState(false);
 const [symptoms,setSymptoms]=useState<Symptoms>(()=>SymptomsSchema.parse({}));
 const [age,setAge]=useState(''),[consent,setConsent]=useState(false),[media,setMedia]=useState<Media[]>([]);
 const [result,setResult]=useState<Screening|null>(null),[recordId,setRecordId]=useState<string|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState<string|null>(null);
 const items=useRef<Media[]>([]),requestId=useRef<string|null>(null);
 const urgency=useMemo(()=>triage(symptoms),[symptoms]);
 useEffect(()=>{items.current=media;},[media]);
 useEffect(()=>{if(!user)return;let active=true;getAllPatients().then(rows=>{if(active)setPatients(rows);}).catch(()=>{if(active)setMessage('Profil pasien belum dapat dimuat.');});return()=>{active=false;};},[user]);
 useEffect(()=>()=>{items.current.forEach(m=>URL.revokeObjectURL(m.url));},[]);
 const invalidate=()=>{setResult(null);setRecordId(null);setFeedback(null);requestId.current=null;};
 const answer=(key:typeof symptomKeys[number],value:'YES'|'NO'|'UNKNOWN')=>{invalidate();setSymptoms(prev=>({...prev,[key]:value}));};
 const addFiles=(files:FileList|null)=>{
  if(!files)return;invalidate();
  const selected=Array.from(files).slice(0,4-media.length);
  if(selected.some(f=>!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(f.type)||f.size>12_000_000)){setMessage('Gunakan JPEG, PNG, WebP, HEIC/HEIF hingga 12 MB.');return;}
  setMedia(prev=>[...prev,...selected.map(file=>({file,url:URL.createObjectURL(file)}))]);
 };
 const imagePart=async(file:File)=>{
  if(['image/heic','image/heif'].includes(file.type)){
   if(file.size>2_500_000)throw new Error('HEIC/HEIF terlalu besar. Konversi secara lokal ke JPEG terlebih dahulu.');
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Berkas tidak dapat dibaca.'));reader.readAsDataURL(file);});
   return{data,mime_type:file.type};
  }
  const compressed=await compressImageToGenerativePart(file,1000,0.8);return{data:compressed.data,mime_type:compressed.mimeType};
 };
 const run=async()=>{
  setBusy(true);setMessage('');setResult(null);setRecordId(null);
  try{
   if(!user)throw new Error('Masuk akun untuk menyimpan skrining. Pesan tanda bahaya tetap dapat dibaca tanpa akun.');
   if(!consent)throw new Error('Persetujuan pemrosesan diperlukan.');
   const images=urgency.level==='EMERGENCY'?[]:await Promise.all(media.map(m=>imagePart(m.file)));
   if(!requestId.current)requestId.current=`scr_${crypto.randomUUID()}`;
   const body=JSON.stringify({screening_id:requestId.current,context,patient_age:age===''?null:Number(age),symptoms,patient_subject_id:subject||null,guardian_authorized:guardian,images,consent_to_process:true});
   if(new Blob([body]).size>3_900_000)throw new Error('Gabungan foto terlalu besar. Kurangi foto atau konversi HEIC secara lokal ke JPEG.');
   const response=await authenticatedFetch('/api/screenings',{method:'POST',headers:{'Content-Type':'application/json'},body});
   const saved=await response.json();const validated=ScreeningSchema.parse(saved.screening);
   if(saved.persistence!=='CONFIRMED'||!saved.recordId)throw new Error('Hasil belum dipastikan tersimpan.');
   setResult(validated);setRecordId(saved.recordId);setMessage('Skrining tersimpan sebagai catatan yang memerlukan dokter.');
  }catch(error){setMessage(error instanceof Error?error.message:'Skrining belum berhasil. Coba lagi.');}
  finally{setBusy(false);}
 };
 const saveFeedback=async(accurate:boolean)=>{
  if(!recordId)return;setFeedback(null);
  try{
   const current=await authenticatedFetch(`/api/screenings?id=${encodeURIComponent(recordId)}`);const body=await current.json();
   await authenticatedFetch('/api/records',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:recordId,is_accurate:accurate,expectedVersion:body.version})});
   setFeedback('Umpan balik berhasil disimpan. Umpan balik tidak mengonfirmasi diagnosis.');
  }catch{setMessage('Umpan balik belum tersimpan. Coba lagi.');}
 };
 const download=()=>{
  if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='skrining-oral.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section className="max-w-5xl mx-auto my-6 rounded-2xl border border-emerald-200 bg-white p-5 md:p-8 space-y-6">
  <div><h2 className="text-2xl font-bold text-slate-900">Skrining oral {context==='PEDIATRIC'?'anak':'dewasa'}</h2><p className="text-slate-600 mt-2">{context==='PEDIATRIC'?'Orang tua/wali dapat membantu menjawab. ':''}Jawab sesuai keadaan yang diketahui. Hasil awal memerlukan dokter gigi; penilaian foto otomatis belum tersedia.</p><p className="text-amber-800 text-sm mt-2">Mode pengembangan: aturan skrining belum mendapat persetujuan klinis untuk rilis produksi.</p></div>
  <div role="status" data-testid="triage-alert" className={`rounded-xl border p-4 ${urgency.level==='EMERGENCY'?'bg-red-50 border-red-400 text-red-900':'bg-amber-50 border-amber-200 text-amber-900'}`}><strong>{urgency.level==='EMERGENCY'?'Segera cari pertolongan darurat':urgency.level==='URGENT'?'Perlu pemeriksaan segera':'Informasi urgensi'}</strong><p>{urgency.recommendation}</p></div>
  <div className="rounded-xl border p-4 space-y-3"><label className="block">Profil pasien {context==='PEDIATRIC'?'anak':''}<select className="block border rounded p-2 w-full" value={subject} onChange={e=>{invalidate();setSubject(e.target.value);}}><option value="">{context==='ADULT'?'Diri sendiri':'Pilih profil anak'}</option>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{user&&<div><label className="block">Label profil baru (boleh inisial)<input className="block border rounded p-2" value={profileLabel} onChange={e=>setProfileLabel(e.target.value)} maxLength={128}/></label><button type="button" disabled={!profileLabel.trim()||busy} className="border rounded p-2 mt-2" onClick={async()=>{try{const id=await savePatient({name:profileLabel.trim(),gender:'unknown'});setPatients(prev=>[...prev,{id,name:profileLabel.trim()}]);setSubject(id);setProfileLabel('');invalidate();setMessage('Profil pasien berhasil disimpan.');}catch{setMessage('Profil pasien belum tersimpan.');}}}>Buat profil pasien</button></div>}{context==='PEDIATRIC'&&<label className="flex gap-2"><input type="checkbox" checked={guardian} onChange={e=>{invalidate();setGuardian(e.target.checked);}}/>Saya orang tua/wali yang berwenang untuk anak pada profil ini.</label>}</div>
  <ModuleSummary />
  <label className="block">Usia {context==='PEDIATRIC'?'anak':'pasien'} (tahun; boleh belum diketahui)<input aria-label="Usia pasien" type="number" min={context==='PEDIATRIC'?0:18} max={context==='PEDIATRIC'?17:120} value={age} onChange={e=>{invalidate();setAge(e.target.value);}} className="block mt-1 border rounded-lg p-2 w-40" /></label>
  <div className="grid sm:grid-cols-2 gap-4">{fieldOrder.map(key=><label key={key} className="text-slate-800">{labels[key]}<select aria-label={labels[key]} value={symptoms[key]} onChange={e=>answer(key,e.target.value as 'YES'|'NO'|'UNKNOWN')} className="block mt-1 border rounded-lg p-2 w-full"><option value="UNKNOWN">Belum diketahui</option><option value="YES">Ya</option><option value="NO">Tidak</option></select></label>)}</div>
  <div className="grid sm:grid-cols-3 gap-4">{[['pain_severity','Skala nyeri (0–10)',10],['pain_duration_days','Lama nyeri (hari)',3650],['lesion_duration_days','Lama lesi/sariawan (hari)',3650]].map(([key,label,max])=><label key={String(key)}>{label}<input aria-label={String(label)} type="number" min="0" max={Number(max)} value={symptoms[key as 'pain_severity']??''} onChange={e=>{invalidate();setSymptoms(prev=>({...prev,[String(key)]:e.target.value===''?null:Number(e.target.value)}));}} className="block mt-1 border rounded-lg p-2 w-full" /></label>)}</div>
  <label className="block">Riwayat gigi yang relevan (opsional)<textarea value={symptoms.dental_history} maxLength={2000} onChange={e=>{invalidate();setSymptoms(prev=>({...prev,dental_history:e.target.value}));}} className="block mt-1 border rounded-lg p-2 w-full" /></label>
  <div><label className="block font-semibold">Foto mulut (opsional, maksimal 4)<input aria-label="Foto skrining oral" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={media.length>=4||urgency.level==='EMERGENCY'} onChange={e=>{addFiles(e.target.files);e.target.value='';}} className="block mt-2" /></label><p className="text-sm text-slate-600 mt-2">Foto diproses secara lokal pada server aplikasi untuk pemeriksaan berkas. Foto tidak disimpan dalam rekam dan tidak dikirim ke penyedia AI. HEIC/HEIF memerlukan decoder yang tersedia; bila gagal, gunakan JPEG/PNG.</p><div className="flex gap-3 flex-wrap mt-3">{media.map((m,i)=><div key={m.url} className="border rounded-lg p-2"><p>Foto {i+1}</p>{!['image/heic','image/heif'].includes(m.file.type)?<Image src={m.url} alt={`Pratinjau foto mulut ${i+1}`} width={160} height={120} unoptimized className="w-40 h-32 object-contain"/>:<p className="text-sm">Pratinjau HEIF bergantung pada perangkat.</p>}<button type="button" onClick={()=>{invalidate();URL.revokeObjectURL(m.url);setMedia(prev=>prev.filter(x=>x.url!==m.url));}} className="text-red-700">Hapus foto {i+1}</button></div>)}</div></div>
  <label className="flex items-start gap-2"><input type="checkbox" checked={consent} onChange={e=>{invalidate();setConsent(e.target.checked);}} className="mt-1" /><span>Saya menyetujui pemrosesan gejala/foto pada aplikasi dan penyimpanan hasil skrining di akun saya. Diagnosis akhir memerlukan dokter.</span></label>
  <button disabled={busy||!user||!consent||(context==='PEDIATRIC'&&(!subject||!guardian))} onClick={run} className="rounded-xl bg-emerald-700 text-white px-5 py-3 disabled:opacity-50">{busy?'Memproses…':'Simpan skrining terstruktur'}</button>{!user&&<p>Masuk melalui tombol akun untuk memproses dan menyimpan hasil.</p>}
  <p role="status" aria-live="polite">{message}</p>
  {result&&<div className="border border-slate-200 rounded-xl p-5 space-y-3" data-testid="structured-result"><h3 className="font-bold text-xl">{statusLabels[result.screening_status]}</h3><p>{result.triage.recommendation}</p>{result.image_quality_results.map(q=><div key={q.image_index}>Foto {q.image_index+1}: {q.status}<ul>{q.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>)}{!result.evidence_provenance.model_available&&<p className="text-amber-800">Detector oral tervalidasi belum tersedia. Tidak ada temuan foto yang dibuat oleh AI.</p>}{result.clinical_suspicions.map(c=><div key={c.rule_id}><strong>{c.candidate}</strong><p>{c.explanation}</p>{c.suggested_icd10.length>0&&<p>Kandidat ICD-10 WHO, belum dikonfirmasi: {c.suggested_icd10.join(', ')}</p>}</div>)}<ModuleSummary result={result}/><p>Tinjauan dokter: {result.clinician_review.status}. Kepercayaan klinis: belum tervalidasi.</p><div className="flex gap-3 flex-wrap"><button onClick={download} className="border rounded-lg px-3 py-2">Unduh JSON</button><button onClick={()=>window.print()} className="border rounded-lg px-3 py-2">Cetak / PDF</button><button onClick={()=>saveFeedback(true)} className="border rounded-lg px-3 py-2">Umpan balik sesuai</button><button onClick={()=>saveFeedback(false)} className="border rounded-lg px-3 py-2">Umpan balik perlu koreksi</button></div><p role="status">{feedback}</p><Link href="/dashboard" className="text-emerald-700 underline">Buka rekam medis</Link></div>}
 </section>;
}
