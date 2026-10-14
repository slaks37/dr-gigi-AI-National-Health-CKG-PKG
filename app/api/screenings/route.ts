import { api, ApiError, readJson, validId } from '@/src/server/security';
import { ScreeningRequestSchema, ScreeningEnvelopeSchema, ScreeningRequest } from '@/src/clinical-engine/types/schema';
import { parse } from '@/src/clinical-engine/validation/parse';
import { triage } from '@/src/clinical-engine/core/triage-engine';
import { screen } from '@/src/clinical-engine/core/pipeline';
import { explainScreening } from '@/src/clinical-engine/core/explanation';
import { clinicalHash, existingScreening, persistScreening, reserveQuota } from '@/src/server/clinical-store';
export const maxDuration=60;
export const GET=api(async(req,p)=>{
 const id=req.nextUrl.searchParams.get('id');
 if(id){
  const data=await existingScreening(validId(id),p);
  if(!data)throw new ApiError(404,'Screening not found');
  return{success:true,recordId:data.id,version:data.version,screening:data.screening,persistence:'CONFIRMED'};
 }
 const {store}=await import('@/src/server/store');
 const view=req.nextUrl.searchParams.get('view')||'mine';
 let query=store().collection('records').where('userId','==',p.uid).orderBy('__name__').limit(50);
 if(view==='assigned'){
  if(p.role!=='doctor'||!p.clinicalReviewer)throw new ApiError(403,'Verified dentist required');
  query=store().collection('records').where('assignedClinicianUids','array-contains',p.uid).orderBy('__name__').limit(50);
 }else if(view==='admin'){
  if(p.role!=='admin')throw new ApiError(403,'Administrator required');
  query=store().collection('records').orderBy('__name__').limit(50);
 }else if(view!=='mine')throw new ApiError(400,'Invalid view');
 const cursor=req.nextUrl.searchParams.get('cursor');if(cursor)query=query.startAfter(validId(cursor));
 const snapshots=await query.get();
 return{success:true,records:snapshots.docs.filter(d=>!!d.data().screening).map(d=>({id:d.id,...d.data()})),nextCursor:snapshots.size===50?snapshots.docs.at(-1)?.id:null};
});
export const POST=api(async(req,p)=>{
 const raw=await readJson(req,4_000_000);
 const envelope=parse(ScreeningEnvelopeSchema,raw);
 const emergency=triage(envelope.symptoms).level==='EMERGENCY';
 // Emergency advice must survive malformed media, quota rejection or persistence failure.
 const input=emergency?({...envelope,images:[]} as ScreeningRequest):parse(ScreeningRequestSchema,raw);
 const hash=clinicalHash(input);
 const emergencyResult=emergency?await screen(input,p.uid):null;
 try{
  if(input.patient_subject_id){
   const {store}=await import('@/src/server/store');const patient=await store().collection('patients').doc(input.patient_subject_id).get();
   if(!patient.exists||patient.data()?.userId!==p.uid)throw new ApiError(403,'Patient subject must belong to the authenticated account');
  }
  const previous=await existingScreening(input.screening_id,p,hash);
  if(previous)return{success:true,recordId:previous.id,version:previous.version,screening:previous.screening,persistence:'CONFIRMED',explanation:explainScreening(previous.screening)};
  await reserveQuota(p.uid);
  const result=emergencyResult??await screen(input,p.uid,undefined,undefined,req.signal);
  req.signal.throwIfAborted();
  const saved=await persistScreening(result,p,hash);
  return{success:true,recordId:saved.id,version:saved.version,screening:result,persistence:'CONFIRMED',explanation:explainScreening(result)};
 }catch(error){
  if(emergencyResult){
   const {NextResponse}=await import('next/server');
   const status=error instanceof ApiError?error.status:503;
   return NextResponse.json({success:false,screening:emergencyResult,persistence:'FAILED',error:'Hasil belum tersimpan. Jangan menunda pertolongan darurat.',explanation:explainScreening(emergencyResult)},{status});
  }
  throw error;
 }
});
