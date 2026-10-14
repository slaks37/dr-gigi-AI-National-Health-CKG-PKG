import { z } from 'zod';
export const ModelRegistrySchema=z.strictObject({model_id:z.string(),version:z.string(),architecture:z.string(),license:z.string(),training_dataset_version:z.string(),label_ontology_version:z.string(),evaluation_dataset:z.string(),metrics:z.record(z.string(),z.number()),limitations:z.array(z.string()),reviewer_approval:z.strictObject({reviewer_uid:z.string(),approval_reference:z.string(),approved_at:z.string().datetime()}),deployment_status:z.enum(['DISABLED','STAGING','APPROVED']),artifact_sha256:z.string().regex(/^[a-f0-9]{64}$/),tooth_identification_validated:z.boolean()});
export const installedModels:z.infer<typeof ModelRegistrySchema>[]=[];
// No model has been trained, installed, evaluated or promoted in this implementation.
