import { z } from 'zod';
import { BoxSchema, FindingLabels, AnatomicalRegions } from '../clinical-engine/types/schema';
export const DatasetEntrySchema=z.strictObject({
 image_id:z.string().regex(/^[a-f0-9]{64}$/),patient_group_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable(),source_folder_label:z.string().max(100),candidate_icd10:z.string().nullable(),clinician_verified_label:z.string().max(200).nullable(),visual_finding_labels:z.array(z.enum(FindingLabels)),review_status:z.enum(['UNREVIEWED','ACCEPTED','CORRECTED','REJECTED','UNCERTAIN']),reviewer_id:z.string().nullable(),review_timestamp:z.string().datetime().nullable(),label_version:z.string(),consent_status:z.enum(['UNKNOWN','USER_ATTESTED_VERIFIED','DOCUMENTED_VERIFIED','REVOKED']),data_usage_permission:z.enum(['UNKNOWN','RESEARCH_ONLY','TRAINING_APPROVED','PROHIBITED']),permission_evidence_reference:z.string().nullable(),source_provenance:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/).nullable(),perceptual_hash:z.string().regex(/^[a-f0-9]{16}$/).nullable(),duplicate_group_id:z.string().nullable(),near_duplicate_group_id:z.string().nullable(),quality_status:z.enum(['NOT_ASSESSED','ACCEPTED','REJECTED']),mime_type:z.string(),size_bytes:z.number().nonnegative().nullable(),width:z.number().int().positive().nullable(),height:z.number().int().positive().nullable(),dataset_version:z.string(),independent_review_status:z.enum(['PENDING','APPROVED','REJECTED']),
});
export type DatasetEntry=z.infer<typeof DatasetEntrySchema>;
export const AnnotationSchema=z.strictObject({
 image_id:z.string().regex(/^[a-f0-9]{64}$/),anonymous_patient_group_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable(),source_image_id:z.string().regex(/^[a-f0-9]{64}$/),
 anatomical_region:z.enum(AnatomicalRegions),finding_type:z.enum(FindingLabels),box:BoxSchema.nullable(),
 segmentation:z.array(z.strictObject({x:z.number().min(0).max(1000),y:z.number().min(0).max(1000)})).min(3).max(1000).nullable(),
 fdi_number:z.string().regex(/^(?:[1-4][1-8]|[5-8][1-5])$/).nullable(),orientation_known:z.boolean(),anatomical_context_known:z.boolean(),dentition:z.enum(['PRIMARY','PERMANENT','MIXED','UNKNOWN']),tooth_surface:z.enum(['BUCCAL','LINGUAL','PALATAL','MESIAL','DISTAL','OCCLUSAL','INCISAL','UNKNOWN']),visibility:z.enum(['VISIBLE','OCCLUDED','UNCERTAIN']),uncertain:z.boolean(),notes:z.string().max(2000),status:z.enum(['DRAFT','REJECTED','REVIEW_REQUIRED']),dataset_version:z.string(),expected_version:z.number().int().min(0),
}).superRefine((r,c)=>{
 if(!r.box&&!r.segmentation)c.addIssue({code:'custom',message:'Geometry required'});
 if(r.fdi_number&&(!r.orientation_known||!r.anatomical_context_known||r.dentition==='UNKNOWN'))c.addIssue({code:'custom',message:'FDI cannot be guessed'});
 if(r.fdi_number&&r.dentition==='PRIMARY'&&!/^[5-8]/.test(r.fdi_number))c.addIssue({code:'custom',message:'Adult FDI cannot label primary dentition'});
});
export type Annotation=z.infer<typeof AnnotationSchema>;
export function trainingEligible(e:DatasetEntry):boolean {
 return e.consent_status==='DOCUMENTED_VERIFIED'&&e.data_usage_permission==='TRAINING_APPROVED'&&!!e.permission_evidence_reference&&!!e.patient_group_id&&['ACCEPTED','CORRECTED'].includes(e.review_status)&&!!e.clinician_verified_label&&!!e.reviewer_id&&!!e.review_timestamp&&e.independent_review_status==='APPROVED'&&e.quality_status==='ACCEPTED'&&!!e.sha256&&!!e.duplicate_group_id&&!!e.near_duplicate_group_id;
}
