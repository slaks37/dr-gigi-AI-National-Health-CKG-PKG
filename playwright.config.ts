import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', use: { baseURL: 'http://127.0.0.1:3010' }, webServer: { command: 'npm run start -- --port 3010', url: 'http://127.0.0.1:3010', reuseExistingServer: !process.env.CI, timeout: 60_000 } });
