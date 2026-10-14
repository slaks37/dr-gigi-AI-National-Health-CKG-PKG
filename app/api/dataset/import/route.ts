import { z } from 'zod';
import { api, requireAdmin, readJson, ApiError } from '@/src/server/security';
import { DatasetEntrySchema } from '@/src/dataset/schema';
import { parse } from '@/src/clinical-engine/validation/parse';
import { store } from '@/src/server/store';
import { FieldValue } from 'firebase-admin/firestore';
const ImportSchema=z.strictObject({dataset_id:z.literal('SONRI'),entries:z.array(DatasetEntrySchema).min(1).max(100)});
export const POST=api(async(req,p)=>{
 requireAdmin(p);const input=parse(ImportSchema,await readJson(req,500_000));
 if(input.entries.some(e=>e.review_status!=='UNREVIEWED'||e.clinician_verified_label||e.reviewer_id||e.independent_review_status!=='PENDING'||e.visual_finding_labels.length))throw new ApiError(400,'Import cannot manufacture reviewed labels');
 const refs=input.entries.map(e=>store().collection('datasetEntries').doc(e.image_id));
 await store().runTransaction(async tx=>{
  const existing=await Promise.all(refs.map(r=>tx.get(r)));
  if(existing.some(s=>s.exists))throw new ApiError(409,'Existing dataset metadata cannot be overwritten');
  input.entries.forEach((e,i)=>tx.create(refs[i],{...e,datasetId:'SONRI',importedBy:p.uid,importedAt:new Date().toISOString(),version:1}));
  tx.create(store().collection('auditLogs').doc(),{actorUid:p.uid,action:'DATASET_METADATA_IMPORT',count:input.entries.length,timestamp:FieldValue.serverTimestamp()});
 });
 return{success:true,imported:input.entries.length,persistence:'CONFIRMED'};
});
