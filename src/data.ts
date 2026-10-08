import type { InitialId, FinalId, Initial, Final, GroupFilter, Syllable, Tone, ToneId, SearchFilters } from './types.js';
import { isToneId, required } from './types.js';
import { articulationSearchText } from './articulation.js';

// Hand-curated teaching transcription. Sources and transcription choices: README.md.
export const initials: readonly Initial[] = ([
  ['', '', '声母なし', 'y / w はここに含めます。'],
  ['b','p','両唇・無気破裂音','唇を閉じて開く。濁音ではなく、息が弱い [p]。'],
  ['p','pʰ','両唇・有気破裂音','b と同じ位置で、強く息を出す。'],
  ['m','m','両唇・鼻音','唇を閉じ、鼻へ息を通す。'],
  ['f','f','唇歯・摩擦音','上の歯を下唇に近づける。'],
  ['d','t','歯茎・無気破裂音','舌先を上の歯茎につけ、弱く息を出す。濁音ではない。'],
  ['t','tʰ','歯茎・有気破裂音','d と同じ位置で、強く息を出す。'],
  ['n','n','歯茎・鼻音','舌先を上の歯茎につけ、鼻へ息を通す。'],
  ['l','l','歯茎・側面接近音','舌先を歯茎につけ、舌の両側に息を通す。'],
  ['g','k','軟口蓋・無気破裂音','舌の奥を上げて閉鎖し、弱く息を出す。濁音ではない。'],
  ['k','kʰ','軟口蓋・有気破裂音','g と同じ位置で、強く息を出す。'],
  ['h','x','軟口蓋・摩擦音','舌の奥と軟口蓋の間を狭める。'],
  ['j','tɕ','歯茎硬口蓋・無気破擦音','舌の前部を硬口蓋に近づける。'],
  ['q','tɕʰ','歯茎硬口蓋・有気破擦音','j と同じ位置で、強く息を出す。'],
  ['x','ɕ','歯茎硬口蓋・摩擦音','舌の前部と硬口蓋の間に息を通す。'],
  ['zh','ʈʂ','そり舌・無気破擦音','舌先を歯茎より後ろへ向ける。'],
  ['ch','ʈʂʰ','そり舌・有気破擦音','zh と同じ位置で、強く息を出す。'],
  ['sh','ʂ','そり舌・摩擦音','舌先を後ろへ向け、すき間に息を通す。'],
  ['r','ɻ','そり舌・接近音','[ʐ] とする分析や摩擦の強い発音もある。'],
  ['z','ts','歯茎・無気破擦音','舌先を上の歯の裏側に近づける。'],
  ['c','tsʰ','歯茎・有気破擦音','z と同じ位置で、強く息を出す。'],
  ['s','s','歯茎・摩擦音','舌先付近の狭いすき間に息を通す。'],
] satisfies readonly [InitialId,string,string,string][]).map(([id,ipa,label,note]) => ({id,ipa,label,note}));

