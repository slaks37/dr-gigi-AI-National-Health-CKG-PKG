import 'server-only';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FIREBASE_CONFIG } from '../config/firebase';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT || FIREBASE_CONFIG.projectId,
  });
}

export const adminAuth = getAuth();
