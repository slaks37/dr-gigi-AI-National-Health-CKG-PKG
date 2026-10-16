import { z } from 'zod';
const tooth = z.string().regex(/^(?:[1-4][1-8]|[5-8][1-5])$/);
export const ClinicalEvidenceSchema = z.strictObject({
    dentition: z.enum(['PRIMARY', 'MIXED', 'PERMANENT', 'UNKNOWN']).default('UNKNOWN'),
    periodontal_sites: z.array(z.strictObject({ fdi_number: tooth, site: z.enum(['MB', 'B', 'DB', 'ML', 'L', 'DL']), probing_depth_mm: z.number().min(0).max(20).nullable(), attachment_loss_mm: z.number().min(0).max(20).nullable(), bleeding_on_probing: z.enum(['YES', 'NO', 'UNKNOWN']) })).max(312).default([]),
    sensibility_tests: z.array(z.strictObject({ fdi_number: tooth, method: z.enum(['COLD', 'HEAT', 'ELECTRIC', 'OTHER']), response: z.enum(['NORMAL', 'LINGERING', 'ABSENT', 'INCONCLUSIVE']), interpretation: z.string().min(1).max(1000) })).max(52).default([]),
    radiographs: z.array(z.strictObject({ modality: z.enum(['BITEWING', 'PERIAPICAL', 'PANORAMIC', 'CBCT', 'OTHER']), acquired_at: z.string().datetime(), interpretation: z.string().min(1).max(2000) })).max(20).default([]),
    laboratory: z.array(z.strictObject({ kind: z.enum(['HISTOPATHOLOGY', 'MICROBIOLOGY', 'OTHER']), interpretation: z.string().min(1).max(2000) })).max(20).default([]),
}).superRefine((e, c) => {
    const sites = e.periodontal_sites.map(s => `${s.fdi_number}:${s.site}`);
    if (new Set(sites).size !== sites.length)
        c.addIssue({ code: 'custom', message: 'Duplicate periodontal site' });
});
export type ClinicalEvidence = z.infer<typeof ClinicalEvidenceSchema>;
export function evidenceMatchesExaminations(e: ClinicalEvidence, exams: {
    periodontal_exam: boolean;
    vitality_test: boolean;
    radiography: boolean;
    histopathology: boolean;
}) {
    return (!e.periodontal_sites.length || exams.periodontal_exam) && (!e.sensibility_tests.length || exams.vitality_test) && (!e.radiographs.length || exams.radiography) && (!e.laboratory.some(l => l.kind === 'HISTOPATHOLOGY') || exams.histopathology);
}
