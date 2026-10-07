import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseExampleCatalog } from '../src/examples.js';
import { fitsThirdToneForm, getThirdToneForm, isThirdToneFormId, thirdToneExample, thirdToneForms } from '../src/third-tone.js';
import { markTone, parseQuery, syllableMap } from '../src/data.js';
import { required } from '../src/types.js';
import type { PronunciationExample } from '../src/types.js';

const catalog = parseExampleCatalog(JSON.parse(await readFile(new URL('../../public/examples.json', import.meta.url), 'utf8')));

test('third-tone examples keep the dictionary tone while selecting three different contours', () => {
  for (const [form, word, ipa] of [['full', '好', '˨˩˦'], ['half', '好吃', '˨˩'], ['sandhi', '好友', '˧˥']] as const) {
    const e = required(thirdToneExample('hao', form, catalog.thirdToneExamples, catalog.examples), form);
    assert.equal(e.text, word);
    assert.equal(e.tokens[e.target], 'hao3');
    assert.equal(markTone('hao', parseQuery(required(e.tokens[e.target], 'target')).tone), 'hǎo');
    assert.equal(getThirdToneForm(form).ipa, ipa);
  }
  assert.equal(thirdToneForms.length, 3);
  for (const invalid of ['neutral', 'sixth', 3, null, '']) assert.equal(isThirdToneFormId(invalid), false);
});

test('every curated word is aligned and fits its explicitly chosen pronunciation context', () => {
  let total = 0;
  const halfFollowers = new Set<number | null>();
  for (const [key, forms] of Object.entries(catalog.thirdToneExamples)) {
    assert.ok(forms);
    assert.ok(syllableMap.has(parseQuery(key).text), key);
    for (const [form, e] of Object.entries(forms)) {
      assert.ok(isThirdToneFormId(form));
      assert.equal(e.tokens[e.target], key);
      assert.equal(e.tokens.length, [...e.text].length);
      assert.ok(fitsThirdToneForm(form, e), `${key}/${form}`);
      if (form === 'half') halfFollowers.add(parseQuery(required(e.tokens[1], 'next tone')).tone);
      total++;
    }
  }
  assert.equal(Object.keys(catalog.thirdToneExamples).length, 21);
  assert.equal(total, 62);
  assert.deepEqual([...halfFollowers].sort(), [1, 2, 4]);
});

test('neutral followers, longer chains and word-final targets are never automatically assigned a form', () => {
  const ambiguous: PronunciationExample[] = [
    { text: '好的', tokens: ['hao3', 'de5'], target: 0 },
    { text: '你好', tokens: ['ni3', 'hao3'], target: 1 },
    { text: '展览馆', tokens: ['zhan3', 'lan3', 'guan3'], target: 0 },
  ];
  for (const e of ambiguous) {
    for (const form of thirdToneForms) assert.equal(fitsThirdToneForm(form.id, e), false, e.text);
    const key = required(e.tokens[e.target], 'target');
    for (const form of thirdToneForms) assert.equal(thirdToneExample(parseQuery(key).text, form.id, {}, { [key]: e }), undefined);
  }
});

test('missing contextual audio never falls back to a single character or an unrelated example', () => {
  const single: PronunciationExample = { text: '你', tokens: ['ni3'], target: 0 };
  assert.equal(thirdToneExample('ni', 'full', {}, { ni3: single }), single);
  assert.equal(thirdToneExample('ni', 'half', catalog.thirdToneExamples, catalog.examples), undefined);
  assert.equal(thirdToneExample('ni', 'sandhi', catalog.thirdToneExamples, catalog.examples)?.text, '你好');
  assert.equal(thirdToneExample('ê', 'full', catalog.thirdToneExamples, catalog.examples), undefined);
});

test('catalog rejects incorrect tone classifications and malformed comparison words', () => {
  const invalid = [
    { hao3: { half: { text: '好友', tokens: ['hao3', 'you3'], target: 0 } } },
    { hao3: { sandhi: { text: '好吃', tokens: ['hao3', 'chi1'], target: 0 } } },
    { hao3: { full: { text: '好友', tokens: ['hao3', 'you3'], target: 0 } } },
    { hao3: { half: { text: '好的', tokens: ['hao3', 'de5'], target: 0 } } },
    { hao3: { unknown: { text: '好', tokens: ['hao3'], target: 0 } } },
    { hao2: { full: { text: '好', tokens: ['hao2'], target: 0 } } },
    { hao3: { half: { text: '<img>', tokens: ['hao3'], target: 0 } } },
  ];
  for (const thirdToneExamples of invalid) assert.throws(() => parseExampleCatalog({ ...catalog, thirdToneExamples }));
});
