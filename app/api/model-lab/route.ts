import { api, readJson, requireAdmin } from '@/src/server/security';
import { parse } from '@/src/clinical-engine/validation/parse';
import { LabInputSchema, researchInference } from '@/src/server/inference-client';
import { store } from '@/src/server/store';
import { reserveQuota } from '@/src/server/clinical-store';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
export const maxDuration = 90;
export const POST = api(async (req, p) => {
  requireAdmin(p);
  const input = parse(LabInputSchema, await readJson(req, 3_900_000));
  await reserveQuota(p.uid);
  const result = await researchInference(input);
  const id = store().collection('modelRuns').doc();
  await store().runTransaction(async tx => {
    tx.create(id, { actorUid: p.uid, inputSha256: createHash('sha256').update(Buffer.from(input.data, 'base64')).digest('hex'), inputSource: 'DECLARED_SYNTHETIC', result, clinicalUse: 'PROHIBITED', timestamp: FieldValue.serverTimestamp() });
    tx.create(store().collection('auditLogs').doc(), { actorUid: p.uid, action: 'RESEARCH_INFERENCE', resourceId: id.id, timestamp: FieldValue.serverTimestamp() });
  });
  return { success: true, run_id: id.id, persistence: 'CONFIRMED', result };
});
