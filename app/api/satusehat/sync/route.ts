import { NextResponse } from 'next/server';
import { api, requireAdmin, readJson } from '@/src/server/security';
import { buildDraft } from '@/src/server/fhir';
export const POST = api(async (req, p) => {
  requireAdmin(p);
  const body = await readJson(req, 16_384);
  if (body.mode !== 'preview') return NextResponse.json({ success: false, status: 'NOT_CONFIGURED', satusehat_status: 'NOT_CONFIGURED', environment: 'sandbox', error: 'Pengiriman SATUSEHAT belum dikonfigurasi dan belum diverifikasi. Tidak ada data yang dikirim.' }, { status: 503 });
  return { success: true, status: 'DRAFT', satusehat_status: 'DRAFT', environment: 'sandbox', submitted: false, fhir_bundle: buildDraft(body), message: 'Pratinjau lokal saja. Referensi IHS dan profil program belum diverifikasi oleh SATUSEHAT.' };
});
