import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

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

// Robust ID Generator compatible with Firestore rules (^[a-zA-Z0-9_\-]+$)
export function generateSecureId(prefix = 'id'): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rnd}`;
}

// Local Storage Keys for Offline & Guest Resiliency
const LOCAL_RECORDS_KEY = 'drgigi_offline_records_v1';
const LOCAL_PATIENTS_KEY = 'drgigi_offline_patients_v1';

function getLocalRecords(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRecords(records: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('LocalStorage save records warning:', e);
  }
}

function getLocalPatients(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PATIENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPatients(patients: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_PATIENTS_KEY, JSON.stringify(patients));
  } catch (e) {
    console.warn('LocalStorage save patients warning:', e);
  }
}

// Universal App Usage & Activity Tracker
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
  const recordId = record.id || generateSecureId('rec');
  record.id = recordId;
  record.timestamp = record.timestamp || new Date().toISOString();

  // If unauthenticated (Guest Mode): Save locally so patient doesn't lose checkup results
  if (!auth.currentUser) {
    record.userId = 'guest';
    const locals = getLocalRecords();
    const existingIdx = locals.findIndex(r => r.id === recordId);
    if (existingIdx >= 0) {
      locals[existingIdx] = record;
    } else {
      locals.unshift(record);
    }
    saveLocalRecords(locals);
    return recordId;
  }

  // Authenticated flow
  try {
    record.userId = auth.currentUser.uid;
    
    // Save to Firestore
    await setDoc(doc(db, 'records', recordId), record);

    // Persist to PostgreSQL Database
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

    // Also update local cache
    const locals = getLocalRecords();
    const filtered = locals.filter(r => r.id !== recordId);
    filtered.unshift(record);
    saveLocalRecords(filtered);

    return recordId;
  } catch (error) {
    // If network or permission error, ensure local copy is saved
    const locals = getLocalRecords();
    locals.unshift(record);
    saveLocalRecords(locals);
    handleFirestoreError(error, OperationType.CREATE, 'records');
  }
}

export async function updateRecord(id: string, updates: Partial<any>) {
  if (!auth.currentUser) {
    const locals = getLocalRecords();
    const idx = locals.findIndex(r => r.id === id);
    if (idx >= 0) {
      locals[idx] = { ...locals[idx], ...updates };
      saveLocalRecords(locals);
    }
    return;
  }

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

    // Update local cache
    const locals = getLocalRecords();
    const idx = locals.findIndex(r => r.id === id);
    if (idx >= 0) {
      locals[idx] = { ...locals[idx], ...updates };
      saveLocalRecords(locals);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `records/${id}`);
  }
}

export async function getAllRecords(role?: string | null): Promise<any[]> {
  // If user is not logged in, return locally saved records
  if (!auth.currentUser) {
    return getLocalRecords();
  }

  try {
    // Attempt fetch from SQL API first
    try {
      const sqlRes = await fetch(`/api/records?userUid=${auth.currentUser.uid}&role=${role || 'user'}`);
      if (sqlRes.ok) {
        const json = await sqlRes.json();
        if (json.records && json.records.length > 0) {
          const mapped = json.records.map((r: any) => {
            let parsed = {};
            try {
              parsed = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload || {};
            } catch {
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
          return mapped;
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
  } catch (error) {
    console.warn('Firestore getAllRecords error, falling back to local cache:', error);
    return getLocalRecords();
  }
}

export async function deleteRecord(id: string) {
  // Always clean local storage
  const locals = getLocalRecords();
  saveLocalRecords(locals.filter(r => r.id !== id));

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
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `records/${id}`);
  }
}

// Appointments
export async function saveAppointment(appointment: any) {
  if (!auth.currentUser) throw new Error("Harap masuk akun (login) untuk menjadwalkan konsultasi.");
  try {
    const appointmentId = appointment.id || generateSecureId('apt');
    appointment.id = appointmentId;
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
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
}

export async function deleteAppointment(id: string) {
  if (!auth.currentUser) return;
  try {
    await deleteDoc(doc(db, 'appointments', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `appointments/${id}`);
  }
}

export async function savePatient(patient: any) {
  const patientId = patient.id || generateSecureId('pat');
  patient.id = patientId;
  patient.createdAt = patient.createdAt || new Date().toISOString();

  // If guest, save locally
  if (!auth.currentUser) {
    patient.userId = 'guest';
    const locals = getLocalPatients();
    const existingIdx = locals.findIndex(p => p.id === patientId);
    if (existingIdx >= 0) {
      locals[existingIdx] = patient;
    } else {
      locals.unshift(patient);
    }
    saveLocalPatients(locals);
    return patientId;
  }

  try {
    patient.userId = auth.currentUser.uid;
    await setDoc(doc(db, 'patients', patientId), patient);

    // Cache locally as well
    const locals = getLocalPatients();
    const filtered = locals.filter(p => p.id !== patientId);
    filtered.unshift(patient);
    saveLocalPatients(filtered);

    return patientId;
  } catch (error) {
    const locals = getLocalPatients();
    locals.unshift(patient);
    saveLocalPatients(locals);
    handleFirestoreError(error, OperationType.CREATE, 'patients');
  }
}

export async function getAllPatients(role?: string | null): Promise<any[]> {
  if (!auth.currentUser) {
    return getLocalPatients();
  }

  try {
    let q;
    if (role === 'admin' || role === 'doctor') {
      q = query(collection(db, 'patients'));
    } else {
      q = query(
        collection(db, 'patients'),
        where('userId', '==', auth.currentUser.uid)
      );
    }
    const snap = await getDocs(q);
    const patients = snap.docs.map(doc => doc.data());
    patients.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return patients;
  } catch (error) {
    console.warn('Firestore getAllPatients fallback to local:', error);
    return getLocalPatients();
  }
}

export async function getPatient(id: string) {
  if (!auth.currentUser) {
    const locals = getLocalPatients();
    return locals.find(p => p.id === id) || null;
  }
  try {
    const snap = await getDoc(doc(db, 'patients', id));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `patients/${id}`);
    return null;
  }
}

// Seamless auto-migration: When a guest patient logs in, sync local records to Firestore & Postgres
export async function migrateFromLocalStorage() {
  if (!auth.currentUser) return;
  const currentUid = auth.currentUser.uid;

  try {
    // 1. Migrate patients
    const localPatients = getLocalPatients();
    const guestPatients = localPatients.filter(p => !p.userId || p.userId === 'guest');
    for (const patient of guestPatients) {
      try {
        patient.userId = currentUid;
        await setDoc(doc(db, 'patients', patient.id), patient);
      } catch (err) {
        console.warn('Error migrating patient to cloud:', err);
      }
    }
    if (guestPatients.length > 0) {
      saveLocalPatients(localPatients.map(p => ({ ...p, userId: currentUid })));
    }

    // 2. Migrate records
    const localRecords = getLocalRecords();
    const guestRecords = localRecords.filter(r => !r.userId || r.userId === 'guest');
    for (const record of guestRecords) {
      try {
        record.userId = currentUid;
        await setDoc(doc(db, 'records', record.id), record);
      } catch (err) {
        console.warn('Error migrating record to cloud:', err);
      }
    }
    if (guestRecords.length > 0) {
      saveLocalRecords(localRecords.map(r => ({ ...r, userId: currentUid })));
    }
  } catch (e) {
    console.warn('migrateFromLocalStorage sync note:', e);
  }
}
