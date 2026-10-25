import { api, ApiError, requireAdmin } from '@/src/server/security';
import { FIREBASE_CONFIG, FIREBASE_BUILD_MODE, assertFirebaseStagingRuntime } from '@/src/config/firebase';
import { modelInventory } from '@/src/server/inference-client';
import { coverageMatrix } from '@/src/clinical-engine/terminology/coverage';

// Identify a reviewed staging deployment before any acceptance harness writes data.
export const GET = api(async (_req, principal) => {
  requireAdmin(principal);
  if (FIREBASE_BUILD_MODE !== 'research-staging') throw new ApiError(404, 'Hosted research staging is not configured');
  assertFirebaseStagingRuntime();
  return {
    success: true, environment: 'research-staging', synthetic_accounts_only: true,
    project_id: FIREBASE_CONFIG.projectId, database_id: FIREBASE_CONFIG.firestoreDatabaseId,
    clinical_use: 'PROHIBITED', source_images_retained: false,
    coverage: coverageMatrix().summary, inventory: await modelInventory(),
  };
});
