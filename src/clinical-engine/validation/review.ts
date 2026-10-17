import { z } from 'zod';
import { ClinicalEvidenceSchema } from '../evidence/schema';
import { FindingSchema } from '../types/schema';
export const ReviewRequestSchema=z.strictObject({
 screening_id:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),expected_version:z.number().int().positive(),decision:z.enum(['DRAFT','APPROVED','REJECTED']),
 note:z.string().min(1).max(2000),findings:z.array(FindingSchema.omit({source:true,model_version:true,reviewer_uid:true,review_required:true})).max(100),
 confirmed_icd10:z.array(z.string()).max(20),clinical_evidence:z.array(z.string().min(1).max(1000)).max(20),
 structured_evidence:ClinicalEvidenceSchema.optional(),
 examinations:z.strictObject({clinical_exam:z.boolean(),radiography:z.boolean(),vitality_test:z.boolean(),periodontal_exam:z.boolean(),histopathology:z.boolean()}),
 orientation_known:z.boolean(),anatomical_context_known:z.boolean(),
});
export type ReviewRequest=z.infer<typeof ReviewRequestSchema>;
