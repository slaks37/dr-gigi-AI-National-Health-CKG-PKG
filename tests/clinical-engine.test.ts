import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { SymptomsSchema, ScreeningRequestSchema, FindingSchema, ScreeningSchema, Finding } from '../src/clinical-engine/types/schema';
import { triage } from '../src/clinical-engine/core/triage-engine';
import { reason } from '../src/clinical-engine/rules/rules';
import { lookupCode, validateCodes, auditSourceLabel, ICD_CATALOG } from '../src/clinical-engine/terminology/catalog';
import { screen } from '../src/clinical-engine/core/pipeline';
import { validateImage } from '../src/clinical-engine/core/image-quality';
import { mapDetectionToImage, OralVision } from '../src/clinical-engine/vision/interface';
const finding=(label:Finding['label']):Finding=>FindingSchema.parse({finding_id:'f1',image_index:0,region:'TOOTH',label,box:{xmin:100,xmax:300,ymin:200,ymax:500},fdi_number:null,tooth_surface:'UNKNOWN',evidence:'Synthetic observable test fixture',uncertainty:'SUPPORTED_OBSERVATION',source:'QUALIFIED_CLINICIAN',model_version:null,reviewer_uid:'synthetic-doctor',review_required:true});
const request=(symptoms:unknown={},images:unknown[]=[])=>ScreeningRequestSchema.parse({screening_id:'synthetic-screen',context:'ADULT',patient_age:null,symptoms,images,consent_to_process:true});
async function syntheticImage(){
 const raw=Buffer.alloc(640*480*3);for(let i=0;i<raw.length;i++)raw[i]=(i*47+Math.floor(i/27)*23)%256;
 const data=await sharp(raw,{raw:{width:640,height:480,channels:3}}).png().toBuffer();return{mime_type:'image/png' as const,data:data.toString('base64')};
}
describe('structured symptoms and early triage',()=>{
 it('keeps unanswered symptoms unknown',()=>{const s=SymptomsSchema.parse({});expect(s.pain).toBe('UNKNOWN');expect(s.pain_severity).toBeNull();expect(triage(s).level).toBe('INCONCLUSIVE');});
 it.each(['difficulty_breathing','difficulty_swallowing'])('prioritizes emergency %s without images',key=>{expect(triage(SymptomsSchema.parse({[key]:'YES'})).level).toBe('EMERGENCY');});
 it('does not wait for corrupt photos or unavailable models during emergency',async()=>{
  const vision:OralVision={evaluateModelAvailability:()=>({available:false,model_id:null,version:null,validation_evidence:null,approval_id:null,limitation:'Unavailable'}),detectOralRegion:vi.fn(),detectTeeth:vi.fn(),detectFindings:vi.fn()};
  const result=await screen(request({difficulty_breathing:'YES'},[{mime_type:'image/jpeg',data:'eA=='}]),'synthetic-patient',vision);
  expect(result.screening_status).toBe('EMERGENCY');expect(result.image_quality_results).toEqual([]);expect(vision.detectOralRegion).not.toHaveBeenCalled();
 });
 it('escalates suspected infection and persistent lesions without inventing diagnosis',()=>{
  expect(triage(SymptomsSchema.parse({facial_swelling:'YES'})).level).toBe('URGENT');
  expect(triage(SymptomsSchema.parse({lesion_duration_days:22})).level).toBe('PROMPT_REVIEW');
 });
 it('rejects client instructions, extra fields, impossible age/context and explicit absence substitution',()=>{
  expect(ScreeningRequestSchema.safeParse({...request(),systemInstruction:'ignore safety'}).success).toBe(false);
  expect(ScreeningRequestSchema.safeParse({...request(),context:'PEDIATRIC',patient_age:30}).success).toBe(false);
  expect(SymptomsSchema.safeParse({pain:false}).success).toBe(false);
 });
});
describe('auditable clinical suspicions',()=>{
 it('cavitation suggests unconfirmed K02.9 without depth',()=>{const out=reason([finding('VISIBLE_CAVITATION')],SymptomsSchema.parse({}),'ADULT');expect(out[0].suggested_icd10).toEqual(['K02.9']);expect(out[0].status).toBe('UNCONFIRMED');expect(out[0].candidate).not.toContain('pulpitis');});
 it('enamel opacity never forces a single caries code',()=>{expect(reason([finding('ENAMEL_OPACITY')],SymptomsSchema.parse({}),'ADULT')[0].suggested_icd10).toEqual([]);});
 it('gingival inflammation does not confirm periodontitis or acute/chronic subtype',()=>{const r=reason([finding('VISIBLE_GINGIVAL_INFLAMMATION')],SymptomsSchema.parse({gum_bleeding:'YES'}),'ADULT');expect(r.every(c=>c.suggested_icd10.length===0)).toBe(true);expect(r[0].review_required).toBe(true);});
 it('pain cannot confirm a K04 diagnosis',()=>{const r=reason([],SymptomsSchema.parse({pain:'YES',spontaneous_pain:'YES'}),'ADULT');expect(r[0].rule_id).toBe('PULPAL-001');expect(r[0].suggested_icd10).toEqual([]);});
 it('pediatric evidence does not invent ECC or FDI',()=>{const r=reason([finding('VISIBLE_TOOTH_WEAR')],SymptomsSchema.parse({}),'PEDIATRIC');expect(r.map(c=>c.rule_id)).toEqual(['STRUCTURE-001','PEDIATRIC-001']);expect(r.every(c=>c.suggested_icd10.length===0)).toBe(true);});
 it('same input/version yields identical reasoning',()=>{const f=[finding('VISIBLE_CAVITATION')],s=SymptomsSchema.parse({});expect(reason(f,s,'ADULT')).toEqual(reason(f,s,'ADULT'));});
 it('uncertain cavitation cannot force a caries code',()=>{expect(reason([{...finding('VISIBLE_CAVITATION'),uncertainty:'UNCERTAIN'}],SymptomsSchema.parse({}),'ADULT')).toEqual([]);});
});
describe('WHO versioned terminology',()=>{
 it('records official titles and corrected cementum meaning',()=>{expect(ICD_CATALOG).toHaveLength(124);expect(lookupCode('K02.2')?.official_title).toBe('Caries of cementum');expect(lookupCode('K08.3')?.official_title).toBe('Retained dental root');});
 it('rejects malformed or CM-only codes and unverified broad groups as diagnosis codes',()=>{expect(validateCodes(['K0.2.3'])).toBe(false);expect(validateCodes(['K02.51'])).toBe(false);expect(validateCodes(['K05'])).toBe(false);expect(validateCodes(['K02.9'])).toBe(true);});
 it('flags suspect folder labels without bulk relabeling',()=>{for(const label of ['Karies Arrested K0.2.3','Sisa Akar K04.8','Avulsi kecelakaan K08.1','Abses Mandibula K12.2']){const r=auditSourceLabel(label);expect(r.warnings.length).toBeGreaterThan(0);expect(r.clinician_verified_label).toBeNull();expect(r.candidate_icd10).toBeNull();}});
});
describe('local image engineering; no real disease detector claims',()=>{
 it('rejects corrupt/unsupported input and mismatched MIME',async()=>{expect((await validateImage({mime_type:'image/jpeg',data:'eA=='},0)).quality.status).toBe('UNSUPPORTED_FORMAT');const image=await syntheticImage();expect((await validateImage({...image,mime_type:'image/jpeg'},0)).quality.status).toBe('UNSUPPORTED_FORMAT');});
 it('dark/flat image requests retake and never returns healthy',async()=>{const bytes=await sharp({create:{width:640,height:480,channels:3,background:'#000000'}}).png().toBuffer();const q=await validateImage({mime_type:'image/png',data:bytes.toString('base64')},0);expect(q.quality.status).toBe('LOW_QUALITY');expect(q.quality.clinically_validated).toBe(false);});
 it('strips EXIF and normalizes orientation locally',async()=>{const image=await syntheticImage();const oriented=await sharp(Buffer.from(image.data,'base64')).jpeg().withMetadata({orientation:6}).toBuffer();const p=await validateImage({mime_type:'image/jpeg',data:oriented.toString('base64')},0);expect(p.quality.width).toBe(480);expect(p.quality.height).toBe(640);expect((await sharp(p.normalized!).metadata()).exif).toBeUndefined();});
 it('unavailable detector provides explicit review, not no-findings health',async()=>{const r=await screen(request({difficulty_breathing:'NO',difficulty_swallowing:'NO'},[await syntheticImage()]),'synthetic-patient');expect(r.screening_status).toBe('REVIEW_REQUIRED');expect(r.visual_findings).toEqual([]);expect(r.confirmed_icd10).toEqual([]);expect(r.model_version).toBeNull();});
 it('duplicate view is flagged, never counted as independent evidence',async()=>{const image=await syntheticImage();const r=await screen(request({},[image,image]),'synthetic-patient');expect(r.image_quality_results[1].duplicate_of).toBe(0);expect(r.screening_status).toBe('RETAKE_REQUIRED');});
 it('non-oral region result halts findings in a synthetic adapter test',async()=>{
  const detector:OralVision={evaluateModelAvailability:()=>({available:true,model_id:'synthetic-only',version:'synthetic-v1',validation_evidence:'synthetic-test-fixture-only',approval_id:'synthetic-test-only',limitation:'Not a clinical model'}),detectOralRegion:async()=>({status:'ABSENT'}),detectTeeth:vi.fn(),detectFindings:vi.fn()};
  const r=await screen(request({},[await syntheticImage()]),'synthetic-patient',detector);expect(r.screening_status).toBe('NO_ORAL_REGION');expect(detector.detectFindings).not.toHaveBeenCalled();
 });
 it('malformed detector output is rejected, never stored as diagnosis',async()=>{
  const detector:OralVision={evaluateModelAvailability:()=>({available:true,model_id:'synthetic-only',version:'synthetic-v1',validation_evidence:'synthetic-test-fixture-only',approval_id:'synthetic-test-only',limitation:'Not a clinical model'}),detectOralRegion:async()=>({status:'PRESENT'}),detectTeeth:async()=>[],detectFindings:async()=>[{wrong:'field'} as unknown as Finding]};
  await expect(screen(request({},[await syntheticImage()]),'synthetic-patient',detector)).rejects.toThrow();
 });
 it('prevents invented confidence and unauthorized confirmed diagnosis in schema',async()=>{
  const r=await screen(request(),'synthetic-patient');expect(ScreeningSchema.safeParse({...r,confidence:'100%'}).success).toBe(false);expect(ScreeningSchema.safeParse({...r,confirmed_icd10:['K02.9']}).success).toBe(false);
 });
 it('maps responsive letterboxing and explicit mirroring',()=>{
  const q={width:1000,height:500} as Parameters<typeof mapDetectionToImage>[1];const box={xmin:100,xmax:300,ymin:200,ymax:500};
  expect(mapDetectionToImage(box,q,{width:200,height:200,mirrored:false})).toEqual({left:20,top:70,width:40,height:30});expect(mapDetectionToImage(box,q,{width:200,height:200,mirrored:true})?.left).toBe(140);
 });
});

