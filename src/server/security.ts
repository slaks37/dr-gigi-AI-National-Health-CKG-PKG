import { NextRequest, NextResponse } from 'next/server';

export type Principal = { uid: string; role: 'patient' | 'doctor' | 'admin'; email?: string; clinicalReviewer?: boolean; datasetScopes?: string[] };
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function principalFromClaims(token: { uid: string; role?: unknown; email?: string; clinicalReviewer?: unknown; datasetScopes?: unknown }): Principal {
  return { uid: token.uid, email: token.email, clinicalReviewer: token.clinicalReviewer === true, datasetScopes: Array.isArray(token.datasetScopes) ? token.datasetScopes.filter((s):s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s)).slice(0,10) : [], role: token.role === 'admin' || token.role === 'doctor' ? token.role : 'patient' };
}
export async function authenticate(req: NextRequest): Promise<Principal> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || header.length > 8192) throw new ApiError(401, 'Authentication required');
  if (process.env.SONRI_RESEARCH_PREVIEW === '1') throw new ApiError(503, 'Research preview: clinical storage and account workflows are disabled');
  try {
    const { adminAuth } = await import('../lib/firebase-admin');
    // Revocation and disabled-account checks are mandatory.
    return principalFromClaims(await adminAuth.verifyIdToken(header.slice(7), true));
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (['auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token', 'auth/argument-error', 'auth/user-disabled', 'auth/user-not-found'].includes(code)) throw new ApiError(401, 'Invalid or expired token');
    throw new ApiError(503, 'Authentication service unavailable');
  }
}
export function requireAdmin(p: Principal) {
  if (p.role !== 'admin') throw new ApiError(403, 'Administrator permission required');
}
export function canAccess(p: Principal, data: Record<string, unknown>): boolean {
  return p.role === 'admin' || data.userId === p.uid || (p.role === 'doctor' && Array.isArray(data.assignedClinicianUids) && data.assignedClinicianUids.includes(p.uid));
}
export function requireAccess(p: Principal, data: Record<string, unknown>) {
  if (!canAccess(p, data)) throw new ApiError(403, 'Resource access denied');
}
export const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
export function validId(value: unknown): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new ApiError(400, 'Invalid resource ID');
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'JSON object required');
  return value as Record<string, unknown>;
}
export function onlyKeys(data: Record<string, unknown>, keys: string[]) {
  if (Object.keys(data).some(key => !keys.includes(key))) throw new ApiError(400, 'Unsupported fields');
}
export async function readJson(req: NextRequest, maxBytes = 750_000): Promise<Record<string, unknown>> {
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new ApiError(415, 'application/json required');
  if (Number(req.headers.get('content-length') || 0) > maxBytes) throw new ApiError(413, 'Request too large');
  if (!req.body) throw new ApiError(400, 'Request body required');
  const reader = req.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ApiError(413, 'Request too large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = object(JSON.parse(new TextDecoder().decode(bytes)));
    const pending: [unknown, number][] = [[data, 0]];
    let nodes = 0;
    while (pending.length) {
      const [value, depth] = pending.pop()!;
      if (++nodes > 20_000 || depth > 20) throw new ApiError(400, 'JSON structure too complex');
      if (value && typeof value === 'object') for (const child of Object.values(value)) pending.push([child, depth + 1]);
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, 'Invalid JSON');
  } finally { reader.releaseLock(); }
}
export function api(handler: (req: NextRequest, p: Principal) => Promise<unknown>) {
  return async (req: NextRequest) => {
    try {
      const p = await authenticate(req);
      const result = await handler(req, p);
      const response = result instanceof NextResponse ? result : NextResponse.json(result);
      response.headers.set('Cache-Control', 'no-store, private');
      return response;
    } catch (error) {
      const known = error instanceof ApiError;
      return NextResponse.json({ success: false, error: known ? error.message : 'Service unavailable' }, {
        status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store, private' },
      });
    }
  };
}
