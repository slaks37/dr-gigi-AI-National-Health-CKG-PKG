import 'server-only';
/** Retired provider adapter: clinical validation, output schema and shared quotas are required before enabling. */
export interface AgnesImagePart { data?: string; url?: string; mimeType?: string }
export function isAgnesConfigured(): boolean { return false; }
export function getAgnesBaseUrl(): string { return ''; }
export function normalizeAgnesModel(raw?: string): string { return raw?.trim() || ''; }
export function getAgnesCandidateModels(): string[] { return []; }
export async function callAgnesAnalyze(_request: unknown): Promise<string> {
  throw new Error('REQUIRES_REVIEW: Agnes clinical inference is disabled');
}
export async function callAgnesConsultation(_request: unknown): Promise<string> {
  throw new Error('REQUIRES_REVIEW: Agnes clinical consultation is disabled');
}
