import 'server-only';
import { ENGINE_VERSION, FindingSchema, ScreeningSchema, ScreeningRequest, Screening, Finding } from '../types/schema';
import { triage } from './triage-engine';
import { reason } from '../rules/rules';
import { TERMINOLOGY_VERSION } from '../terminology/catalog';
import { validateImage } from './image-quality';
import { boundedInference } from '../vision/deadline';
import { unavailableVision, OralVision, validatedAvailability } from '../vision/interface';
export async function screen(input:ScreeningRequest,uid:string,vision:OralVision=unavailableVision,now=new Date().toISOString(),signal?:AbortSignal):Promise<Screening> {
 const deadline=Date.now()+30_000;
 const t=triage(input.symptoms);
 const availability=validatedAvailability(vision);
 const base:Screening={screening_id:input.screening_id,patient_id:input.context==='PEDIATRIC'?input.patient_subject_id:(input.patient_subject_id??uid),screening_timestamp:now,engine_version:ENGINE_VERSION,model_version:null,terminology_version:TERMINOLOGY_VERSION,screening_status:'REVIEW_REQUIRED',context:input.context,patient_age:input.patient_age,symptoms:input.symptoms,image_quality_results:[],visual_findings:[],clinical_suspicions:[],differential_diagnoses:[],triage_level:t.level,triage:t,suggested_icd10:[],confirmed_icd10:[],required_examinations:['Pemeriksaan langsung oleh dokter gigi'],recommendations:[t.recommendation,'Hasil eksperimental; aturan klinis belum disetujui untuk rilis produksi.'],clinician_review:{status:'REVIEW_REQUIRED',reviewer_uid:null,reviewed_at:null,note:'',evidence:[]},evidence_provenance:{source:input.images.length?'QUESTIONNAIRE_AND_IMAGES':'QUESTIONNAIRE_ONLY',creator_uid:uid,model_available:availability.available,calibrated_confidence_available:false,clinical_rules_approved:false,consent_to_process:true,source_images_retained:false,guardian_authorized:input.guardian_authorized,subject_linkage:input.patient_subject_id?'OWNED_PROFILE':input.context==='ADULT'?'SELF':'UNKNOWN'}};
 // Emergency is evaluated before decode, model availability, persistence or generative services.
 if(t.level==='EMERGENCY'){base.screening_status='EMERGENCY';return ScreeningSchema.parse(base);}
 const hashes=new Map<string,number>();
 for(let i=0;i<input.images.length;i++){
  signal?.throwIfAborted();
  if(Date.now()>deadline)throw new Error('Visual processing deadline reached');
  const prepared=await validateImage(input.images[i],i);const q=prepared.quality;
  if(q.sha256&&hashes.has(q.sha256)){q.duplicate_of=hashes.get(q.sha256)!;q.status='INSUFFICIENT_VISIBILITY';q.reasons=['Duplikat identik; tambahkan sudut pandang lain.'];}
  else if(q.sha256)hashes.set(q.sha256,i);
  if(prepared.normalized&&q.status==='REVIEW_REQUIRED'&&availability.available){
   const oral=await boundedInference(s=>vision.detectOralRegion(prepared.normalized!,s),{deadline,attemptTimeoutMs:12_000,signal});
   if(oral.status==='ABSENT'){q.status='NO_ORAL_REGION';q.oral_region_status='ABSENT';q.reasons=['Tidak ada area oral yang terdeteksi; ambil ulang foto.'];}
   else if(oral.status==='INSUFFICIENT_VISIBILITY'){q.status='INSUFFICIENT_VISIBILITY';q.reasons=['Struktur oral tidak cukup terlihat.'];}
   else if(oral.status==='PRESENT'){
    q.status='VALID';q.oral_region_status='PRESENT';q.reasons=[];
    const findings=await boundedInference(s=>vision.detectFindings(prepared.normalized!,i,s),{deadline,attemptTimeoutMs:12_000,signal});
    for(const raw of findings){const f=FindingSchema.parse(raw);if(f.image_index!==i||f.source!=='VALIDATED_DETECTOR'||f.model_version!==availability.version)throw new Error('Detector provenance mismatch');base.visual_findings.push(f);}
   }
  }
  base.image_quality_results.push(q);
 }
 base.model_version=availability.available?availability.version:null;
 if(base.image_quality_results.some(q=>q.status==='CORRUPT_IMAGE'||q.status==='UNSUPPORTED_FORMAT'))base.screening_status='INVALID_IMAGE';
 else if(base.image_quality_results.some(q=>q.status==='LOW_QUALITY'||q.status==='INSUFFICIENT_VISIBILITY'))base.screening_status='RETAKE_REQUIRED';
 else if(base.image_quality_results.some(q=>q.status==='NO_ORAL_REGION'))base.screening_status='NO_ORAL_REGION';
 else if(base.image_quality_results.length&&base.image_quality_results.every(q=>q.status==='VALID'))base.screening_status=base.visual_findings.length?'FINDINGS_PRESENT':'NO_VISIBLE_FINDINGS';
 else base.screening_status='REVIEW_REQUIRED';
 applyReasoning(base,base.visual_findings);
 return ScreeningSchema.parse(base);
}
export function applyReasoning(result:Screening,findings:Finding[]) {
 result.clinical_suspicions=reason(findings,result.symptoms,result.context);
 result.suggested_icd10=[...new Set(result.clinical_suspicions.flatMap(c=>c.suggested_icd10))];
 result.differential_diagnoses=[...new Set(result.clinical_suspicions.flatMap(c=>c.differential_diagnoses))];
 result.required_examinations=[...new Set(['Pemeriksaan langsung oleh dokter gigi',...result.clinical_suspicions.flatMap(c=>c.required_examinations)])];
}
