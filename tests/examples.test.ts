import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detailExample, parseExampleCatalog } from '../src/examples.js';
import { comparisonExample } from '../src/comparison.js';
import { parseQuery } from '../src/data.js';

const raw: unknown = JSON.parse(await readFile(new URL('../../public/examples.json', import.meta.url), 'utf8'));
const catalog = parseExampleCatalog(raw);

test('example parser preserves shipped catalog and its source metadata', () => {
  assert.ok(Object.keys(catalog.contextualExamples).length > 1000);
  assert.ok(Object.keys(catalog.isolatedExamples).length > 200);
  assert.equal(catalog.meta.license, 'CC BY-SA 4.0');
  assert.equal(catalog.contextualExamples.ma5?.text, '妈妈');
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
  for (const example of invalid) assert.throws(() => parseExampleCatalog({ ...catalog, isolatedExamples: { ma1: example } }));
  assert.throws(() => parseExampleCatalog({ ...catalog, contextualExamples: { ma5: { text: '吗', tokens: ['ma5'], target: 0 } } }));
});

test('catalog enforces separate isolated and contextual contracts and rejects obsolete full copies', () => {
  const word = { text: '眼睛', tokens: ['yan3', 'jing5'], target: 0 };
  const single = { text: '眼', tokens: ['yan3'], target: 0 };
  for (const change of [
    { schemaVersion: 1 }, { isolatedExamples: null }, { contextualExamples: [] },
    { isolatedExamples: { yan3: word } },
    { isolatedExamples: { ma5: { text: '吗', tokens: ['ma5'], target: 0 } } },
    { contextualExamples: { yan3: single } },
    { thirdToneExamples: { yan3: { full: single } } },
  ]) assert.throws(() => parseExampleCatalog({ ...catalog, ...change }));
});

test('approved isolated characters are shared by detail and comparison at every recorded tone', () => {
  for (const [key, example] of Object.entries(catalog.isolatedExamples)) {
    assert.ok(example);
    const { text, tone } = parseQuery(key);
    assert.ok(tone && tone !== 5, key);
    assert.equal(detailExample(text, tone, 'full', catalog), example, key);
    assert.equal(comparisonExample(text, tone, catalog.isolatedExamples), example, key);
  }
  for (const [key, word] of [['yan3', '眼'], ['yin3', '引'], ['ying3', '影'], ['li3', '理'], ['hao3', '好']] as const) {
    assert.equal(catalog.isolatedExamples[key]?.text, word);
  }
});

test('only ordinary detail tones may fall back to contextual words', () => {
  const contextual = {
    ma1: { text: '妈妈', tokens: ['ma1', 'ma5'], target: 0 },
    ma2: { text: '麻烦', tokens: ['ma2', 'fan5'], target: 0 },
    ma4: { text: '骂人', tokens: ['ma4', 'ren2'], target: 0 },
    yan3: { text: '眼睛', tokens: ['yan3', 'jing5'], target: 0 },
    jing5: { text: '眼睛', tokens: ['yan3', 'jing5'], target: 1 },
  };
  const noSingles = { ...catalog, isolatedExamples: {}, contextualExamples: contextual, thirdToneExamples: {} };
  for (const tone of [1, 2, 4] as const) {
    assert.equal(detailExample('ma', tone, 'full', noSingles), contextual[`ma${tone}`]);
    assert.equal(comparisonExample('ma', tone, noSingles.isolatedExamples), undefined);
  }
  assert.equal(detailExample('yan', 3, 'full', noSingles), undefined);
  assert.equal(detailExample('yan', 3, 'half', noSingles), undefined);
  assert.equal(detailExample('jing', 5, 'full', noSingles), contextual.jing5);
  assert.equal(detailExample('yan', 3, 'full', undefined), undefined);
});
