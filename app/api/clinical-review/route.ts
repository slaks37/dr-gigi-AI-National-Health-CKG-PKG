import { api, ApiError, readJson, requireAccess } from '@/src/server/security';
import { store } from '@/src/server/store';
import { parse } from '@/src/clinical-engine/validation/parse';
import { ReviewRequestSchema } from '@/src/clinical-engine/validation/review';
import { ScreeningSchema, FindingSchema } from '@/src/clinical-engine/types/schema';
import { lookupCode, validateCodes, TERMINOLOGY_VERSION } from '@/src/clinical-engine/terminology/catalog';
import { applyReasoning } from '@/src/clinical-engine/core/pipeline';
import { FieldValue } from 'firebase-admin/firestore';
export const POST=api(async(req,p)=>{
 if(p.role!=='doctor'||!p.clinicalReviewer)throw new ApiError(403,'Verified qualified dentist claim required');
 const input=parse(ReviewRequestSchema,await readJson(req,100_000));
 if(!validateCodes(input.confirmed_icd10))throw new ApiError(400,'Unsupported WHO ICD-10 code');
 if(input.decision!=='APPROVED'&&input.confirmed_icd10.length)throw new ApiError(400,'Only approved reviews can confirm codes');
 const ref=store().collection('records').doc(input.screening_id);
 return store().runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new ApiError(404,'Screening not found');const data=snap.data()!;requireAccess(p,data);
  if(!Array.isArray(data.assignedClinicianUids)||!data.assignedClinicianUids.includes(p.uid)||data.createdBy===p.uid)throw new ApiError(403,'Independent assigned dentist required');
  if(data.version!==input.expected_version)throw new ApiError(409,'Screening changed; reload before review');
  const result=ScreeningSchema.parse(data.screening);
  if(input.decision==='APPROVED'&&!result.patient_id)throw new ApiError(400,'Verified patient subject linkage required before confirmation');
  if(input.decision==='APPROVED'&&(!input.examinations.clinical_exam||!input.clinical_evidence.length))throw new ApiError(400,'Clinical examination evidence required');
  for(const code of input.confirmed_icd10){const entry=lookupCode(code)!;if((entry.needs_radiography&&!input.examinations.radiography)||(entry.needs_vitality_test&&!input.examinations.vitality_test)||(entry.needs_periodontal_exam&&!input.examinations.periodontal_exam)||(entry.needs_histopathology&&!input.examinations.histopathology))throw new ApiError(400,'Required examination evidence missing');}
  const findings=input.findings.map(f=>{
   if(f.image_index>=result.image_quality_results.length||!['VALID','REVIEW_REQUIRED'].includes(result.image_quality_results[f.image_index]?.status))throw new ApiError(400,'Finding image does not exist');
   if(f.fdi_number&&(!input.orientation_known||!input.anatomical_context_known))throw new ApiError(400,'FDI requires known orientation and anatomical context');
   return FindingSchema.parse({...f,source:'QUALIFIED_CLINICIAN',model_version:null,reviewer_uid:p.uid,review_required:true});
  });
  result.visual_findings=findings;applyReasoning(result,findings);result.confirmed_icd10=input.confirmed_icd10;result.terminology_version=TERMINOLOGY_VERSION;
  result.clinician_review={status:input.decision,reviewer_uid:p.uid,reviewed_at:new Date().toISOString(),note:input.note,evidence:input.clinical_evidence};
  result.evidence_provenance.source='CLINICIAN_REVIEW';
  if(input.decision==='APPROVED')result.screening_status='CLINICIAN_CONFIRMED';
  else if(result.triage_level==='EMERGENCY')result.screening_status='EMERGENCY';else result.screening_status='REVIEW_REQUIRED';
  const validated=ScreeningSchema.parse(result);const version=data.version+1;
  tx.update(ref,{screening:validated,json_output:{...data.json_output,screening:validated},version,verificationStatus:input.decision.toLowerCase(),updatedAt:new Date().toISOString(),icd10:input.confirmed_icd10.join(', '),diagnosa:input.decision==='APPROVED'?input.note:'Skrining belum dikonfirmasi dokter'});
  tx.create(store().collection('clinicalReviews').doc(),{recordId:input.screening_id,reviewerUid:p.uid,version,decision:input.decision,previousScreening:data.screening,review:input,timestamp:FieldValue.serverTimestamp()});
  tx.create(store().collection('auditLogs').doc(),{actorUid:p.uid,resourceId:input.screening_id,action:'CLINICAL_REVIEW',decision:input.decision,timestamp:FieldValue.serverTimestamp()});
  return{success:true,recordId:input.screening_id,version,persistence:'CONFIRMED',screening:validated};
 });
});
