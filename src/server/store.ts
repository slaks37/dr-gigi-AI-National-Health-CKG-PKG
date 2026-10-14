import 'server-only';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import '../lib/firebase-admin';
import config from '../../firebase-applet-config.json';

// Same named database as the browser; ADC credentials stay server-side.
export function store() { return getFirestore(getApp(), process.env.FIRESTORE_DATABASE_ID || config.firestoreDatabaseId); }
