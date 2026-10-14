import { api, ApiError } from '@/src/server/security';
export const dynamic = 'force-dynamic';
// No labeled-data benchmark or approved clinical schema exists. There is deliberately no
// environment-variable bypass for this gate; enabling requires a reviewed implementation.
export const POST = api(async () => {
  throw new ApiError(503, 'REQUIRES_REVIEW: analisis klinis foto/video dinonaktifkan sampai validasi klinis tersedia. Gunakan pengukuran alat dan pemeriksaan dokter.');
});
