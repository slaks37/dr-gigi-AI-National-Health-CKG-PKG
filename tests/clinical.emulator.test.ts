import { beforeAll,beforeEach,afterAll,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.hoisted(()=>{process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8088';process.env.GCLOUD_PROJECT='demo-drgigi-repair';process.env.FIRESTORE_DATABASE_ID='(default)';});
import { adminAuth } from '../src/lib/firebase-admin';
import { store } from '../src/server/store';
import * as screenings from '../app/api/screenings/route';
import * as review from '../app/api/clinical-review/route';
import * as assignment from '../app/api/clinical-assignment/route';
import * as datasetImport from '../app/api/dataset/import/route';
import * as annotate from '../app/api/dataset/annotations/route';
import * as labelReview from '../app/api/dataset/review/route';
import * as records from '../app/api/records/route';
import { DatasetEntrySchema } from '../src/dataset/schema';
const request=(path:string,uid?:string,method='GET',body?:unknown)=>new NextRequest(`http://localhost/api/${path}`,{method,headers:{...(uid?{Authorization:`Bearer ${uid}`} :{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const input=(symptoms:unknown={})=>({screening_id:'synthetic-screen',context:'ADULT',patient_age:30,symptoms,images:[],consent_to_process:true});
beforeAll(()=>{
 vi.spyOn(adminAuth,'verifyIdToken').mockImplementation(async uid=>({uid,sub:uid,role:uid==='synthetic-admin'?'admin':uid.includes('doctor')?'doctor':'patient',clinicalReviewer:uid.includes('doctor')&&!uid.includes('unqualified'),datasetScopes:uid.includes('doctor')?['SONRI']:[],aud:'demo-drgigi-repair',auth_time:0,exp:9999999999,iat:0,iss:'synthetic-emulator',firebase:{identities:{},sign_in_provider:'custom'}}));
 vi.spyOn(adminAuth,'getUser').mockImplementation(async uid=>({uid,disabled:false,emailVerified:false,metadata:{creationTime:'2026-01-01T00:00:00Z',lastSignInTime:'2026-01-01T00:00:00Z',toJSON:()=>({})},providerData:[],toJSON:()=>({}),customClaims:{role:'doctor',clinicalReviewer:!uid.includes('unqualified')}} as Awaited<ReturnType<typeof adminAuth.getUser>>));
});
beforeEach(async()=>{
 if(process.env.GCLOUD_PROJECT!=='demo-drgigi-repair'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8088')throw new Error('Synthetic emulator required');
 for(const name of ['records','auditLogs','screeningQuotas','clinicalReviews','datasetEntries','datasetAnnotations','datasetLabelReviews','patients']){const docs=await store().collection(name).get();await Promise.all(docs.docs.map(d=>d.ref.delete()));}
});
afterAll(()=>vi.restoreAllMocks());
describe('structured screening security and persistence',()=>{
 it.each([['screenings',screenings.POST],['clinical-review',review.POST],['clinical-assignment',assignment.POST],['dataset/import',datasetImport.POST],['dataset/annotations',annotate.POST],['dataset/review',labelReview.POST]] as const)('denies anonymous %s',async(path,handler)=>{expect((await handler(request(path,undefined,'POST',{}))).status).toBe(401);});
 it('stores deterministic screening, preserves unknowns, and forbids cross-patient retrieval',async()=>{
  const response=await screenings.POST(request('screenings','synthetic-patient','POST',input()));expect(response.status).toBe(200);const saved=await response.json();expect(saved.persistence).toBe('CONFIRMED');expect(saved.screening.symptoms.pain).toBe('UNKNOWN');expect(saved.screening.confirmed_icd10).toEqual([]);
  expect((await screenings.GET(request('screenings?id=synthetic-screen','other-patient'))).status).toBe(403);
  const retry=await screenings.POST(request('screenings','synthetic-patient','POST',input()));expect(retry.status).toBe(200);expect((await store().collection('auditLogs').get()).size).toBe(1);
 });
 it('patient cannot forge clinician-confirmed result or privileged role via old record endpoint',async()=>{
  const response=await records.POST(request('records','synthetic-patient','POST',{id:'forged',payload:{type:'manual',json_output:{screening:{screening_status:'CLINICIAN_CONFIRMED'}}}}));expect(response.status).toBe(400);
  expect((await screenings.POST(request('screenings','synthetic-patient','POST',{...input(),visual_findings:[],role:'admin'}))).status).toBe(400);
 });
 it('emergency advice survives unsupported photo, quota exhaustion and persistence outage',async()=>{
  const quota=store().collection('screeningQuotas').doc('synthetic-patient');await quota.set({day:new Date().toISOString().slice(0,10),count:50,recent:[]});
  const response=await screenings.POST(request('screenings','synthetic-patient','POST',{...input({difficulty_breathing:'YES'}),images:[{mime_type:'invalid',data:'corrupt'}]}));
  expect(response.status).toBe(429);const body=await response.json();expect(body.screening.screening_status).toBe('EMERGENCY');expect(body.persistence).toBe('FAILED');expect((await store().collection('records').get()).size).toBe(0);
 });
 it('links pediatric subject to an owned child profile and guardian authorization, never the parent as patient',async()=>{
  await store().collection('patients').doc('synthetic-child').set({id:'synthetic-child',userId:'synthetic-patient',name:'Synthetic child fixture'});
  const body={...input(),context:'PEDIATRIC',patient_age:5,patient_subject_id:'synthetic-child',guardian_authorized:true};
  expect((await screenings.POST(request('screenings','other-patient','POST',body))).status).toBe(403);
  expect((await screenings.POST(request('screenings','synthetic-patient','POST',{...body,guardian_authorized:false}))).status).toBe(400);
  const response=await screenings.POST(request('screenings','synthetic-patient','POST',body));expect(response.status).toBe(200);expect((await response.json()).screening.patient_id).toBe('synthetic-child');
 });
 it('unlinked pediatric emergency still advises immediate care without inventing a patient identity',async()=>{
  const body={...input({difficulty_breathing:'YES'}),context:'PEDIATRIC',patient_age:5,images:[{mime_type:'invalid',data:'corrupt'}]};
  const response=await screenings.POST(request('screenings','synthetic-patient','POST',body));expect(response.status).toBe(200);const result=(await response.json()).screening;expect(result.screening_status).toBe('EMERGENCY');expect(result.patient_id).toBeNull();expect(result.evidence_provenance.subject_linkage).toBe('UNKNOWN');
 });
 it('daily quota denies processing and never invents persisted success',async()=>{await store().collection('screeningQuotas').doc('synthetic-patient').set({day:new Date().toISOString().slice(0,10),count:50,recent:[]});expect((await screenings.POST(request('screenings','synthetic-patient','POST',input()))).status).toBe(429);});
});
describe('independent qualified dentist confirmation',()=>{
 const evidence={screening_id:'synthetic-screen',expected_version:2,decision:'APPROVED',note:'Synthetic examination fixture only',findings:[],confirmed_icd10:['K02.9'],clinical_evidence:['Synthetic direct clinical exam fixture'],examinations:{clinical_exam:true,radiography:false,vitality_test:false,periodontal_exam:false,histopathology:false},orientation_known:false,anatomical_context_known:false};
 async function setup(){await screenings.POST(request('screenings','synthetic-patient','POST',input()));expect((await assignment.POST(request('clinical-assignment','synthetic-admin','POST',{screening_id:'synthetic-screen',clinician_uid:'synthetic-doctor',expected_version:1,action:'ASSIGN'}))).status).toBe(200);}
 it('assigned qualified doctor confirms with actual evidence fields and audit/version',async()=>{
  await setup();const response=await review.POST(request('clinical-review','synthetic-doctor','POST',evidence));expect(response.status).toBe(200);const body=await response.json();expect(body.screening.screening_status).toBe('CLINICIAN_CONFIRMED');expect(body.screening.confirmed_icd10).toEqual(['K02.9']);expect(body.version).toBe(3);expect((await store().collection('clinicalReviews').get()).size).toBe(1);
  expect((await review.POST(request('clinical-review','synthetic-doctor','POST',evidence))).status).toBe(409);
 });
 it('rejects unassigned/unqualified roles, missing exam and unsupported code',async()=>{
  await setup();expect((await review.POST(request('clinical-review','other-doctor','POST',evidence))).status).toBe(403);expect((await review.POST(request('clinical-review','unqualified-doctor','POST',evidence))).status).toBe(403);expect((await review.POST(request('clinical-review','synthetic-patient','POST',evidence))).status).toBe(403);
  expect((await review.POST(request('clinical-review','synthetic-doctor','POST',{...evidence,examinations:{...evidence.examinations,clinical_exam:false}}))).status).toBe(400);
  expect((await review.POST(request('clinical-review','synthetic-doctor','POST',{...evidence,confirmed_icd10:['K02.51']}))).status).toBe(400);
 });
 it('only administrator can assign a qualified dentist; browser promotion cannot grant access',async()=>{
  await screenings.POST(request('screenings','synthetic-patient','POST',input()));
  expect((await assignment.POST(request('clinical-assignment','synthetic-patient','POST',{screening_id:'synthetic-screen',clinician_uid:'synthetic-doctor',expected_version:1,action:'ASSIGN'}))).status).toBe(403);
  expect((await assignment.POST(request('clinical-assignment','synthetic-admin','POST',{screening_id:'synthetic-screen',clinician_uid:'unqualified-doctor',expected_version:1,action:'ASSIGN'}))).status).toBe(403);
 });
});
describe('dataset annotations with metadata provenance and independent label review',()=>{
 const image='a'.repeat(64);const entry=DatasetEntrySchema.parse({image_id:image,patient_group_id:'synthetic-group',source_folder_label:'WEAK_K02.9',candidate_icd10:null,clinician_verified_label:null,visual_finding_labels:[],review_status:'UNREVIEWED',reviewer_id:null,review_timestamp:null,label_version:'1',consent_status:'DOCUMENTED_VERIFIED',data_usage_permission:'TRAINING_APPROVED',permission_evidence_reference:'synthetic-permission-only',source_provenance:'synthetic-test-only',sha256:'b'.repeat(64),perceptual_hash:'abcdef0123456789',duplicate_group_id:'synthetic-duplicate',near_duplicate_group_id:'synthetic-near',quality_status:'ACCEPTED',mime_type:'image/jpeg',size_bytes:100,width:640,height:480,dataset_version:'synthetic-v1',independent_review_status:'PENDING'});
 const annotation={image_id:image,anonymous_patient_group_id:'synthetic-group',source_image_id:image,anatomical_region:'TOOTH',finding_type:'VISIBLE_CAVITATION',box:{xmin:100,ymin:100,xmax:300,ymax:400},segmentation:null,fdi_number:null,orientation_known:false,anatomical_context_known:false,dentition:'UNKNOWN',tooth_surface:'UNKNOWN',visibility:'VISIBLE',uncertain:false,notes:'Synthetic annotation only',status:'REVIEW_REQUIRED',dataset_version:'synthetic-v1',expected_version:0};
 async function setup(){expect((await datasetImport.POST(request('dataset/import','synthetic-admin','POST',{dataset_id:'SONRI',entries:[entry]}))).status).toBe(200);expect((await annotate.POST(request('dataset/annotations','synthetic-doctor','POST',{annotation_id:'synthetic-ann',annotation,image_sha256:entry.sha256}))).status).toBe(200);}
 it('rejects patient import and annotation, fake source hash and import of verified labels',async()=>{
  expect((await datasetImport.POST(request('dataset/import','synthetic-patient','POST',{dataset_id:'SONRI',entries:[entry]}))).status).toBe(403);
  expect((await datasetImport.POST(request('dataset/import','synthetic-admin','POST',{dataset_id:'SONRI',entries:[{...entry,review_status:'ACCEPTED',clinician_verified_label:'VISIBLE_CAVITATION'}]}))).status).toBe(400);
  await setup();expect((await annotate.POST(request('dataset/annotations','synthetic-patient','POST',{annotation_id:'fake',annotation,image_sha256:entry.sha256}))).status).toBe(403);
  expect((await annotate.POST(request('dataset/annotations','other-doctor','POST',{annotation_id:'fake',annotation,image_sha256:'c'.repeat(64)}))).status).toBe(403);
 });
 it('author cannot approve own annotation; independent reviewer records disagreement/version',async()=>{
  await setup();const body={annotation_id:'synthetic-ann',expected_version:1,decision:'CORRECTED',verified_label:'VISIBLE_TOOTH_FRACTURE',finding_type:'VISIBLE_TOOTH_FRACTURE',note:'Synthetic independent correction',image_review_complete:true};
  expect((await labelReview.POST(request('dataset/review','synthetic-doctor','POST',body))).status).toBe(403);
  const response=await labelReview.POST(request('dataset/review','other-doctor','POST',body));expect(response.status).toBe(200);
  const a=(await store().collection('datasetAnnotations').doc('synthetic-ann').get()).data()!;expect(a.disagreement).toBe(true);expect(a.verification_status).toBe('APPROVED');
  expect((await store().collection('datasetEntries').doc(image).get()).data()?.independent_review_status).toBe('APPROVED');
 });
});
