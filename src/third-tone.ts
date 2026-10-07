import type { ExampleMap, PronunciationExample, ThirdToneExampleMap, ThirdToneForm, ThirdToneFormId } from './types.js';
import { required } from './types.js';

// Teaching contours, not measurements or instructions to the speech synthesizer.
export const thirdToneForms: readonly ThirdToneForm[] = [
  { id: 'full', label: '全三声', value: '214', ipa: '˨˩˦', points: '8,48 42,60 92,25',
    note: '単独で丁寧に読むときの代表形。低く下げてから上げます。自然な発話では、語末でも上がらないことがあります。' },
  { id: 'half', label: '半三声', value: '21', ipa: '˨˩', points: '8,48 92,60',
    note: '後半を上げず、低く発音する形。同じまとまりの中で第1・2・4声の前に来るときなどに現れます。' },
  { id: 'sandhi', label: '3声＋3声', value: '35 相当', ipa: '˧˥', points: '8,38 92,12',
    note: '第3声が同じまとまりで続くと、前の第3声が第2声に近い上昇形になります。辞書の読み・声調記号は第3声のままです。' },
];

export function isThirdToneFormId(value: unknown): value is ThirdToneFormId {
  return value === 'full' || value === 'half' || value === 'sandhi';
}
export function getThirdToneForm(id: ThirdToneFormId): ThirdToneForm {
  return required(thirdToneForms.find(form => form.id === id), `third tone form ${id}`);
}
export function fitsThirdToneForm(form: ThirdToneFormId, example: PronunciationExample): boolean {
  if (!example.tokens[example.target]?.endsWith('3')) return false;
  if (form === 'full') return example.tokens.length === 1 && example.target === 0;
  // Only curated two-syllable words, with the first syllable as the target.
  // Neutral tones, phrase boundaries and longer tone-3 chains need separate review.
  if (example.tokens.length !== 2 || example.target !== 0) return false;
  const next = example.tokens[1];
  return form === 'half' ? /[124]$/.test(next ?? '') : next?.endsWith('3') === true;
}
export function thirdToneExample(
  pinyin: string, form: ThirdToneFormId, curated: ThirdToneExampleMap, general: ExampleMap,
): PronunciationExample | undefined {
  const key = pinyin + '3';
  const candidate = curated[key]?.[form];
  if (candidate && fitsThirdToneForm(form, candidate)) return candidate;
  const single = general[key];
  // Never play a contextual example underneath an unrelated isolated contour.
  return form === 'full' && single && fitsThirdToneForm(form, single) ? single : undefined;
}
