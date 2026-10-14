import 'server-only';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { store } from './store';
import { ApiError, Principal, requireAccess } from './security';
import type { Screening, ScreeningRequest } from '../clinical-engine/types/schema';
function canonical(value:unknown):string { if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value); }
export function clinicalHash(input:ScreeningRequest){return createHash('sha256').update(canonical(input)).digest('hex');}
export async function existingScreening(id:string,p:Principal,hash?:string) {
 const snap=await store().collection('records').doc(id).get();
 if(!snap.exists)return null;
 const data=snap.data()!;requireAccess(p,data);
 if(!data.screening)throw new ApiError(409,'ID belongs to a different record');
 if(hash&&data.clinicalRequestHash!==hash)throw new ApiError(409,'Screening request changed; use a new ID');
 return data;
}
export async function reserveQuota(uid:string) {
 const ref=store().collection('screeningQuotas').doc(uid);
 await store().runTransaction(async tx=>{
  const snap=await tx.get(ref);const d=snap.data();const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
  const count=d?.day===day?Number(d.count||0):0;const recent=Array.isArray(d?.recent)?d.recent.filter((n:unknown)=>typeof n==='number'&&now-n<60000):[];
  if(count>=50||recent.length>=10)throw new ApiError(429,'Screening quota reached; retry later');
  tx.set(ref,{day,count:count+1,recent:[...recent,now],updatedAt:FieldValue.serverTimestamp()});
 });
}
export async function persistScreening(result:Screening,p:Principal,hash:string) {
 const ref=store().collection('records').doc(result.screening_id);
 return store().runTransaction(async tx=>{
  const existing=await tx.get(ref);
  if(existing.exists){const d=existing.data()!;requireAccess(p,d);if(d.clinicalRequestHash!==hash)throw new ApiError(409,'Screening ID conflict');return d;}
  const now=new Date().toISOString();
  const data={id:result.screening_id,userId:p.uid,version:1,type:result.context==='PEDIATRIC'?'Skrining Oral Anak Terstruktur':'Skrining Oral Dewasa Terstruktur',timestamp:now,createdAt:now,updatedAt:now,createdBy:p.uid,assignedClinicianUids:[],source:'structured-screening',verificationStatus:'draft',satusehatSynced:false,confidence:'Belum tervalidasi',clinicalRequestHash:hash,screening:result,json_output:{screening:result,patient_id:result.patient_id},diagnosa:'Skrining belum dikonfirmasi dokter',icd10:'',markdown_report:result.recommendations.join('\n\n')};
  tx.create(ref,data);
  tx.create(store().collection('auditLogs').doc(),{actorUid:p.uid,action:'SCREENING_CREATE',resourceId:result.screening_id,resourceType:'records',timestamp:FieldValue.serverTimestamp()});
  return data;
 });
}
