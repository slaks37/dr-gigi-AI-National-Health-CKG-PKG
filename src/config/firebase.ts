import fallback from '../../firebase-applet-config.json';
import { z } from 'zod';

const publicSchema = z.strictObject({
  projectId: z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/),
  appId: z.string().min(1).max(200), apiKey: z.string().min(1).max(200),
  authDomain: z.string().regex(/^[a-z0-9.-]+$/),
  firestoreDatabaseId: z.string().regex(/^(\(default\)|[a-z][a-z0-9-]{2,61}[a-z0-9])$/),
  storageBucket: z.string().max(200).optional(), messagingSenderId: z.string().regex(/^\d+$/),
  measurementId: z.string().max(100).optional(),
});
export type PublicFirebaseConfig = z.infer<typeof publicSchema>;
export function resolveFirebaseConfig(mode?: string, json?: string, emulator = false): PublicFirebaseConfig {
  if (emulator) {
    if (mode || json) throw new Error('Staging configuration cannot use emulators');
    return { ...fallback, projectId: 'demo-sonri-workflow', apiKey: 'synthetic-emulator-key', firestoreDatabaseId: '(default)' };
  }
  if (!mode && !json) return fallback;
  if (mode !== 'research-staging' || !json) throw new Error('Explicit research staging configuration required');
  let config: PublicFirebaseConfig;
  try { config = publicSchema.parse(JSON.parse(json)); } catch { throw new Error('Invalid public staging Firebase configuration'); }
  if (config.projectId === fallback.projectId || config.projectId.startsWith('demo-') || config.authDomain !== `${config.projectId}.firebaseapp.com` || !config.appId.startsWith(`1:${config.messagingSenderId}:web:`)) throw new Error('Separate consistent staging Firebase project required');
  return config;
}
export const FIREBASE_BUILD_MODE = process.env.NEXT_PUBLIC_SONRI_ENVIRONMENT;
export const FIREBASE_CONFIG = resolveFirebaseConfig(
  FIREBASE_BUILD_MODE,
  process.env.NEXT_PUBLIC_SONRI_FIREBASE_CONFIG,
  process.env.NEXT_PUBLIC_SONRI_EMULATORS === 'true',
);

export function assertFirebaseStagingRuntime(env: Readonly<Record<string, string | undefined>> = process.env, config = FIREBASE_CONFIG, publicMode = FIREBASE_BUILD_MODE) {
  if (env.SONRI_ENVIRONMENT || publicMode) {
    if (env.SONRI_ENVIRONMENT !== 'research-staging' || publicMode !== 'research-staging' || (env.NEXT_PUBLIC_SONRI_ENVIRONMENT && env.NEXT_PUBLIC_SONRI_ENVIRONMENT !== publicMode) || config.projectId === fallback.projectId || env.GCLOUD_PROJECT !== config.projectId || env.FIRESTORE_DATABASE_ID !== config.firestoreDatabaseId || env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST || env.NEXT_PUBLIC_SONRI_EMULATORS === 'true') throw new Error('Staging Firebase identities do not match');
  }
}
