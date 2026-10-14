import { z } from 'zod';
import { api, ApiError, readJson } from '@/src/server/security';
import { store } from '@/src/server/store';
import { parse } from '@/src/clinical-engine/validation/parse';
import { FieldValue } from 'firebase-admin/firestore';
import { FindingLabels } from '@/src/clinical-engine/types/schema';
const ReviewSchema=z.strictObject({annotation_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),expected_version:z.number().int().positive(),decision:z.enum(['ACCEPTED','CORRECTED','REJECTED','UNCERTAIN']),verified_label:z.enum(FindingLabels).nullable(),finding_type:z.enum(FindingLabels).nullable(),note:z.string().min(1).max(2000),image_review_complete:z.boolean()});
export const POST=api(async(req,p)=>{
 if(p.role!=='doctor'||!p.clinicalReviewer||!p.datasetScopes?.includes('SONRI'))throw new ApiError(403,'Independent qualified SONRI reviewer required');
 const input=parse(ReviewSchema,await readJson(req,10_000));const ref=store().collection('datasetAnnotations').doc(input.annotation_id);
 return store().runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new ApiError(404,'Annotation not found');const data=snap.data()!;
  const entryRef=store().collection('datasetEntries').doc(data.image_id);const entry=await tx.get(entryRef);
  const allAnnotations=await tx.get(store().collection('datasetAnnotations').where('image_id','==',data.image_id));
  if(!entry.exists)throw new ApiError(404,'Dataset entry not found');
  if(data.datasetId!=='SONRI'||data.author_uid===p.uid)throw new ApiError(403,'Annotator cannot independently approve own annotation');
  if(data.version!==input.expected_version)throw new ApiError(409,'Annotation changed; reload');
  if(['ACCEPTED','CORRECTED'].includes(input.decision)&&(!input.verified_label||!input.finding_type||input.verified_label!==input.finding_type))throw new ApiError(400,'Verified label and observed finding required');
  const accepted=['ACCEPTED','CORRECTED'].includes(input.decision);
  const complete=input.image_review_complete&&accepted&&allAnnotations.docs.every(a=>a.id===input.annotation_id||a.data().verification_status==='APPROVED');
  if(input.image_review_complete&&!complete)throw new ApiError(409,'Every image annotation requires independent approval first');
  const version=data.version+1,now=new Date().toISOString();
  tx.update(ref,{clinical_reviewer_uid:p.uid,verification_status:accepted?'APPROVED':input.decision,version,review_timestamp:now,review_note:input.note,reviewed_finding_type:input.finding_type,disagreement:input.decision==='CORRECTED'||(input.finding_type!==null&&input.finding_type!==data.finding_type)});
  tx.update(entryRef,{review_status:input.decision,clinician_verified_label:accepted?input.verified_label:null,visual_finding_labels:accepted?[...new Set([...(entry.data()?.visual_finding_labels??[]),input.finding_type])]:entry.data()?.visual_finding_labels??[],reviewer_id:p.uid,review_timestamp:now,label_version:`review-${version}`,independent_review_status:complete?'APPROVED':input.decision==='REJECTED'?'REJECTED':'PENDING',version:(entry.data()?.version??0)+1});
  tx.create(store().collection('datasetLabelReviews').doc(),{annotationId:input.annotation_id,authorUid:data.author_uid,reviewerUid:p.uid,decision:input.decision,previousAnnotation:data,review:input,timestamp:FieldValue.serverTimestamp()});
  tx.create(store().collection('auditLogs').doc(),{actorUid:p.uid,action:'DATASET_LABEL_REVIEW',resourceId:input.annotation_id,decision:input.decision,timestamp:FieldValue.serverTimestamp()});
  return{success:true,version,status:input.decision,persistence:'CONFIRMED'};
 });
});
