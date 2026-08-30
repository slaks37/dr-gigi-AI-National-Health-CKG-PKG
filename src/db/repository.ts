import { db } from './index';
import { users, activityLogs, medicalRecords, appointments, iotTelemetries } from './schema';
import { eq, desc, and } from 'drizzle-orm';

// 1. User Sync & Registration
export async function getOrCreateUser(userData: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
  role?: string;
}) {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, userData.uid))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(users)
        .set({
          email: userData.email,
          displayName: userData.displayName || existing[0].displayName,
          photoUrl: userData.photoUrl || existing[0].photoUrl,
          lastActive: new Date(),
        })
        .where(eq(users.uid, userData.uid))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName || null,
        photoUrl: userData.photoUrl || null,
        role: userData.role || 'user',
        lastActive: new Date(),
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Error in getOrCreateUser repository:', error);
    throw new Error('Failed to synchronize user profile', { cause: error });
  }
}

// 2. Activity / Usage Logger
export async function logActivity(logData: {
  userUid: string;
  userEmail?: string | null;
  module: string;
  action: string;
  details?: string | null;
  metadata?: string | null;
}) {
  try {
    let internalUserId: number | undefined = undefined;
    const userRes = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, logData.userUid))
      .limit(1);

    if (userRes.length > 0) {
      internalUserId = userRes[0].id;
    }

    const res = await db
      .insert(activityLogs)
      .values({
        userId: internalUserId,
        userUid: logData.userUid,
        userEmail: logData.userEmail || null,
        module: logData.module,
        action: logData.action,
        details: logData.details || null,
        metadata: logData.metadata || null,
      })
      .returning();

    return res[0];
  } catch (error) {
    console.error('Error logging activity to SQL:', error);
    // Don't crash caller if logging encounters transient issue
    return null;
  }
}

// 3. Medical Records
export async function saveMedicalRecord(record: {
  recordId: string;
  userUid: string;
  patientName: string;
  patientNik?: string | null;
  recordType: string;
  analysisResult?: string | null;
  payload?: string | null;
  satusehatSynced?: string;
  satusehatResourceId?: string | null;
}) {
  try {
    let internalUserId: number | undefined = undefined;
    const userRes = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, record.userUid))
      .limit(1);

    if (userRes.length > 0) {
      internalUserId = userRes[0].id;
    }

    const existing = await db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.recordId, record.recordId))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(medicalRecords)
        .set({
          patientName: record.patientName,
          patientNik: record.patientNik || existing[0].patientNik,
          recordType: record.recordType,
          analysisResult: record.analysisResult || existing[0].analysisResult,
          payload: record.payload || existing[0].payload,
          satusehatSynced: record.satusehatSynced || existing[0].satusehatSynced,
          satusehatResourceId: record.satusehatResourceId || existing[0].satusehatResourceId,
        })
        .where(eq(medicalRecords.recordId, record.recordId))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(medicalRecords)
      .values({
        recordId: record.recordId,
        userId: internalUserId,
        userUid: record.userUid,
        patientName: record.patientName,
        patientNik: record.patientNik || null,
        recordType: record.recordType,
        analysisResult: record.analysisResult || null,
        payload: record.payload || null,
        satusehatSynced: record.satusehatSynced || 'false',
        satusehatResourceId: record.satusehatResourceId || null,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Error saving medical record to SQL:', error);
    throw new Error('Failed to save medical record to database', { cause: error });
  }
}

export async function getMedicalRecords(userUid?: string, role?: string) {
  try {
    if (role === 'admin' || role === 'doctor') {
      return await db
        .select()
        .from(medicalRecords)
        .orderBy(desc(medicalRecords.createdAt));
    }

    if (!userUid) return [];

    return await db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.userUid, userUid))
      .orderBy(desc(medicalRecords.createdAt));
  } catch (error) {
    console.error('Error getting medical records from SQL:', error);
    return [];
  }
}

export async function deleteMedicalRecord(recordId: string, userUid?: string, role?: string) {
  try {
    if (role === 'admin' || role === 'doctor') {
      await db
        .delete(medicalRecords)
        .where(eq(medicalRecords.recordId, recordId));
      return true;
    }

    if (!userUid) return false;

    await db
      .delete(medicalRecords)
      .where(
        and(
          eq(medicalRecords.recordId, recordId),
          eq(medicalRecords.userUid, userUid)
        )
      );
    return true;
  } catch (error) {
    console.error('Error deleting medical record from SQL:', error);
    return false;
  }
}

// 4. Appointments
export async function saveAppointmentSql(apt: {
  appointmentId: string;
  userUid: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  date: string;
  time: string;
  status?: string;
  notes?: string | null;
}) {
  try {
    let internalUserId: number | undefined = undefined;
    const userRes = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, apt.userUid))
      .limit(1);

    if (userRes.length > 0) {
      internalUserId = userRes[0].id;
    }

    const existing = await db
      .select()
      .from(appointments)
      .where(eq(appointments.appointmentId, apt.appointmentId))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(appointments)
        .set({
          patientName: apt.patientName,
          doctorName: apt.doctorName,
          clinicName: apt.clinicName,
          date: apt.date,
          time: apt.time,
          status: apt.status || existing[0].status,
          notes: apt.notes || existing[0].notes,
        })
        .where(eq(appointments.appointmentId, apt.appointmentId))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(appointments)
      .values({
        appointmentId: apt.appointmentId,
        userId: internalUserId,
        userUid: apt.userUid,
        patientName: apt.patientName,
        doctorName: apt.doctorName,
        clinicName: apt.clinicName,
        date: apt.date,
        time: apt.time,
        status: apt.status || 'scheduled',
        notes: apt.notes || null,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Error saving appointment to SQL:', error);
    throw new Error('Failed to save appointment to database', { cause: error });
  }
}

export async function getAppointmentsSql(userUid?: string, role?: string) {
  try {
    if (role === 'admin' || role === 'doctor') {
      return await db
        .select()
        .from(appointments)
        .orderBy(desc(appointments.createdAt));
    }

    if (!userUid) return [];

    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.userUid, userUid))
      .orderBy(desc(appointments.createdAt));
  } catch (error) {
    console.error('Error getting appointments from SQL:', error);
    return [];
  }
}

// 5. Activity Logs Viewer
export async function getRecentActivityLogs(limitCount = 50) {
  try {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Error fetching activity logs from SQL:', error);
    return [];
  }
}

// 6. All Users for Admin / Stats
export async function getAllUsersSql() {
  try {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.lastActive));
  } catch (error) {
    console.error('Error fetching all users from SQL:', error);
    return [];
  }
}
