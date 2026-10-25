import { z } from 'zod';

export const ToothSchema = z.strictObject({
  fdi: z.string().regex(/^(?:[1-4][1-8]|[5-8][1-5])$/),
  status: z.enum(['NOT_ASSESSED', 'PRESENT', 'MISSING', 'RESTORED', 'FINDING']),
  surfaces: z.array(z.enum(['MESIAL', 'DISTAL', 'BUCCAL', 'LINGUAL', 'PALATAL', 'OCCLUSAL', 'INCISAL'])).max(7),
  observation: z.string().max(500),
}).refine(t => t.status !== 'FINDING' || t.observation.trim().length > 0, 'Describe the observed finding');
export const EncounterExamSchema = z.strictObject({
  dentition: z.enum(['UNKNOWN', 'PRIMARY', 'PERMANENT', 'MIXED']),
  orientation_known: z.boolean(),
  medical_history: z.string().max(2000),
  medications_allergies: z.string().max(2000),
  extraoral: z.string().max(2000),
  mucosa: z.string().max(2000),
  periodontal: z.string().max(2000),
  clinical_notes: z.string().max(4000),
  teeth: z.array(ToothSchema).max(52),
  consent_confirmed: z.literal(true),
  consent_version: z.literal('sonri-exam-consent-1'),
}).superRefine((v, c) => {
  if (new Set(v.teeth.map(t => t.fdi)).size !== v.teeth.length) c.addIssue({ code: 'custom', message: 'Duplicate tooth' });
  if (v.teeth.length && !v.orientation_known) c.addIssue({ code: 'custom', message: 'FDI recording requires verified orientation' });
  if (v.teeth.length && v.dentition === 'UNKNOWN') c.addIssue({ code: 'custom', message: 'Verify dentition before tooth recording' });
  if (v.dentition === 'PRIMARY' && v.teeth.some(t => Number(t.fdi) < 50)) c.addIssue({ code: 'custom', message: 'Permanent tooth in primary dentition' });
  if (v.dentition === 'PERMANENT' && v.teeth.some(t => Number(t.fdi) >= 50)) c.addIssue({ code: 'custom', message: 'Primary tooth in permanent dentition' });
});
export type EncounterExam = z.infer<typeof EncounterExamSchema>;
export const SaveExamSchema = z.strictObject({
  screening_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  expected_version: z.number().int().positive(),
  examination: EncounterExamSchema,
});
