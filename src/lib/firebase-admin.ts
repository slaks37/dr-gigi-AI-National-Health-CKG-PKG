import 'server-only';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { researchPreviewEnabled } from '../server/research-preview';
import { previewCredential } from '../server/preview-credential';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT || firebaseConfig.projectId,
    ...(researchPreviewEnabled() ? { credential: previewCredential() } : {}),
  });
}

export const adminAuth = getAuth();
