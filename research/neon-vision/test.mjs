import { test } from 'node:test';
import assert from 'node:assert/strict';
const { authorized, readBoundedJson, decode, default: handler } = await import(process.env.SONRI_FUNCTION_ENTRY || './dist/index.mjs');
test('reject missing/wrong secret before initialization or body handling', async () => {
    const secret = 's'.repeat(40);
    assert.equal(authorized(new Request('https://example.test'), secret), false);
    assert.equal(authorized(new Request('https://example.test', { headers: { 'x-sonri-secret': secret } }), secret), true);
    assert.equal((await handler.fetch(new Request('https://example.test/infer', { method: 'POST', body: 'malformed' }))).status, 401);
});
test('bound JSON and reject wrong content type', async () => {
    await assert.rejects(readBoundedJson(new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ many: 'x'.repeat(100) }) }), 10));
    await assert.rejects(readBoundedJson(new Request('https://example.test', { method: 'POST', body: '{}' })));
});
test('preserve output slot four without guessing its clinical meaning', () => {
    const boxes = new Float32Array(1200).fill(.5), logits = new Float32Array(1500).fill(-100); logits[4] = 2;
    const result = decode(boxes, logits); assert.equal(result.length, 1); assert.equal(result[0].class_id, 4); assert.equal(result[0].raw_label, 'RAW_CLASS_4');
    logits[0] = NaN; assert.throws(() => decode(boxes, logits), /INVALID_MODEL_OUTPUT/);
});
