import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['ops/cloud-run/hosted-probe.test.ts'] } });