export const groups: readonly (readonly [GroupFilter,string])[] = [ ['all','すべて'], ['plain','基本韻母'], ['i','i 系'], ['u','u 系'], ['ü','ü 系'], ['special','特殊韻母'] ];
export const finals: readonly Final[] = ([
  ['a','a','plain','口を大きく開く。'], ['o','o','plain','唇を丸める。b / p / m / f の後は [wo] 系で示す。'],
  ['e','ɤ','plain','唇を丸めず、舌を奥に置く。軽声では [ə] に近づくことがある。'],
  ['ai','ai̯','plain','a から i へ移る。'], ['ei','ei̯','plain','e から i へ移る。'],
  ['ao','ɑu̯','plain','o の文字でも、終わりは [u̯] 系。'], ['ou','ou̯','plain','o から u へ移る。'],
  ['an','an','plain','舌先で閉じる -n。'], ['en','ən','plain','中舌母音 [ə] と -n。'],
  ['ang','ɑŋ','plain','舌の奥で閉じる -ng。'], ['eng','əŋ','plain','[ɤŋ] とする資料もある。'],
  ['ong','ʊŋ','plain','単独では使わない。ueng と関連するが、ここでは別欄。'],
  ['i','i','i','zi / zhi の i とは異なる。'], ['ia','ja','i','最初の i は短いわたり音 [j]。'],
  ['ie','jɛ','i','[je] とする資料もある。'], ['iao','jɑu̯','i','i + ao。'],
  ['iou','jou̯','i','声母の後は iu。声調・速度によって [ju] に近づく。'],
  ['ian','jɛn','i','a の文字でも [ɛ] 系。'], ['in','in','i','[i] から -n へ。'],
  ['iang','jɑŋ','i','ian と違い、a は [ɑ] 系。'], ['ing','iŋ','i','[iŋ]〜[iəŋ]。'],
  ['iong','jʊŋ','i','yong / jiong / qiong / xiong。[yŋ] 系とする分析もある。'],
  ['u','u','u','唇を丸める後舌母音。'], ['ua','wa','u','最初の u は [w]。'],
  ['uo','wo','u','u から o へ滑らかにつなぐ。'], ['uai','wai̯','u','u + ai。'],
  ['uei','wei̯','u','声母の後は ui。'], ['uan','wan','u','üan [ɥɛn] と区別する。'],
  ['uen','wən','u','声母の後は un。jun / qun / xun の un とは異なる。'],
  ['uang','wɑŋ','u','u + ang。'], ['ueng','wəŋ','u','この表では声母なしの weng のみ。'],
  ['ü','y','ü','舌は i の位置に保ち、唇を丸める。'], ['üe','ɥɛ','ü','[ɥe] とする資料もある。'],
  ['üan','ɥɛn','ü','j / q / x の後は uan。a は [ɛ] 系。'], ['ün','yn','ü','j / q / x の後は un。'],
  ['er','ɚ','special','独立音節の er。児化した韻尾 -r の網羅表ではない。'],
  ['-i(z)','ɹ̩','special','zi / ci / si の音節主音。舌尖母音 [ɿ] とする伝統的表記もある。'],
  ['-i(zh)','ɻ̩','special','zhi / chi / shi / ri の音節主音。伝統的には [ʅ]。'],
  ['ê','ɛ','special','感動詞などで独立する ê。e [ɤ] とは別。'],
  ['io','jo','special','yo の感動詞など。周辺的な音節。'],
] satisfies readonly [FinalId,string,Final['group'],string][]).map(([id,ipa,group,note]) => ({id,ipa,group,note}));

