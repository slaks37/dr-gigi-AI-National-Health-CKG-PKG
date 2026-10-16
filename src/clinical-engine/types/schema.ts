import { z } from 'zod';
import { ClinicalEvidenceSchema } from '../evidence/schema';
export const ENGINE_VERSION = 'hybrid-research-1.0.0';
export const Truth = z.enum(['YES', 'NO', 'UNKNOWN']);
export const symptomKeys = ['pain', 'spontaneous_pain', 'cold_pain', 'heat_pain', 'sweet_pain', 'chewing_pain', 'gum_bleeding', 'gingival_swelling', 'facial_swelling', 'pus_or_drainage', 'fever', 'difficulty_swallowing', 'difficulty_breathing', 'difficulty_opening_mouth', 'recent_extraction', 'recent_trauma', 'persistent_oral_ulcer'] as const;
export const SymptomsSchema = z.strictObject(Object.fromEntries(symptomKeys.map(key => [key, Truth.default('UNKNOWN')])) as Record<typeof symptomKeys[number], z.ZodDefault<typeof Truth>>).extend({
  pain_severity: z.number().int().min(0).max(10).nullable().default(null),
  pain_duration_days: z.number().int().min(0).max(3650).nullable().default(null),
  lesion_duration_days: z.number().int().min(0).max(3650).nullable().default(null),
  dental_history: z.string().max(2000).default(''),
});
export type Symptoms = z.infer<typeof SymptomsSchema>;
export const FindingLabels = ['VISIBLE_CAVITATION','ENAMEL_OPACITY','TOOTH_DISCOLORATION','POSSIBLE_CALCULUS','VISIBLE_GINGIVAL_INFLAMMATION','VISIBLE_GINGIVAL_RECESSION','VISIBLE_ORAL_ULCER','VISIBLE_ORAL_SWELLING','WHITE_OR_RED_MUCOSAL_PATCH','VISIBLE_TOOTH_WEAR','VISIBLE_TOOTH_FRACTURE','VISIBLE_MISSING_TOOTH_REGION','ABNORMAL_TONGUE_APPEARANCE','OTHER_UNCERTAIN_LESION'] as const;
export const AnatomicalRegions = ['TOOTH','GINGIVA','TONGUE','BUCCAL_MUCOSA','LIP','PALATE','ORAL_REGION','UNKNOWN'] as const;
export const BoxSchema = z.strictObject({ xmin: z.number().min(0).max(1000), ymin: z.number().min(0).max(1000), xmax: z.number().min(0).max(1000), ymax: z.number().min(0).max(1000) }).refine(b => b.xmin < b.xmax && b.ymin < b.ymax, 'Invalid bounding box');
export const FindingSchema = z.strictObject({
  finding_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), image_index: z.number().int().min(0).max(3),
  region: z.enum(AnatomicalRegions), label: z.enum(FindingLabels), box: BoxSchema.nullable(),
  fdi_number: z.string().regex(/^(?:[1-4][1-8]|[5-8][1-5])$/).nullable(), tooth_surface: z.enum(['BUCCAL','LINGUAL','PALATAL','MESIAL','DISTAL','OCCLUSAL','INCISAL','UNKNOWN']),
  evidence: z.string().min(1).max(1000), uncertainty: z.enum(['UNCERTAIN','SUPPORTED_OBSERVATION']),
  source: z.enum(['VALIDATED_DETECTOR','QUALIFIED_CLINICIAN']), model_version: z.string().nullable(), reviewer_uid: z.string().nullable(),
  review_required: z.literal(true),
});
export type Finding = z.infer<typeof FindingSchema>;
export const QualitySchema = z.strictObject({
  image_index: z.number().int().min(0).max(3), status: z.enum(['VALID','LOW_QUALITY','NO_ORAL_REGION','INSUFFICIENT_VISIBILITY','UNSUPPORTED_FORMAT','CORRUPT_IMAGE','REVIEW_REQUIRED']),
  width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(), sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  brightness: z.number().min(0).max(255).nullable(), blur_variance: z.number().min(0).nullable(),
  oral_region_status: z.enum(['PRESENT','ABSENT','NOT_ASSESSED']), reasons: z.array(z.string()).max(10), duplicate_of: z.number().int().min(0).max(3).nullable(),
  quality_gate_version: z.literal('engineering-heuristic-1'), clinically_validated: z.literal(false),
});
export type ImageQuality = z.infer<typeof QualitySchema>;
export const CandidateSchema = z.strictObject({
  rule_id: z.string(), rule_version: z.string(), candidate: z.string(), explanation: z.string(), required_examinations: z.array(z.string()), suggested_icd10: z.array(z.string()), review_required: z.literal(true), status: z.literal('UNCONFIRMED'), references: z.array(z.string().url()),
});
export type Candidate = z.infer<typeof CandidateSchema>;
export const TriageSchema = z.strictObject({ level: z.enum(['EMERGENCY','URGENT','PROMPT_REVIEW','ROUTINE_REVIEW','INCONCLUSIVE']), reasons: z.array(z.string()), recommendation: z.string(), references: z.array(z.string().url()), rule_version: z.literal('triage-research-1'), clinical_approval: z.literal('PENDING') });
export type Triage = z.infer<typeof TriageSchema>;
export const ScreeningSchema = z.strictObject({
  screening_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), patient_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable(), screening_timestamp: z.string().datetime(),
  engine_version: z.literal(ENGINE_VERSION), model_version: z.string().nullable(), terminology_version: z.string(),
  screening_status: z.enum(['EMERGENCY','INVALID_IMAGE','RETAKE_REQUIRED','NO_ORAL_REGION','LOW_QUALITY','INCONCLUSIVE','NO_VISIBLE_FINDINGS','FINDINGS_PRESENT','REVIEW_REQUIRED','CLINICIAN_CONFIRMED','PROCESSING_ERROR']),
  clinical_evidence: ClinicalEvidenceSchema.optional(),
  context: z.enum(['ADULT','PEDIATRIC']), patient_age: z.number().int().min(0).max(120).nullable(), symptoms: SymptomsSchema,
  image_quality_results: z.array(QualitySchema).max(4), visual_findings: z.array(FindingSchema).max(200), clinical_suspicions: z.array(CandidateSchema), differential_diagnoses: z.array(z.string()),
  triage_level: TriageSchema.shape.level, triage: TriageSchema, suggested_icd10: z.array(z.string()), confirmed_icd10: z.array(z.string()),
  required_examinations: z.array(z.string()), recommendations: z.array(z.string()),
  clinician_review: z.strictObject({ status: z.enum(['DRAFT','REVIEW_REQUIRED','APPROVED','REJECTED']), reviewer_uid: z.string().nullable(), reviewed_at: z.string().datetime().nullable(), note: z.string().max(2000), evidence: z.array(z.string()).max(20) }),
  evidence_provenance: z.strictObject({ source: z.enum(['QUESTIONNAIRE_ONLY','QUESTIONNAIRE_AND_IMAGES','CLINICIAN_REVIEW']), creator_uid: z.string(), model_available: z.boolean(), calibrated_confidence_available: z.literal(false), clinical_rules_approved: z.literal(false), consent_to_process: z.literal(true), source_images_retained: z.literal(false),guardian_authorized:z.boolean(),subject_linkage:z.enum(['SELF','OWNED_PROFILE','UNKNOWN']) }),
}).superRefine((r,ctx) => {
  if (r.triage_level !== r.triage.level) ctx.addIssue({ code:'custom', message:'Triage mismatch' });
  if (r.confirmed_icd10.length && (r.screening_status !== 'CLINICIAN_CONFIRMED' || r.clinician_review.status !== 'APPROVED' || !r.clinician_review.reviewer_uid || !r.clinician_review.reviewed_at || r.clinician_review.evidence.length === 0)) ctx.addIssue({ code:'custom', message:'Confirmation requires authorized clinical review' });
  if (r.triage_level === 'EMERGENCY' && !['EMERGENCY','CLINICIAN_CONFIRMED'].includes(r.screening_status)) ctx.addIssue({ code:'custom', message:'Emergency cannot be downgraded' });
  if (r.screening_status === 'NO_VISIBLE_FINDINGS' && (!r.evidence_provenance.model_available || !r.image_quality_results.length || r.image_quality_results.some(q=>q.status !== 'VALID') || r.visual_findings.length)) ctx.addIssue({ code:'custom', message:'Absence requires valid assessed images' });
  for(const f of r.visual_findings) if(f.image_index >= r.image_quality_results.length || (f.source==='QUALIFIED_CLINICIAN' && !f.reviewer_uid) || (f.source==='VALIDATED_DETECTOR' && !f.model_version)) ctx.addIssue({ code:'custom', message:'Invalid finding provenance/index' });
});
export type Screening = z.infer<typeof ScreeningSchema>;
export const ImageInputSchema = z.strictObject({ mime_type: z.enum(['image/jpeg','image/png','image/webp','image/heic','image/heif']), data: z.string().max(4_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/) });
export const ScreeningRequestSchema = z.strictObject({ screening_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), context: z.enum(['ADULT','PEDIATRIC']), patient_age: z.number().int().min(0).max(120).nullable(), symptoms: SymptomsSchema, patient_subject_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable().default(null),guardian_authorized:z.boolean().default(false), images: z.array(ImageInputSchema).max(4), consent_to_process: z.literal(true) }).superRefine((r,c)=>{
 if(r.context==='PEDIATRIC'&&(!r.patient_subject_id||!r.guardian_authorized))c.addIssue({code:'custom',message:'Child subject and guardian authorization required'});
 if(r.patient_age !== null && ((r.context==='PEDIATRIC' && r.patient_age>=18) || (r.context==='ADULT' && r.patient_age<18))) c.addIssue({code:'custom',message:'Age/context mismatch'});
});
export const ScreeningEnvelopeSchema = z.strictObject({screening_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),context:z.enum(['ADULT','PEDIATRIC']),patient_age:z.number().int().min(0).max(120).nullable(),symptoms:SymptomsSchema,patient_subject_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable().default(null),guardian_authorized:z.boolean().default(false),images:z.array(z.unknown()).max(4),consent_to_process:z.literal(true)});
export type ScreeningRequest = z.infer<typeof ScreeningRequestSchema>;
