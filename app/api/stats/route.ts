import { NextResponse } from 'next/server';
import { getAllUsersSql, getRecentActivityLogs } from '@/src/db/repository';
import { db } from '@/src/db/index';
import { medicalRecords, appointments, activityLogs } from '@/src/db/schema';
import { count } from 'drizzle-orm';

export async function GET() {
  try {
    const [usersList, recentLogs, totalRecs, totalApts, totalActivities] = await Promise.all([
      getAllUsersSql(),
      getRecentActivityLogs(30),
      db.select({ value: count() }).from(medicalRecords),
      db.select({ value: count() }).from(appointments),
      db.select({ value: count() }).from(activityLogs),
    ]);

    return NextResponse.json({
      success: true,
      database: {
        engine: 'PostgreSQL (Cloud SQL / Supabase compatible)',
        region: 'asia-southeast1',
        status: 'CONNECTED',
      },
      stats: {
        totalUsers: usersList.length,
        totalRecords: totalRecs[0]?.value || 0,
        totalAppointments: totalApts[0]?.value || 0,
        totalActivityLogs: totalActivities[0]?.value || 0,
      },
      users: usersList,
      recentActivityLogs: recentLogs,
    });
  } catch (error: any) {
    console.error('Error in /api/stats GET:', error);
    return NextResponse.json({
      success: false,
      database: {
        engine: 'PostgreSQL',
        region: 'asia-southeast1',
        status: 'CONNECTING',
      },
      stats: {
        totalUsers: 0,
        totalRecords: 0,
        totalAppointments: 0,
        totalActivityLogs: 0,
      },
      users: [],
      recentActivityLogs: [],
    });
  }
}
