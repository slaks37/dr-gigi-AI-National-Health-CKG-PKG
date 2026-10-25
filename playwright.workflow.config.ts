import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/workflow', workers: 1, timeout: 90_000,
  use: { baseURL: 'http://127.0.0.1:3012', trace: 'off' },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3012', url: 'http://127.0.0.1:3012/login', reuseExistingServer: false, timeout: 120_000,
    env: { NEXT_PUBLIC_SONRI_EMULATORS: 'true', GCLOUD_PROJECT: 'demo-sonri-workflow', FIRESTORE_DATABASE_ID: '(default)', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8088', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9098', SONRI_TEST_BUILD: '1', SONRI_RESEARCH_PREVIEW: '0' },
  },
});
