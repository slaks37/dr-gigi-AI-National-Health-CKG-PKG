import { z } from 'zod';
import { BoxSchema, FindingLabels } from '../../types/schema';
import { unavailableVision, type OralVision } from '../interface';
export const ResearchPredictionSchema = z.strictObject({
    model_id: z.string().min(1).max(128), model_version: z.string().min(1).max(128), artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    input_modality: z.literal('INTRAORAL_PHOTO'), prediction_type: z.literal('BOUNDING_BOX'), image_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    processing_ms: z.number().finite().nonnegative(), inference_status: z.literal('SUCCEEDED'), readiness: z.literal('EXPERIMENTAL'),
    detections: z.array(z.strictObject({ class_id: z.number().int().nonnegative(), raw_label: z.string().min(1).max(128), score: z.number().finite().min(0).max(1), box: BoxSchema })).max(200),
});
export type ResearchPrediction = z.infer<typeof ResearchPredictionSchema>;
// Raw class names remain unchanged. A reviewed mapping is needed even for familiar labels.
// This adapter never authorizes research detections for patient screening.
export function researchAdapter(metadata: {
    model_id: string;
    version: string;
}): OralVision & {
    normalize: (value: unknown) => ResearchPrediction;
} {
    return { ...unavailableVision, evaluateModelAvailability: () => ({ ...unavailableVision.evaluateModelAvailability(), limitation: `${metadata.model_id} ${metadata.version}: research only; clinical approval unavailable` }), normalize(value) { const r = ResearchPredictionSchema.parse(value); if (r.model_id !== metadata.model_id || r.model_version !== metadata.version)
            throw new Error('Research model provenance mismatch'); return r; } };
}
export function reviewedLabels(result: ResearchPrediction, mapping: Record<string, typeof FindingLabels[number]>) {
    return result.detections.map(d => { const label = mapping[d.raw_label]; if (!label || !FindingLabels.includes(label))
        throw new Error('Unknown or unreviewed model label'); return { ...d, observable_label: label, review_required: true as const }; });
}
