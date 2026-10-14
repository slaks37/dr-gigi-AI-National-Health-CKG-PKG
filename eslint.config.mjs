import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });
const config = [
  { ignores: ['dist/**', '.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
  firebaseRulesPlugin.configs['flat/recommended'],
];

export default config;
