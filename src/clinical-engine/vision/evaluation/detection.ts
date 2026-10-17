import { z } from 'zod';
import { BoxSchema } from '../../types/schema';
const TruthSchema = z.strictObject({ image_id: z.string().min(1), label: z.string().min(1), box: BoxSchema });
const PredictionSchema = TruthSchema.extend({ score: z.number().finite().min(0).max(1) });
export const EvaluationSchema = z.strictObject({
    dataset_version: z.string().min(1), test_manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/), patient_split_verified: z.literal(true), independent_labels_approved: z.literal(true), data_use_approved: z.literal(true),
    images: z.array(z.string().min(1)).min(1), truth: z.array(TruthSchema), predictions: z.array(PredictionSchema),
}).superRefine((e, c) => { const ids = new Set(e.images); if (ids.size !== e.images.length || [...e.truth, ...e.predictions].some(row => !ids.has(row.image_id)))
    c.addIssue({ code: 'custom', message: 'Invalid evaluation image IDs' }); });
type Box = z.infer<typeof BoxSchema>;
export function iou(a: Box, b: Box) { const intersection = Math.max(0, Math.min(a.xmax, b.xmax) - Math.max(a.xmin, b.xmin)) * Math.max(0, Math.min(a.ymax, b.ymax) - Math.max(a.ymin, b.ymin)); return intersection / ((a.xmax - a.xmin) * (a.ymax - a.ymin) + (b.xmax - b.xmin) * (b.ymax - b.ymin) - intersection); }
export function evaluateDetections(raw: unknown, threshold: number, iouThreshold = 0.5) {
    const e = EvaluationSchema.parse(raw);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1 || !Number.isFinite(iouThreshold) || iouThreshold <= 0 || iouThreshold > 1)
        throw new Error('Invalid evaluation threshold');
    const used = new Set<number>();
    let tp = 0, fp = 0;
    for (const p of e.predictions.filter(p => p.score >= threshold).sort((a, b) => b.score - a.score)) {
        let best = -1, bestIou = iouThreshold;
        e.truth.forEach((t, i) => { if (!used.has(i) && t.image_id === p.image_id && t.label === p.label) {
            const overlap = iou(t.box, p.box);
            if (overlap >= bestIou) {
                best = i;
                bestIou = overlap;
            }
        } });
        if (best >= 0) {
            used.add(best);
            tp++;
        }
        else
            fp++;
    }
    const fn = e.truth.length - tp;
    const precision = tp + fp ? tp / (tp + fp) : null, recall = tp + fn ? tp / (tp + fn) : null;
    return { dataset_version: e.dataset_version, test_manifest_sha256: e.test_manifest_sha256, images: e.images.length, threshold, iou_threshold: iouThreshold, tp, fp, fn, precision, recall, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null, map50: null, map50_95: null, limitation: 'Single-threshold box matching; COCO AP requires separate pycocotools evaluation. No clinical validation implied.' };
}
