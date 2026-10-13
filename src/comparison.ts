import type {ComparisonSyllables, ExampleMap, PronunciationExample, ToneId} from './types.js';
import {required} from './types.js';
import {markTone} from './data.js';
import {isolatedExample} from './examples.js';

export const comparisonGroups = [
  {id:'i-sounds', label:'s・sh・x／z・zh・j と、3種類の i'},
  {id:'finals', label:'韻母・鼻音'},
  {id:'aspiration', label:'無気・有気'},
] as const;

interface ComparisonPreset {
  readonly id: string;
  readonly label: string;
  readonly group: typeof comparisonGroups[number]['id'];
  readonly syllables: Readonly<ComparisonSyllables>;
  readonly tone: Exclude<ToneId, 5>;
  readonly note: string;
}

export const comparisonPresets = [
  {id:'si-shi-xi', label:'si / shi / xi', group:'i-sounds', syllables:['si','shi','xi'], tone:1, note:'s / sh / x を含む音節の比較です。声母の摩擦音と、続く i の発音の両方を聞き比べます。'},
  {id:'zi-zhi-ji', label:'zi / zhi / ji', group:'i-sounds', syllables:['zi','zhi','ji'], tone:1, note:'z / zh / j を含む音節の比較です。いずれも無気の破擦音ですが、調音位置と、続く i の発音が異なります。'},
  {id:'yi-zi-zhi', label:'yi / zi / zhi', group:'i-sounds', syllables:['yi','zi','zhi'], tone:1, note:'yi の通常の i と、zi・zhi の舌先の i を比較します。yi は声母なし、zi・zhi は声母を含む音節全体の再生です。'},
  {id:'an-ang', label:'an ↔ ang', group:'finals', syllables:['an','ang'], tone:1, note:'-n は舌先、-ng は舌の奥で閉じます。母音も [a] と [ɑ] の違いに注目。'},
  {id:'en-eng', label:'en ↔ eng', group:'finals', syllables:['ben','beng'], tone:1, note:'同じ声母 b と第1声で、鼻音の終わり方を比較します。'},
  {id:'ian-iang', label:'ian ↔ iang', group:'finals', syllables:['xian','xiang'], tone:1, note:'ian の母音は [ɛ] 系、iang は [ɑ] 系。末尾だけでなく母音も変わります。'},
  {id:'in-ing', label:'in ↔ ing', group:'finals', syllables:['yin','ying'], tone:1, note:'-n と -ng の閉じる場所を比べます。ing は話者によって [iəŋ] 系にもなります。'},
  {id:'u-ü', label:'u ↔ ü', group:'finals', syllables:['lu','lü'], tone:4, note:'同じ声母 l と第4声。u は舌が後ろ、ü は i の舌の位置で唇を丸めます。'},
  {id:'b-p', label:'b ↔ p', group:'aspiration', syllables:['ba','pa'], tone:1, note:'両唇の無気音と有気音。同じ声調で、開放後の息を比べます。'},
  {id:'d-t', label:'d ↔ t', group:'aspiration', syllables:['da','ta'], tone:1, note:'舌尖の無気音と有気音。どちらも無声音です。'},
  {id:'g-k', label:'g ↔ k', group:'aspiration', syllables:['ge','ke'], tone:1, note:'舌根の無気音と有気音。どちらも無声音です。'},
  {id:'j-q', label:'j ↔ q', group:'aspiration', syllables:['ji','qi'], tone:1, note:'舌面の無気音と有気音。同じ韻母 i で比べます。'},
  {id:'zh-ch', label:'zh ↔ ch', group:'aspiration', syllables:['zhi','chi'], tone:1, note:'そり舌の無気音と有気音。同じ舌先の i で比べます。'},
  {id:'z-c', label:'z ↔ c', group:'aspiration', syllables:['zi','ci'], tone:1, note:'舌歯の無気音と有気音。同じ舌先の i で比べます。'},
] as const satisfies readonly ComparisonPreset[];

export const comparisonSides = ['A','B','C'] as const;
export function comparisonEntries(syllables: Readonly<ComparisonSyllables>) {
  return syllables.map((pinyin,index)=>({side:required(comparisonSides[index],'comparison side'),pinyin}));
}

export function comparisonOrder(syllables: Readonly<ComparisonSyllables>, selection: string) {
  const entries=comparisonEntries(syllables);
  return selection==='alternate'?[...entries,...entries]:entries.filter(entry=>entry.side===selection);
}

export function comparisonExample(pinyin: string, tone: ToneId, examples: ExampleMap): PronunciationExample | undefined {
  return isolatedExample(pinyin, tone, examples);
}

// Rendering, voice refresh and playback must agree on missing examples for every side.
export function comparisonSequence(syllables: Readonly<ComparisonSyllables>, tone: ToneId, examples: ExampleMap, selection: string) {
  const order=comparisonOrder(syllables,selection);
  if(!order.length)return undefined;
  const items: {text: string;label: string}[]=[];
  for(const {side,pinyin} of order){
    const example=comparisonExample(pinyin,tone,examples);
    if(!example)return undefined;
    items.push({text:example.text,label:`${side} · ${markTone(pinyin,tone)}`});
  }
  return items;
}
