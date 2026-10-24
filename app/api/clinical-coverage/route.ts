import { api, ApiError } from '@/src/server/security';
import { coverageMatrix } from '@/src/clinical-engine/terminology/coverage';
export const GET = api(async req => {
  const matrix = coverageMatrix(), code = req.nextUrl.searchParams.get('code');
  if (code && !matrix.rows.some(r => r.code === code)) throw new ApiError(404, 'Code absent from WHO ICD-10 2010 oral catalog');
  return { success: true, ...matrix, rows: code ? matrix.rows.filter(r => r.code === code) : matrix.rows };
});
