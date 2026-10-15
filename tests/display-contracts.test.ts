import test from 'node:test';
import assert from 'node:assert/strict';
import {getFinal, getTone} from '../src/data.js';
import {getThirdToneForm} from '../src/third-tone.js';
import {iPronunciationNote, matrixFinals} from '../src/layout.js';
import {required} from '../src/types.js';

test('full third tone agrees between syllable detail and the tone guide contours', () => {
  const detail = getThirdToneForm('full'), tone = getTone(3);
  for (const field of ['value', 'ipa', 'points'] as const) assert.equal(detail[field], tone[field], field);
});

test('matrix IPA headings and i explanations follow their analytical final data', () => {
  for (const final of matrixFinals) {
    assert.equal(final.ipa, final.variants.map(variant => getFinal(variant.id).ipa).join(' / '));
  }
  const merged = required(matrixFinals.find(final => final.id === 'i'), 'merged i column');
  for (const variant of merged.variants) assert.ok(iPronunciationNote.includes(`[${getFinal(variant.id).ipa}]`));
  assert.ok(merged.note.includes(iPronunciationNote));
});
