import { api, ApiError } from '@/src/server/security';
export const dynamic = 'force-dynamic';
export const POST = api(async () => {
  throw new ApiError(503, 'REQUIRES_REVIEW: konsultasi AI dinonaktifkan sampai kebijakan klinis, validasi keluaran, kuota bersama, dan penyedia terverifikasi tersedia.');
});
