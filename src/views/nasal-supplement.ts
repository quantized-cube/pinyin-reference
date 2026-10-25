import type {AppState} from '../types.js';
import {searchText} from '../data.js';
import {esc} from './shared.js';

const nasalSyllables = [
  {pinyin:'m', reading:'ḿ・m̀', character:'呣', ipa:'m̩', note:'唇を閉じ、鼻に息を通す音。応答や問いかけなどに使います。'},
  {pinyin:'n', reading:'ń・ň・ǹ', character:'嗯', ipa:'n̩', note:'舌先を上の歯茎につけ、鼻に息を通す音。問い返しや応答などに使います。'},
  {pinyin:'ng', reading:'ńg・ňg・ǹg', character:'嗯', ipa:'ŋ̍', note:'舌の奥で口の通り道を閉じ、鼻に息を通す音。問い返しや応答などに使います。'},
  {pinyin:'hm', reading:'hm', character:'噷', ipa:'hm̩', note:'息の音から唇を閉じた鼻音へ続きます。とがめたり制止したりする声です。'},
  {pinyin:'hng', reading:'hng', character:'哼', ipa:'hŋ̍', note:'息の音から舌の奥を使う鼻音へ続きます。不満や疑いなどを表します。'},
] as const;

export function renderNasalSupplement(state: AppState): string {
  if(state.group!=='all'&&state.group!=='special')return '';
  const query=searchText(state.query,state.searchMode);
  const visible=nasalSyllables.flatMap(item=>{
    const keys=state.searchMode==='ipa'?[item.ipa.normalize('NFC')]:[item.pinyin,item.character];
    return keys.some(key=>key.includes(query))?[{...item,exact:!!query&&keys.includes(query)}]:[];
  });
  if(!visible.length)return '';
  const exactCount=visible.filter(item=>item.exact).length;
  // The Enter handler uses the target marked by this same filtered search.
  return `<section class="nasal-supplement" aria-labelledby="nasal-title">
    <h3 id="nasal-title" tabindex="-1"${exactCount>1?' data-nasal-search-target':''}>鼻音が中心になる音節 <small>補足・録音なし</small></h3>
    <p>嗯・哼などには、母音を入れず、鼻音を中心に発音する読みがあります。m・n・ng・hm・hng は感動詞などに使う特殊な音節で、上の40欄やマトリクスには含めていません。</p>
    <div class="nasal-grid">${visible.map(item=>`<article class="nasal-card" data-nasal="${item.pinyin}">
      <h4 tabindex="-1"${item.exact&&exactCount===1?' data-nasal-search-target':''}><span lang="zh">${esc(item.character)}</span> <span class="nasal-pinyin">${esc(item.reading)}</span></h4>
      <div class="ipa">[${item.ipa}]</div><p>${esc(item.note)}</p>
    </article>`).join('')}</div>
    <p class="nasal-notation">IPAは声調を省いた音の目安です。[m̩・n̩] の下、[ŋ̍] の上の縦線は、その鼻音が音節の中心になることを示します。hm・hng は辞書の表記に合わせて声調記号を付けていませんが、軽声と決まっているわけではありません。</p>
    <p>哼には、母音を含む hēng（鼻歌を歌う・うめく）という読みもあり、heng としてマトリクスに載せています。嗯を en と記す読みもありますが、ここでは n・ng の読みを扱います。</p>
    <p class="nasal-sources">表記の参考：漢典の <a href="https://www.zdic.net/hans/呣" target="_blank" rel="noreferrer">呣</a>・<a href="https://www.zdic.net/hans/嗯" target="_blank" rel="noreferrer">嗯</a>・<a href="https://www.zdic.net/hant/噷" target="_blank" rel="noreferrer">噷</a>・<a href="https://www.zdic.net/hans/哼" target="_blank" rel="noreferrer">哼</a></p>
  </section>`;
}
