import { z } from 'zod';
import { api, ApiError, readJson } from '@/src/server/security';
import { store } from '@/src/server/store';
import { AnnotationSchema } from '@/src/dataset/schema';
import { parse } from '@/src/clinical-engine/validation/parse';
import { FieldValue } from 'firebase-admin/firestore';
const RequestSchema=z.strictObject({annotation_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),annotation:AnnotationSchema,image_sha256:z.string().regex(/^[a-f0-9]{64}$/)});
export const GET=api(async(_req,p)=>{
 if(p.role!=='admin'&&!(p.role==='doctor'&&p.clinicalReviewer&&p.datasetScopes?.includes('SONRI')))throw new ApiError(403,'Authorized SONRI dataset reviewer required');
 const entries=await store().collection('datasetEntries').where('datasetId','==','SONRI').limit(100).get();
 const annotations=await store().collection('datasetAnnotations').where('datasetId','==','SONRI').limit(100).get();
 return{success:true,annotations:annotations.docs.map(d=>({annotation_id:d.id,...d.data()})),entries:entries.docs.map(d=>({image_id:d.id,...d.data()})),source_media_available:false,message:'Metadata only. Use an authorized original whose hash matches; image bytes are not stored by this application.'};
});
export const POST=api(async(req,p)=>{
 if(p.role!=='doctor'||!p.clinicalReviewer||!p.datasetScopes?.includes('SONRI'))throw new ApiError(403,'Qualified authorized SONRI annotator required');
 const input=parse(RequestSchema,await readJson(req,100_000));
 const entryRef=store().collection('datasetEntries').doc(input.annotation.image_id),ref=store().collection('datasetAnnotations').doc(input.annotation_id);
 return store().runTransaction(async tx=>{
  const entry=await tx.get(entryRef),existing=await tx.get(ref);
  if(!entry.exists)throw new ApiError(404,'Dataset image metadata not imported');const e=entry.data()!;
  if(e.datasetId!=='SONRI'||e.dataset_version!==input.annotation.dataset_version||!e.sha256||e.sha256!==input.image_sha256||e.consent_status==='REVOKED'||e.data_usage_permission==='PROHIBITED')throw new ApiError(403,'Verified source/hash and valid permission required');
  if(input.annotation.source_image_id!==input.annotation.image_id||input.annotation.anonymous_patient_group_id!==e.patient_group_id)throw new ApiError(400,'Annotation provenance mismatch');
  if(existing.exists&&(existing.data()?.author_uid!==p.uid||existing.data()?.verification_status==='APPROVED'))throw new ApiError(403,'Annotation author/version protected');
  const version=existing.data()?.version??0;if(version!==input.annotation.expected_version)throw new ApiError(409,'Annotation changed; reload');
  tx.set(ref,{...input.annotation,image_sha256:input.image_sha256,author_uid:p.uid,clinical_reviewer_uid:null,verification_status:input.annotation.status==='REJECTED'?'REJECTED':'REVIEW_REQUIRED',version:version+1,datasetId:'SONRI',timestamp:new Date().toISOString()});
  tx.update(entryRef,{independent_review_status:'PENDING',review_status:'UNREVIEWED',version:(e.version??0)+1});
  tx.create(store().collection('auditLogs').doc(),{actorUid:p.uid,action:'DATASET_ANNOTATE',resourceId:input.annotation_id,timestamp:FieldValue.serverTimestamp()});
  return{success:true,annotationId:input.annotation_id,version:version+1,status:'REVIEW_REQUIRED',persistence:'CONFIRMED'};
 });
});
