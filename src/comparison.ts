import type {ComparisonSyllables, ExampleMap, PronunciationExample, ToneId} from './types.js';
import {required} from './types.js';
import {markTone} from './data.js';
import {isolatedExample} from './examples.js';

export const comparisonGroups = [
  {id:'nasal-finals', label:'鼻韻母の比較（-n / -ng）'},
  {id:'aspiration', label:'無気・有気'},
  {id:'initial-series', label:'s・sh・x／z・zh・j／c・ch・q の比較', description:'舌の位置による声母の違いと、続く i の発音を聞き比べます。'},
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
  {id:'si-shi-xi', label:'si / shi / xi', group:'initial-series', syllables:['si','shi','xi'], tone:1, note:'s / sh / x を含む音節の比較です。声母の摩擦音と、続く i の発音の両方を聞き比べます。'},
  {id:'zi-zhi-ji', label:'zi / zhi / ji', group:'initial-series', syllables:['zi','zhi','ji'], tone:1, note:'z / zh / j を含む音節の比較です。いずれも無気の破擦音ですが、調音位置と、続く i の発音が異なります。'},
  {id:'ci-chi-qi', label:'ci / chi / qi', group:'initial-series', syllables:['ci','chi','qi'], tone:1, note:'c / ch / q を含む音節の比較です。いずれも有気の破擦音ですが、調音位置と、続く i の発音が異なります。'},
  {id:'an-ang', label:'an ↔ ang', group:'nasal-finals', syllables:['an','ang'], tone:1, note:'-n は舌先、-ng は舌の奥で閉じます。母音も [a] と [ɑ] の違いに注目。'},
  {id:'en-eng', label:'en ↔ eng', group:'nasal-finals', syllables:['ben','beng'], tone:1, note:'同じ声母 b と第1声で、鼻音の終わり方を比較します。'},
  {id:'ian-iang', label:'ian ↔ iang', group:'nasal-finals', syllables:['xian','xiang'], tone:1, note:'ian の母音は [ɛ] 系、iang は [ɑ] 系。末尾だけでなく母音も変わります。'},
  {id:'in-ing', label:'in ↔ ing', group:'nasal-finals', syllables:['yin','ying'], tone:1, note:'-n と -ng の閉じる場所を比べます。ing は話者によって [iəŋ] 系にもなります。'},
  {id:'uan-uang', label:'uan ↔ uang', group:'nasal-finals', syllables:['guan','guang'], tone:1, note:'同じ声母 g と第1声で比較します。末尾の -n / -ng に加え、母音の [a] / [ɑ] の違いにも注目。'},
  {id:'uen-ueng', label:'uen ↔ ueng', group:'nasal-finals', syllables:['wen','weng'], tone:1, note:'声母なしでは uen → wen、ueng → weng と綴ります。同じ第1声で、末尾の -n と -ng を比べます。'},
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
