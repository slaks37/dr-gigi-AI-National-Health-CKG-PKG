// Run after build with --no-experimental-require-module to reproduce the hosted
// CommonJS loader constraint. No credentials, token verification or network needed.
'use strict';
const path = require('node:path');
let failed = false;
function fail(error) {
  failed = true; process.exitCode = 1;
  console.error(JSON.stringify({ status: 'SERVER_IMPORT_FAILED', code: error?.code || 'IMPORT_ERROR', message: String(error?.message || '').split('\n')[0] }));
}
process.on('unhandledRejection', fail);
try {
  for (const route of ['auth/sync', 'screenings', 'vision-lab']) require(path.resolve(__dirname, `../.next/server/app/api/${route}/route.js`));
} catch (error) { fail(error); }
process.on('beforeExit', () => { if (!failed) console.log('SERVER_IMPORTS_OK_WITHOUT_REQUIRE_ESM'); });
