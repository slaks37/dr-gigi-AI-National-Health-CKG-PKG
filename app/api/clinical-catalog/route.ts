import { api, ApiError } from '@/src/server/security';
import { ICD_CATALOG, ICD_CATEGORIES, lookupCode, TERMINOLOGY_METADATA } from '@/src/clinical-engine/terminology/catalog';

export const GET = api(async req => {
  const code = req.nextUrl.searchParams.get('code');
  const category = req.nextUrl.searchParams.get('category');
  if (category && !ICD_CATEGORIES.some(item => item.code === category)) throw new ApiError(400, 'Unknown WHO ICD-10 oral category');
  if (code) {
    const entry = lookupCode(code);
    if (!entry) throw new ApiError(404, 'Code absent from WHO ICD-10 2010 oral catalog');
    return { success: true, terminology: TERMINOLOGY_METADATA, categories: ICD_CATEGORIES, entries: [entry] };
  }
  return { success: true, terminology: TERMINOLOGY_METADATA, categories: ICD_CATEGORIES, entries: ICD_CATALOG.filter(entry => !category || entry.clinical_category === category) };
});