// Explicit inventory, not a Cartesian product. No invented consonant/final combinations.
const rows: Record<InitialId, readonly FinalId[]> = {
  '': ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'er', 'i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong', 'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang', 'ueng', 'ü', 'üe', 'üan', 'ün', 'ê', 'io'],
  b: ['a', 'o', 'ai', 'ei', 'ao', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'iao', 'ian', 'in', 'ing', 'u'],
  p: ['a', 'o', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'iao', 'ian', 'in', 'ing', 'u'],
  m: ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'i', 'ie', 'iao', 'iou', 'ian', 'in', 'ing', 'u'],
  f: ['a', 'o', 'ei', 'ou', 'an', 'en', 'ang', 'eng', 'u'],
  d: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'i', 'ia', 'ie', 'iao', 'iou', 'ian', 'ing', 'u', 'uo', 'uei', 'uan', 'uen'],
  t: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'ang', 'eng', 'ong', 'i', 'ie', 'iao', 'ian', 'ing', 'u', 'uo', 'uei', 'uan', 'uen'],
  n: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'i', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'u', 'uo', 'uan', 'uen', 'ü', 'üe'],
  l: ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'ang', 'eng', 'ong', 'i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'u', 'uo', 'uan', 'uen', 'ü', 'üe'],
  g: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang'],
  k: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang'],
  h: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang'],
  j: ['i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
  q: ['i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
  x: ['i', 'ia', 'ie', 'iao', 'iou', 'ian', 'in', 'iang', 'ing', 'iong', 'ü', 'üe', 'üan', 'ün'],
  zh: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', '-i(zh)', 'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang'],
  ch: ['a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', '-i(zh)', 'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang'],
  sh: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', '-i(zh)', 'u', 'ua', 'uo', 'uai', 'uei', 'uan', 'uen', 'uang'],
  r: ['e', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', '-i(zh)', 'u', 'ua', 'uo', 'uei', 'uan', 'uen'],
  z: ['a', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', '-i(z)', 'u', 'uo', 'uei', 'uan', 'uen'],
  c: ['a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', '-i(z)', 'u', 'uo', 'uei', 'uan', 'uen'],
  s: ['a', 'e', 'ai', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', '-i(z)', 'u', 'uo', 'uei', 'uan', 'uen'],
};
const zero: Partial<Record<FinalId, string>> = { i:'yi',ia:'ya',ie:'ye',iao:'yao',iou:'you',ian:'yan',in:'yin',iang:'yang',ing:'ying',iong:'yong',u:'wu',ua:'wa',uo:'wo',uai:'wai',uei:'wei',uan:'wan',uen:'wen',uang:'wang',ueng:'weng',ü:'yu',üe:'yue',üan:'yuan',ün:'yun',io:'yo' };
const shortened: Partial<Record<FinalId, string>> = { iou:"iu", uei:"ui", uen:"un" };
export function spell(initial: InitialId, final: FinalId): string {
  if (!initial) return zero[final] || final;
  if (final.startsWith('-i')) return initial + 'i';
  let written = shortened[final] || final;
  if (['j','q','x'].includes(initial)) written = written.replace('ü','u');
  return initial + written;
}
const peripheral = new Set('ê yo lo eng den dia tei nou nun kei zhei chua rua'.split(' '));
export const syllables: readonly Syllable[] = initials.flatMap(({id: initial}) => rows[initial].map(final => {
  const pinyin = spell(initial, final);
  const onset = getInitial(initial);
  const rime = getFinal(final);
  const rimeIpa = final === 'o' && ['b','p','m','f'].includes(initial) ? 'wo' : rime.ipa;
  return { pinyin, initial, final, ipa:pinyin==='ri' ? 'ɻ̩' : onset.ipa + rimeIpa, rimeIpa, peripheral:peripheral.has(pinyin) };
}));
export const syllableMap = new Map(syllables.map(s => [s.pinyin, s]));
export const tones: readonly Tone[] = [
  {id:1,label:'第1声',name:'陰平',value:'55',ipa:'˥',points:'8,12 92,12',note:'高い位置を保つ。'},
  {id:2,label:'第2声',name:'陽平',value:'35',ipa:'˧˥',points:'8,38 92,12',note:'中ほどから高く上げる。'},
  {id:3,label:'第3声',name:'上声',value:'214',ipa:'˨˩˦',points:'8,48 42,60 92,25',note:'単独で丁寧に読むと低く下がって上がる。連続発話では低い部分だけになることが多い。'},
  {id:4,label:'第4声',name:'去声',value:'51',ipa:'˥˩',points:'8,12 92,60',note:'高い位置から一気に下げる。'},
  {id:5,label:'軽声',name:'軽声',value:'文脈依存',ipa:'',points:'35,38 65,38',note:'弱く短く読む。高さは前の声調に依存し、固定の第5の調形ではない。'},
];
export function markTone(base: string, tone: ToneId | 0 | null): string {
  if (tone === 0 || tone === 5 || !tone) return base;
  let index = base.indexOf('a');
  if (index < 0) index = base.indexOf('e');
  if (index < 0) index = base.indexOf('ê');
  if (index < 0 && base.includes('ou')) index = base.indexOf('o');
  if (index < 0) for (let i = base.length - 1; i >= 0; i--) { if ('iouü'.includes(base.charAt(i))) { index = i; break; } }
  if (index < 0) return base;
  return (base.slice(0,index+1) + ['','\u0304','\u0301','\u030c','\u0300'][tone] + base.slice(index+1)).normalize('NFC');
}
export function parseQuery(input: string): {text: string; tone: ToneId | null} {
  let text = input.trim().toLowerCase().replaceAll('u:', 'ü').replaceAll('v', 'ü');
  const numeric = text.match(/([0-5])$/);
  const numericTone = numeric ? Number(numeric[1]) || 5 : null;
  let tone: ToneId | null = isToneId(numericTone) ? numericTone : null;
  text = text.replace(/[0-5]$/, '');
  const accents = ['\u0304','\u0301','\u030c','\u0300'];
  text = text.normalize('NFD').split('').filter(c => {
    const t = accents.indexOf(c); if (t < 0) return true;
    if (!numeric && isToneId(t + 1)) tone = t + 1; return false;
  }).join('').normalize('NFC');
  // Keep diaeresis and circumflex: nü != nu, ê != e.
  return {text, tone};
}
export function rulesFor(s: Syllable): string[] {
  const result = [];
  if (s.final.startsWith('ü')) result.push(['j','q','x'].includes(s.initial) ? 'ü の点を省略：j / q / x の後では ü → u。発音は [y] 系のまま。' : !s.initial ? '声母なしの ü 系：y を前に置き、ü の点を省略する。' : 'n / l の後は ü の点を残し、u と区別する。');
  if (['iou','uei','uen'].includes(s.final) && s.initial) result.push(`${s.final} → ${shortened[s.final]}：声母の後では中央の文字を省略する。`);
  if (!s.initial && zero[s.final]) result.push(`声母なし：${s.final} → ${s.pinyin}。y / w は音節境界を示す綴りで、この表の21声母には数えない。`);
  if (s.final.startsWith('-i')) result.push('この i は [i] ではない。直前の子音に対応した舌の位置で音節を作る。');
  if (s.pinyin==='ri') result.push('ri は声母と韻母が連続するため、音節全体を [ɻ̩] とまとめて示す。');
  if (['ian','üan'].includes(s.final)) result.push('a の文字でも、この韻母では [ɛ] 系の母音になる。');
  if (s.final === 'o' && ['b','p','m','f'].includes(s.initial)) result.push('bo / po / mo / fo の o は [wo] 系。資料によって [o] と簡略に示す。');
  return result.length ? result : ['この組み合わせでは、声母と韻母をそのままつなげて書く。'];
}
export function findSyllables(query: string, {group='all',initial='all',rare=true}: SearchFilters={}): Syllable[] {
  const {text} = parseQuery(query);
  return syllables.filter(s => (group==='all' || getFinal(s.final).group===group) && (initial==='all' || s.initial===initial) && (rare || !s.peripheral) && (!text || s.pinyin.includes(text) || s.final.includes(text) || s.ipa.includes(text) || articulationSearchText(s.initial).includes(text)))
    .sort((a,b) => Number(b.pinyin===text)-Number(a.pinyin===text));
}

export function getInitial(id: InitialId): Initial { return required(initials.find(i => i.id === id), `initial ${id}`); }
export function getFinal(id: FinalId): Final { return required(finals.find(f => f.id === id), `final ${id}`); }
export function getSyllable(pinyin: string): Syllable { return required(syllableMap.get(pinyin), `syllable ${pinyin}`); }
export function getTone(id: ToneId): Tone { return required(tones.find(t => t.id === id), `tone ${id}`); }
export function isInitialId(value: string): value is InitialId { return initials.some(i => i.id === value); }
export function isGroupFilter(value: unknown): value is GroupFilter { return groups.some(([id]) => id === value); }
