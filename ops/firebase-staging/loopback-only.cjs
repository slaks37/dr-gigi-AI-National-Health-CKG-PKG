// Test-process guard: even accidental provider/certificate/telemetry connections fail.
const net = require('node:net');
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let first = args[0];
  if (Array.isArray(first)) first = first[0];
  const options = first && typeof first === 'object' ? first : {};
  const unix = options.path || (typeof first === 'string' && !/^\d+$/.test(first));
  const host = options.host || options.hostname || options.servername || (typeof args[1] === 'string' ? args[1] : 'localhost');
  if (!unix && !['127.0.0.1', '::1', 'localhost'].includes(host)) {
    process.stderr.write('SONRI_BLOCKED_OUTBOUND\n');
    throw new Error('SONRI_TEST_OUTBOUND_FORBIDDEN');
  }
  return Reflect.apply(original, this, args);
};
