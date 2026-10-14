import { describe,it,expect } from 'vitest';
import { inventoryDrive, safeFolderLabel } from '../src/dataset/drive-adapter';
import { DatasetEntrySchema, AnnotationSchema, trainingEligible, DatasetEntry } from '../src/dataset/schema';
import { patientSplit, hammingDistance } from '../src/dataset/split';
import { prepareTraining, ApprovedAnnotation } from '../src/dataset/training';
import { evaluateBinary } from '../src/dataset/evaluation';
const entry=(id:string,patient:string):DatasetEntry=>DatasetEntrySchema.parse({image_id:id.repeat(64),patient_group_id:patient,source_folder_label:'WEAK_K02.9',candidate_icd10:null,clinician_verified_label:'VISIBLE_CAVITATION',visual_finding_labels:['VISIBLE_CAVITATION'],review_status:'ACCEPTED',reviewer_id:'reviewer-2',review_timestamp:'2026-01-01T00:00:00Z',label_version:'1',consent_status:'DOCUMENTED_VERIFIED',data_usage_permission:'TRAINING_APPROVED',permission_evidence_reference:'synthetic-permission',source_provenance:'synthetic',sha256:id.repeat(64),perceptual_hash:'abcdef0123456789',duplicate_group_id:`duplicate-${id}`,near_duplicate_group_id:`near-${id}`,quality_status:'ACCEPTED',mime_type:'image/jpeg',size_bytes:100,width:640,height:480,dataset_version:'synthetic-v1',independent_review_status:'APPROVED'});
describe('private authorized dataset inventory',()=>{
 it('traverses paginated folders and removes patient filenames',async()=>{
  const calls:string[]=[];
  const result=await inventoryDrive({listChildren:async(parent,token)=>{calls.push(parent+':'+(token??''));if(parent==='root-folder')return{files:[{id:'child',mimeType:'application/vnd.google-apps.folder',name:'Karies K02.9'}]};return token?{files:[{id:'image-b',mimeType:'image/heif',name:'private-person-name.heic'}]}:{files:[{id:'image-a',mimeType:'image/jpeg',name:'private-person-name.jpg'}],nextPageToken:'next'};}},'root-folder','v1');
  expect(result.entries).toHaveLength(2);expect(calls).toEqual(['root-folder:','child:','child:next']);expect(JSON.stringify(result)).not.toContain('private-person');expect(result.entries[0].source_folder_label).toBe('WEAK_K02.9');expect(result.entries.every(e=>!trainingEligible(e))).toBe(true);expect(result.downloaded_images).toBe(0);
 });
 it('never treats incomplete listings or repeated cursors as completed inventory',async()=>{
  const result=await inventoryDrive({listChildren:async()=>({files:[],incompleteSearch:true})},'root','v1');expect(result.complete).toBe(false);
  await expect(inventoryDrive({listChildren:async()=>({files:[],nextPageToken:'same'})},'root','v1')).rejects.toThrow('pagination');
 });
 it('folder names remain weak and personal folder labels are not exported',()=>{expect(safeFolderLabel('private-person')).toBe('UNVERIFIED_SOURCE');expect(safeFolderLabel('Karies K0.2.3')).toBe('MALFORMED_CODE_REVIEW');});
});
describe('permission and leakage gates',()=>{
 it('excludes unverified consent, labels, quality, patient identity and duplicate audit',()=>{
  const e=entry('a','patient-a');expect(trainingEligible(e)).toBe(true);
  for(const patch of [{consent_status:'UNKNOWN'},{consent_status:'USER_ATTESTED_VERIFIED'},{review_status:'UNREVIEWED'},{patient_group_id:null},{independent_review_status:'PENDING'},{near_duplicate_group_id:null},{sha256:null},{permission_evidence_reference:null}])expect(trainingEligible({...e,...patch} as DatasetEntry)).toBe(false);
 });
 it('patient-level grouping and transitive near duplicates never cross splits',()=>{
  const a=entry('a','patient-a'),b={...entry('b','patient-a'),near_duplicate_group_id:'bridge'},c={...entry('c','patient-c'),near_duplicate_group_id:'bridge'};
  const result=patientSplit([a,b,c],'frozen-seed');expect(new Set(result.map(r=>r.split)).size).toBe(1);
  expect(patientSplit([a,b,c],'frozen-seed')).toEqual(patientSplit([a,b,c],'frozen-seed'));
 });
 it('training preparation rejects weak/unapproved datasets rather than simulating training',()=>{expect(()=>prepareTraining([{...entry('a','patient'),review_status:'UNREVIEWED'}],[],{seed:'seed',datasetVersion:'synthetic-v1',minimumExamplesPerClass:1,labelQualityApprovalReference:'synthetic-only'})).toThrow();});
 it('exports frozen synthetic COCO using independently corrected labels and annotation versions',()=>{
  const entries=Array.from({length:80},(_,i)=>{const id=i.toString(16).padStart(64,'0');return {...entry('a',`patient-${i}`),image_id:id,sha256:id,duplicate_group_id:`exact-${i}`,near_duplicate_group_id:`near-${i}`};});
  const annotations:ApprovedAnnotation[]=entries.map((e,i)=>({image_id:e.image_id,source_image_id:e.image_id,anonymous_patient_group_id:e.patient_group_id,anatomical_region:'TOOTH',finding_type:'VISIBLE_CAVITATION',reviewed_finding_type:'TOOTH_DISCOLORATION',box:{xmin:100,ymin:100,xmax:300,ymax:400},segmentation:null,fdi_number:null,orientation_known:false,anatomical_context_known:false,dentition:'UNKNOWN',tooth_surface:'UNKNOWN',visibility:'VISIBLE',uncertain:false,notes:'Synthetic only',status:'DRAFT',dataset_version:e.dataset_version,expected_version:0,verification_status:'APPROVED',author_uid:'author',clinical_reviewer_uid:'independent',image_sha256:e.sha256!,annotation_id:`annotation-${i}`,version:1}));
  const options={seed:'synthetic-seed',datasetVersion:'synthetic-v1',minimumExamplesPerClass:1,labelQualityApprovalReference:'synthetic-test-only'};
  const prepared=prepareTraining(entries,annotations,options);
  expect(prepared.models_trained).toBe(0);expect(prepared.class_counts).toEqual({TOOTH_DISCOLORATION:80});
  expect(Object.values(prepared.split_counts).every(n=>n>0)).toBe(true);
  expect(Object.values(prepared.coco).flatMap(c=>c.annotations)).toHaveLength(80);
  expect(prepareTraining(entries,annotations,options).manifest_sha256).toBe(prepared.manifest_sha256);
  expect(prepareTraining(entries,annotations.map((a,i)=>i? a:{...a,version:2}),options).manifest_sha256).not.toBe(prepared.manifest_sha256);
  expect(()=>prepareTraining(entries,annotations.slice(1),options)).toThrow('Each included image');
 });
 it('computes actual evaluation metrics only from matched labels, not fabricated fallbacks',()=>{expect(evaluateBinary([true,true,false,false],[true,false,true,false])).toMatchObject({sample_count:4,confusion_matrix:{tp:1,tn:1,fp:1,fn:1},precision:0.5,recall:0.5});expect(()=>evaluateBinary([],[])).toThrow();});
 it('perceptual distance is reproducible and invalid hashes rejected',()=>{expect(hammingDistance('0000000000000000','0000000000000001')).toBe(1);expect(()=>hammingDistance('bad','bad')).toThrow();});
});
describe('annotation boundaries',()=>{
 const a={image_id:'a'.repeat(64),anonymous_patient_group_id:null,source_image_id:'a'.repeat(64),anatomical_region:'TOOTH',finding_type:'VISIBLE_CAVITATION',box:{xmin:100,xmax:300,ymin:100,ymax:400},segmentation:null,fdi_number:null,orientation_known:false,anatomical_context_known:false,dentition:'UNKNOWN',tooth_surface:'UNKNOWN',visibility:'UNCERTAIN',uncertain:true,notes:'Synthetic annotation',status:'REVIEW_REQUIRED',dataset_version:'v1',expected_version:0};
 it('does not invent FDI or confuse adult numbering with primary dentition',()=>{expect(AnnotationSchema.safeParse(a).success).toBe(true);expect(AnnotationSchema.safeParse({...a,fdi_number:'11'}).success).toBe(false);expect(AnnotationSchema.safeParse({...a,fdi_number:'11',orientation_known:true,anatomical_context_known:true,dentition:'PRIMARY'}).success).toBe(false);});
 it('rejects invalid boxes and self-proclaimed approved state',()=>{expect(AnnotationSchema.safeParse({...a,box:{xmin:400,xmax:100,ymin:0,ymax:1001}}).success).toBe(false);expect(AnnotationSchema.safeParse({...a,status:'APPROVED'}).success).toBe(false);});
});
