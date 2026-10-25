import { NextResponse } from 'next/server';
import { api, ApiError, validId } from '@/src/server/security';
import { existingScreening } from '@/src/server/clinical-store';
import { buildClinicalReport, reportHtml } from '@/src/server/clinical-report';
import { ScreeningSchema } from '@/src/clinical-engine/types/schema';
import { store } from '@/src/server/store';
import { FieldValue } from 'firebase-admin/firestore';

export const GET = api(async (req, p) => {
  const id = validId(req.nextUrl.searchParams.get('id'));
  const data = await existingScreening(id, p);
  if (!data) throw new ApiError(404, 'Screening not found');
  const report = buildClinicalReport({ id, version: data.version, screening: ScreeningSchema.parse(data.screening), examination: data.examination });
  await store().collection('auditLogs').add({ actorUid: p.uid, action: 'REPORT_EXPORT', resourceId: id, version: data.version, timestamp: FieldValue.serverTimestamp() });
  if (req.nextUrl.searchParams.get('format') === 'html') return new NextResponse(reportHtml(report), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="sonri-${id}.html"`, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' } });
  return { success: true, report };
});
