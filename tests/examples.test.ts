import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseExampleCatalog } from '../src/examples.js';

const raw: unknown = JSON.parse(await readFile(new URL('../../public/examples.json', import.meta.url), 'utf8'));
const catalog = parseExampleCatalog(raw);

test('example parser preserves shipped catalog and its source metadata', () => {
  assert.ok(Object.keys(catalog.examples).length > 1000);
  assert.equal(catalog.meta.license, 'CC BY-SA 4.0');
  assert.equal(catalog.examples.ma5?.text, '妈妈');
});
test('example parser rejects malformed JSON shapes, unsafe text and mismatched readings', () => {
  for (const bad of [null, [], {}, { meta: {}, examples: {} }]) assert.throws(() => parseExampleCatalog(bad));
  const invalid = [
    { text: '<img>', tokens: ['ma1'], target: 0 },
    { text: '妈', tokens: ['ma2'], target: 0 },
    { text: '妈', tokens: ['ma1'], target: .5 },
    { text: '妈妈', tokens: ['ma1'], target: 0 },
    { text: '妈', tokens: [1], target: 0 },
    { text: '妈', tokens: ['ma1'], target: -1 },
  ];
  for (const example of invalid) assert.throws(() => parseExampleCatalog({ meta: catalog.meta, examples: { ma1: example } }));
  assert.throws(() => parseExampleCatalog({ meta: catalog.meta, examples: { ma5: { text: '吗', tokens: ['ma5'], target: 0 } } }));
});