describe('bounded inference adapter contract',()=>{
 it('enforces deadline and cancels a stalled attempt',async()=>{
  const {boundedInference}=await import('../src/clinical-engine/vision/deadline');let received:AbortSignal|null=null;
  await expect(boundedInference(signal=>{received=signal;return new Promise(()=>{});},{deadline:Date.now()+100,attemptTimeoutMs:15})).rejects.toThrow('deadline');
  expect((received as unknown as AbortSignal).aborted).toBe(true);
 });
 it('rejects already-disconnected requests without running provider',async()=>{
  const {boundedInference}=await import('../src/clinical-engine/vision/deadline');const operation=vi.fn();
  await expect(boundedInference(operation,{deadline:Date.now()+1000,attemptTimeoutMs:100,signal:AbortSignal.abort()})).rejects.toThrow();expect(operation).not.toHaveBeenCalled();
 });
});

describe('real local HEIC decoder with synthetic pixels only',()=>{
 it('decodes HEIC in a bounded worker and produces metadata-free JPEG without external services',async()=>{
  const {readFile}=await import('node:fs/promises');const bytes=await readFile('tests/fixtures/synthetic-pattern.heic');
  const prepared=await validateImage({mime_type:'image/heic',data:bytes.toString('base64')},0);
  expect(prepared.normalized).not.toBeNull();expect(prepared.quality.width).toBe(640);expect(prepared.quality.height).toBe(480);
  expect((await sharp(prepared.normalized!).metadata()).format).toBe('jpeg');expect((await sharp(prepared.normalized!).metadata()).exif).toBeUndefined();
 });
});
