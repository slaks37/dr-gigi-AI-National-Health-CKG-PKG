import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: { 'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)), '@': fileURLToPath(new URL('.', import.meta.url)) } }, test: { include: ['tests/firestore.rules.test.ts', 'tests/resources.emulator.test.ts'], fileParallelism: false, testTimeout: 20_000, hookTimeout: 30_000 } });
