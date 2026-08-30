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

// Records
export async function saveRecord(record: any) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  try {
    const recordId = record.id;
    record.userId = auth.currentUser.uid;
    record.timestamp = record.timestamp || new Date().toISOString();
    await setDoc(doc(db, 'records', recordId), record);
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
  } catch(error) {
    handleFirestoreError(error, OperationType.UPDATE, `records/${id}`);
  }
}

export async function getAllRecords(role?: string | null) {
  if (!auth.currentUser) return [];
  try {
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
    await setDoc(doc(db, 'appointments', appointmentId), appointment);
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
  // Can be implemented to migrate existing local records to Firestore
}
