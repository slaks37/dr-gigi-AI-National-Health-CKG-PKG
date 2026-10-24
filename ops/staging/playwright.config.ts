import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

// Reuse the actual clinical journey against the built standalone containers.
// No dev server or mock identity/database/inference is started by Playwright.
export default defineConfig({
  testDir: '../../tests/workflow', testMatch: 'clinical.spec.ts', workers: 1,
  timeout: 120_000, retries: 0,
  use: { baseURL: 'http://127.0.0.1:3012', trace: 'off', screenshot: 'only-on-failure' },
  reporter: [['list'], ['json', { outputFile: resolve('ops/staging/evidence/browser.json') }]],
});
