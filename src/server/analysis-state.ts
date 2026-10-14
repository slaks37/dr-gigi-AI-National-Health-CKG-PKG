export const ANALYSIS_STATES = ['INVALID_IMAGE', 'LOW_QUALITY', 'NO_TEETH_VISIBLE', 'REVIEW_REQUIRED', 'NO_VISIBLE_FINDINGS', 'FINDINGS_PRESENT', 'PROCESSING_ERROR'] as const;
export type AnalysisState = typeof ANALYSIS_STATES[number];
export function screeningState(output: unknown): AnalysisState {
  if (!output || typeof output !== 'object') return 'PROCESSING_ERROR';
  const data = output as Record<string, unknown>;
  if (data.is_dental_image === false) return 'INVALID_IMAGE';
  if (data.is_dental_image !== true || !Array.isArray(data.findings)) return 'REVIEW_REQUIRED';
  if (data.analysis_state === 'NO_VISIBLE_FINDINGS' && data.findings.length === 0) return 'NO_VISIBLE_FINDINGS';
  if (data.analysis_state === 'FINDINGS_PRESENT' && data.findings.length > 0) return 'FINDINGS_PRESENT';
  if (data.analysis_state === 'LOW_QUALITY' || data.analysis_state === 'NO_TEETH_VISIBLE') return data.analysis_state;
  return 'REVIEW_REQUIRED';
}
export function boxStyle(box: unknown, mirrored = false) {
  if (!box || typeof box !== 'object') return null;
  const b = box as Record<string, number>;
  if (![b.xmin, b.xmax, b.ymin, b.ymax].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000)) return null;
  if (b.xmin >= b.xmax || b.ymin >= b.ymax) return null;
  return { top: `${b.ymin / 10}%`, left: `${(mirrored ? 1000 - b.xmax : b.xmin) / 10}%`, width: `${(b.xmax - b.xmin) / 10}%`, height: `${(b.ymax - b.ymin) / 10}%` };
}
