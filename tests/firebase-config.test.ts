import { describe, expect, it } from 'vitest';
import fallback from '../firebase-applet-config.json';
import { resolveFirebaseConfig, assertFirebaseStagingRuntime } from '../src/config/firebase';

const config = { projectId: 'sonri-fixture-staging', appId: '1:123456:web:synthetic', apiKey: 'public-browser-fixture-only', authDomain: 'sonri-fixture-staging.firebaseapp.com', firestoreDatabaseId: '(default)', messagingSenderId: '123456' };
const env = { SONRI_ENVIRONMENT: 'research-staging', GCLOUD_PROJECT: config.projectId, FIRESTORE_DATABASE_ID: config.firestoreDatabaseId };
describe('isolated Firebase staging configuration', () => {
  it('preserves legacy config and fixes demo identities for local emulator builds', () => {
    expect(resolveFirebaseConfig()).toEqual(fallback);
    expect(resolveFirebaseConfig(undefined, undefined, true)).toMatchObject({ projectId: 'demo-sonri-workflow', firestoreDatabaseId: '(default)', apiKey: 'synthetic-emulator-key' });
  });
  it('requires a separate public-only staging config and consistent app registration', () => {
    expect(resolveFirebaseConfig('research-staging', JSON.stringify(config))).toEqual(config);
    for (const patch of [{ projectId: fallback.projectId }, { private_key: 'synthetic-do-not-embed' }, { projectId: 'demo-sonri-workflow' }, { authDomain: fallback.authDomain }, { messagingSenderId: '765432' }]) expect(() => resolveFirebaseConfig('research-staging', JSON.stringify({ ...config, ...patch }))).toThrow();
    expect(() => resolveFirebaseConfig(undefined, JSON.stringify(config))).toThrow();
    expect(() => resolveFirebaseConfig('research-staging', JSON.stringify(config), true)).toThrow();
  });
  it('checks the compiled browser project against runtime Admin/database identities', () => {
    expect(() => assertFirebaseStagingRuntime(env, config, 'research-staging')).not.toThrow();
    for (const patch of [{ GCLOUD_PROJECT: fallback.projectId }, { FIRESTORE_DATABASE_ID: 'other-database' }, { FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9098' }, { FIRESTORE_EMULATOR_HOST: 'localhost:8088' }, { SONRI_ENVIRONMENT: undefined }]) expect(() => assertFirebaseStagingRuntime({ ...env, ...patch }, config, 'research-staging')).toThrow();
    expect(() => assertFirebaseStagingRuntime(env, config, '')).toThrow();
    expect(() => assertFirebaseStagingRuntime({}, fallback, '')).not.toThrow();
  });
});
