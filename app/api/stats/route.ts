import { api, requireAdmin } from '@/src/server/security';
import { store } from '@/src/server/store';
export const GET = api(async (_req, p) => {
  requireAdmin(p);
  const db = store();
  const counts = await Promise.all(['users', 'records', 'appointments', 'auditLogs'].map(c => db.collection(c).count().get()));
  return { success: true, database: { engine: 'Firestore', status: 'CONNECTED' }, stats: {
    totalUsers: counts[0].data().count, totalRecords: counts[1].data().count, totalAppointments: counts[2].data().count, totalActivityLogs: counts[3].data().count,
  } };
});
