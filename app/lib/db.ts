import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Universal App Usage & Activity Tracker (Saves to PostgreSQL database automatically)
export async function recordAppUsage(module: string, action: string, details?: any) {
  try {
    const user = auth.currentUser;
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userUid: user?.uid || 'anonymous-client',
        userEmail: user?.email || null,
        module,
        action,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        metadata: {
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          timestamp: new Date().toISOString(),
        }
      })
    });
  } catch (err) {
    console.warn('Failed to log app usage in background:', err);
  }
}

// User Profile Sync to Database (PostgreSQL)
export async function syncUserProfileToDb(user: { uid: string; email: string; displayName?: string | null; photoURL?: string | null; role?: string }) {
  try {
    const res = await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoURL,
        role: user.role || 'user',
      })
    });
    return await res.json();
  } catch (err) {
    console.warn('Failed to sync user profile to SQL:', err);
  }
}

// Records
export async function saveRecord(record: any) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  try {
    const recordId = record.id;
    record.userId = auth.currentUser.uid;
    record.timestamp = record.timestamp || new Date().toISOString();
    
    // Save to Firestore
    await setDoc(doc(db, 'records', recordId), record);

    // Also persist to PostgreSQL Database
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          userUid: auth.currentUser.uid,
          patientName: record.patientName || record.name || 'Pasien',
          patientNik: record.nik || null,
          recordType: record.type || record.recordType || 'dental',
          analysisResult: record.analysis || record.result || record.diagnosis || null,
          payload: record,
          satusehatSynced: record.satusehatSynced ? 'true' : 'false',
          satusehatResourceId: record.satusehatResourceId || null,
        })
      });
    } catch (e) {
      console.warn('SQL Record sync warning:', e);
    }
  } catch(error) {
    handleFirestoreError(error, OperationType.CREATE, 'records');
  }
}

export async function updateRecord(id: string, updates: Partial<any>) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  try {
    const recordRef = doc(db, 'records', id);
    updates.userId = auth.currentUser.uid; // Ensuring userId doesn't change
    await updateDoc(recordRef, updates);

    // Sync updates to SQL
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: id,
          userUid: auth.currentUser.uid,
          patientName: updates.patientName || updates.name || 'Pasien',
          patientNik: updates.nik || null,
          recordType: updates.type || updates.recordType || 'dental',
          analysisResult: updates.analysis || updates.result || updates.diagnosis || null,
          payload: updates,
          satusehatSynced: updates.satusehatSynced ? 'true' : 'false',
        })
      });
    } catch (e) {
      console.warn('SQL update sync warning:', e);
    }
  } catch(error) {
    handleFirestoreError(error, OperationType.UPDATE, `records/${id}`);
  }
}

export async function getAllRecords(role?: string | null) {
  if (!auth.currentUser) return [];
  try {
    // Attempt fast fetch from SQL API first
    try {
      const sqlRes = await fetch(`/api/records?userUid=${auth.currentUser.uid}&role=${role || 'user'}`);
      if (sqlRes.ok) {
        const json = await sqlRes.json();
        if (json.records && json.records.length > 0) {
          return json.records.map((r: any) => {
            let parsed = {};
            try {
              parsed = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload || {};
            } catch (e) {
              parsed = {};
            }
            return {
              ...parsed,
              id: r.recordId,
              patientName: r.patientName,
              timestamp: r.createdAt,
              type: r.recordType,
            };
          });
        }
      }
    } catch (sqlErr) {
      console.warn('SQL fetch fallback to Firestore:', sqlErr);
    }

    // Fallback to Firestore
    let q;
    if (role === 'admin' || role === 'doctor') {
      q = query(collection(db, 'records'));
    } else {
      q = query(
        collection(db, 'records'),
        where('userId', '==', auth.currentUser.uid)
      );
    }
    const snap = await getDocs(q);
    const records = snap.docs.map(doc => doc.data());
    records.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return records;
  } catch(error) {
    handleFirestoreError(error, OperationType.LIST, 'records');
    return [];
  }
}

export async function deleteRecord(id: string) {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'records', id));
    
    // Also delete from SQL
    try {
      await fetch(`/api/records?recordId=${id}&userUid=${auth.currentUser.uid}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn('SQL delete sync warning:', e);
    }
  } catch(error) {
    handleFirestoreError(error, OperationType.DELETE, `records/${id}`);
  }
}

// Appointments
export async function saveAppointment(appointment: any) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  try {
    const appointmentId = appointment.id;
    appointment.userId = auth.currentUser.uid;
    
    // Save to Firestore
    await setDoc(doc(db, 'appointments', appointmentId), appointment);

    // Save to SQL Database
    try {
      await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          userUid: auth.currentUser.uid,
          patientName: appointment.patientName || appointment.name,
          doctorName: appointment.doctorName || 'drg. Spesialis',
          clinicName: appointment.clinicName || 'Klinik dr Gigi AI',
          date: appointment.date,
          time: appointment.time,
          status: appointment.status || 'scheduled',
          notes: appointment.notes || appointment.complaint || null,
        })
      });
    } catch (e) {
      console.warn('SQL appointment sync warning:', e);
    }
  } catch(error) {
    handleFirestoreError(error, OperationType.CREATE, 'appointments');
  }
}

export async function getAllAppointments(role?: string | null) {
  if (!auth.currentUser) return [];
  try {
    let q;
    if (role === 'admin' || role === 'doctor') {
      q = query(collection(db, 'appointments'));
    } else {
      q = query(
        collection(db, 'appointments'),
        where('userId', '==', auth.currentUser.uid)
      );
    }
    const snap = await getDocs(q);
    const appointments = snap.docs.map(doc => doc.data());
    appointments.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return appointments;
  } catch(error) {
    handleFirestoreError(error, OperationType.LIST, 'appointments');
    return [];
  }
}

export async function getAllUsers(role?: string | null) {
  if (!auth.currentUser || (role !== 'admin' && role !== 'doctor')) return [];
  try {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  } catch(error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
}

export async function deleteAppointment(id: string) {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'appointments', id));
  } catch(error) {
    handleFirestoreError(error, OperationType.DELETE, `appointments/${id}`);
  }
}

export async function migrateFromLocalStorage() {
  // Can be implemented to migrate existing local records to database
}

