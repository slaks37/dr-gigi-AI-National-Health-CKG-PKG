import 'server-only';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import '../lib/firebase-admin';
import { FIREBASE_CONFIG, assertFirebaseStagingRuntime } from '../config/firebase';

// Same named database as the browser; ADC credentials stay server-side.
export function store() { assertFirebaseStagingRuntime(); return getFirestore(getApp(), process.env.FIRESTORE_DATABASE_ID || FIREBASE_CONFIG.firestoreDatabaseId); }
