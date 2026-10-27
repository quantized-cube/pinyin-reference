import {getSyllable,markTone} from './data.js';
import {syllableRecording} from './syllable-recordings.js';
import {required} from './types.js';
import type {ToneId,FinalId} from './types.js';

interface ErhuaRecording {
  text: string;
  pinyin: string;
  audio: string;
}

function pair(id: string, text: string, tone: ToneId): {id:string;final:FinalId;before:ErhuaRecording;after:ErhuaRecording} {
  const pinyin=markTone(id,tone);
  return {id,final:getSyllable(id).final,
    before:{text,pinyin,audio:required(syllableRecording(id,tone),`erhua base recording ${id}${tone}`)},
    after:{text:text+'儿',pinyin:pinyin+'r',audio:`audio/erhua/${id}r.mp3`},
  };
}

// Both sides are complete single syllables at the same lexical tone, with no splicing.
// The basic recordings and these erhua recordings have different speakers.
export const erhuaComparisons = [
  pair('xian','馅',4), pair('wan','玩',2), pair('na','哪',3),
  pair('hua','画',4), pair('dai','带',4), pair('dou','兜',1),
  pair('ge','个',4), pair('zuo','座',4), pair('kong','空',4),
] as const;

export function getErhuaComparison(id: string) {
  return erhuaComparisons.find(item=>item.id===id);
}

export function erhuaSequence(id: string, side: string) {
  const item=getErhuaComparison(id);
  if(!item)return undefined;
  const order=side==='both'?['before','after'] as const:side==='before'||side==='after'?[side]:[];
  if(!order.length)return undefined;
  return order.map(key=>{
    const recording=key==='before'?item.before:item.after;
    return {url:recording.audio,label:`${key==='before'?'児化前':'児化後'} · ${recording.text} ${recording.pinyin}`};
  });
}
