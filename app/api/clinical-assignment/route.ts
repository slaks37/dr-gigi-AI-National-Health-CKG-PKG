import { api, requireAdmin, readJson, onlyKeys, validId, ApiError } from '@/src/server/security';
import { adminAuth } from '@/src/lib/firebase-admin';
import { store } from '@/src/server/store';
import { FieldValue } from 'firebase-admin/firestore';
export const POST=api(async(req,p)=>{
 requireAdmin(p);const body=await readJson(req,4096);onlyKeys(body,['screening_id','clinician_uid','expected_version','action']);
 const id=validId(body.screening_id),clinician=validId(body.clinician_uid);
 if(!Number.isInteger(body.expected_version)||!['ASSIGN','REVOKE'].includes(String(body.action)))throw new ApiError(400,'Invalid assignment');
 if(body.action==='ASSIGN'){
  const target=await adminAuth.getUser(clinician);
  if(target.disabled||target.customClaims?.role!=='doctor'||target.customClaims?.clinicalReviewer!==true)throw new ApiError(403,'Target must be a verified qualified dentist');
 }
 const ref=store().collection('records').doc(id);
 return store().runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new ApiError(404,'Screening not found');const data=snap.data()!;
  if(!data.screening||data.version!==body.expected_version)throw new ApiError(409,'Reload the screening before assignment');
  if(clinician===data.createdBy)throw new ApiError(403,'Independent dentist required');
  const assigned=Array.isArray(data.assignedClinicianUids)?data.assignedClinicianUids.filter((x:unknown)=>typeof x==='string'):[];
  const next=body.action==='ASSIGN'?[...new Set([...assigned,clinician])]:assigned.filter((uid:string)=>uid!==clinician);
  if(next.length>20)throw new ApiError(400,'Assignment limit reached');
  const version=data.version+1;
  tx.update(ref,{assignedClinicianUids:next,version,updatedAt:new Date().toISOString()});
  tx.create(store().collection('auditLogs').doc(),{actorUid:p.uid,action:`CLINICIAN_${body.action}`,resourceId:id,clinicianUid:clinician,timestamp:FieldValue.serverTimestamp()});
  return{success:true,recordId:id,version,persistence:'CONFIRMED'};
 });
});
