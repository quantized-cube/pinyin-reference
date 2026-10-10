import type {AppState} from '../types.js';
import {initials,getInitial,searchText} from '../data.js';
import {places,manners,aspirations,voicings,articulationTerms,articulationSearchText,aspirationPairs,placeTerminologyNote} from '../articulation.js';
import type {InitialId} from '../types.js';
import {esc,empty} from './shared.js';
export function articulationBadges(id: InitialId){return `<span class="articulation-badges">${articulationTerms(id).map(term=>`<span>${esc(term.label)}</span>`).join('')}</span>`;}
export function renderArticulationGuide(){
  const sections=[['発音する場所（調音位置）',places],['音の作り方（調音方法）',manners],['息の出方',aspirations],['声帯の振動',voicings]] as const;
  return `<details class="articulation-guide"><summary>用語ガイド（唇音・無気音など）</summary><p>声母は「どこで」「どう作るか」「息の出方」「声帯の振動」で整理できます。有気／無気と、有声／無声は別の特徴です。</p><p>${placeTerminologyNote}</p><div class="articulation-glossary">${sections.map(([title,terms])=>`<section><h3>${title}</h3><dl>${Object.values(terms).map(term=>`<dt>${term.label}</dt><dd>${term.note}</dd>`).join('')}</dl></section>`).join('')}</div><section class="aspiration-comparison"><h3>無気音・有気音を比べる</h3><p>同じ場所・作り方のペアです。どちらも無声音で、主な違いは開放後の息。口の前に手をかざして、同じ声調・速さで例音節を比べてみましょう。</p><div class="aspiration-pairs">${aspirationPairs.map(([a,b,sa,sb])=>`<div><button data-pick="${sa}"><strong>${a} [${getInitial(a).ipa}]</strong><small>無気音 · 例 ${sa}</small></button><button data-pick="${sb}"><strong>${b} [${getInitial(b).ipa}]</strong><small>有気音 · 例 ${sb}</small></button></div>`).join('')}</div><p>この表で有気／無気を対比するのは破裂音・破擦音です。摩擦音や鼻音などには、有気／無気のラベルを付けていません。</p></section><p class="articulation-source">教材の呼び方と本アプリのIPA表記を対応させています。細かな調音位置や r の分析などは資料によって異なります。<a href="https://bitex-cn.com/?a=fourtone&amp;m=dic" target="_blank" rel="noreferrer">教材での呼び方：BitExの音節表 ↗</a> · <a href="https://music.ccnu.edu.cn/info/1661/42641.htm" target="_blank" rel="noreferrer">別名の参考：華中師範大学の解説 ↗</a> · <a href="https://courses.washington.edu/chin342/ipa/consonants.html" target="_blank" rel="noreferrer">ワシントン大学の子音表 ↗</a></p></details>`;
}
export function renderInitialArticulation(id: InitialId){
  if(!id)return '';
  const initial=getInitial(id);
  return `<section class="initial-articulation" aria-label="声母の発音の特徴"><h3 class="mini-title">声母 ${id} の発音<span>調音の特徴</span></h3>${articulationBadges(id)}<p>${esc(initial.note)}</p><details><summary>用語の意味を見る</summary><dl>${articulationTerms(id).map(term=>`<dt>${term.label}</dt><dd>${term.note}</dd>`).join('')}</dl><p>有気／無気は息の出方、有声／無声は声帯の振動を表します。</p></details></section>`;
}
export function renderInitials(state: AppState){
  const text=searchText(state.query,state.searchMode);
  const list=initials.filter(i=>i.id&&(!text||(state.searchMode==='ipa'?i.ipa.includes(text):i.id.includes(text)||articulationSearchText(i.id).includes(text))));
  const samples: Partial<Record<InitialId,string>>={b:'ba',p:'pa',m:'ma',f:'fa',d:'da',t:'ta',n:'na',l:'la',g:'ga',k:'ka',h:'ha',j:'ji',q:'qi',x:'xi',zh:'zhi',ch:'chi',sh:'shi',r:'ri',z:'zi',c:'ci',s:'si'};
  return `<div class="section-heading"><h2>21 の声母</h2><span>${list.length} / 21 声母</span></div><p class="tone-note">発音する場所・音の作り方・息・声帯の振動を表示します。「舌根音」「軟口蓋音」「舌歯音」「舌尖前音」など、教材名・音声学名・別名で検索できます。音声は声母を含む例音節です。</p>${renderArticulationGuide()}${list.length?`<div class="card-grid">${list.map(i=>`<button class="sound-card" data-pick="${samples[i.id]}"><div><span class="card-symbol">${i.id}</span><span class="ipa">[${i.ipa}]</span></div>${articulationBadges(i.id)}<p class="note">${i.note}</p><span class="card-foot"><span>例：${samples[i.id]}</span><span>詳細・音声 ↗</span></span></button>`).join('')}</div>`:empty()}`;
}
