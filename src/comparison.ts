import type {ExampleMap, PronunciationExample, ToneId} from './types.js';

export const comparisonPresets = [
  {id:'an-ang', label:'an ↔ ang', a:'an', b:'ang', tone:1, note:'-n は舌先、-ng は舌の奥で閉じます。母音も [a] と [ɑ] の違いに注目。'},
  {id:'en-eng', label:'en ↔ eng', a:'ben', b:'beng', tone:1, note:'同じ声母 b と第1声で、鼻音の終わり方を比較します。'},
  {id:'ian-iang', label:'ian ↔ iang', a:'xian', b:'xiang', tone:1, note:'ian の母音は [ɛ] 系、iang は [ɑ] 系。末尾だけでなく母音も変わります。'},
  {id:'in-ing', label:'in ↔ ing', a:'yin', b:'ying', tone:1, note:'-n と -ng の閉じる場所を比べます。ing は話者によって [iəŋ] 系にもなります。'},
  {id:'b-p', label:'b ↔ p', a:'ba', b:'pa', tone:1, note:'両唇の無気音と有気音。同じ声調で、開放後の息を比べます。'},
  {id:'d-t', label:'d ↔ t', a:'da', b:'ta', tone:1, note:'舌尖の無気音と有気音。どちらも無声音です。'},
  {id:'g-k', label:'g ↔ k', a:'ge', b:'ke', tone:1, note:'舌根の無気音と有気音。どちらも無声音です。'},
  {id:'j-q', label:'j ↔ q', a:'ji', b:'qi', tone:1, note:'舌面の無気音と有気音。同じ韻母 i で比べます。'},
  {id:'zh-ch', label:'zh ↔ ch', a:'zhi', b:'chi', tone:1, note:'そり舌の無気音と有気音。同じ舌先の i で比べます。'},
  {id:'z-c', label:'z ↔ c', a:'zi', b:'ci', tone:1, note:'舌歯の無気音と有気音。同じ舌先の i で比べます。'},
  {id:'u-ü', label:'u ↔ ü', a:'lu', b:'lü', tone:4, note:'同じ声母 l と第4声。u は舌が後ろ、ü は i の舌の位置で唇を丸めます。'},
] as const;

// Single-character readings checked against the saved CC-CEDICT source (2026-10-07).
// This selection supplements the general catalog's preference for contextual words.
// Derived reading data: CC BY-SA 4.0, https://www.mdbg.net/chinese/dictionary?page=cedict
export const comparisonReadings: Readonly<Record<string, string>> = {
  an1:'安', ang1:'肮', ben1:'奔', beng1:'崩', xian1:'先', xiang1:'香',
  yin1:'音', ying1:'英', ge1:'歌', ke1:'科', ci1:'疵', lu4:'路',
};

export function comparisonExample(pinyin: string, tone: ToneId, examples: ExampleMap): PronunciationExample | undefined {
  // A neutral tone needs context and is not an isolated comparison recording.
  if (tone === 5) return undefined;
  const key = pinyin + tone;
  const curated = comparisonReadings[key];
  if (curated) return {text:curated, tokens:[key], target:0};
  const example = examples[key];
  return example?.tokens.length === 1 ? example : undefined;
}
