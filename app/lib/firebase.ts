import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const emulator = process.env.NEXT_PUBLIC_SONRI_EMULATORS === 'true';
// Test builds use a demo project that cannot reach real Firebase patient data.
const config = emulator ? { ...firebaseConfig, projectId: 'demo-sonri-workflow', apiKey: 'synthetic-emulator-key' } : firebaseConfig;
const app = getApps().length ? getApp() : initializeApp(config);
export const db = getFirestore(app, emulator ? '(default)' : firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
if (emulator && typeof window !== 'undefined') {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) throw new Error('Firebase emulator is local-only');
  if (!auth.emulatorConfig) connectAuthEmulator(auth, 'http://127.0.0.1:9098', { disableWarnings: true });
  try { connectFirestoreEmulator(db, '127.0.0.1', 8088); } catch { /* HMR may initialize an existing emulator connection. */ }
}
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };
export type { User };
