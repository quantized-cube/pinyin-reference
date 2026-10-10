import type {AppState} from '../types.js';
import {finals,syllables,searchText} from '../data.js';
import {orderedFinals,finalSections,matrixFinalId} from '../layout.js';
import {required} from '../types.js';
import {esc,groupButtons,empty,renderOrderGuide} from './shared.js';
export function renderFinals(state: AppState){
  const text=searchText(state.query,state.searchMode);
  const list=orderedFinals.filter(f=>(state.group==='all'||f.group===state.group)&&(!text||(state.searchMode==='ipa'?f.ipa.includes(text):f.id.includes(text)||syllables.some(s=>s.final===f.id&&s.pinyin.includes(text)))));
  const sections=finalSections.map(section=>({...section,visible:list.filter(f=>section.finals.includes(f.id))})).filter(section=>section.visible.length);
  const cards=sections.map(section=>`<section class="final-section" data-final-section="${section.id}"><h3>${section.label}<small>${section.visible.length} 欄</small></h3><div class="card-grid">${section.visible.map(f=>{
    const s=required(syllables.find(s=>s.final===f.id&&!s.initial)||syllables.find(s=>s.final===f.id),`example for ${f.id}`);
    const forms=[...new Set(syllables.filter(s=>s.final===f.id).map(s=>s.initial?s.pinyin.slice(s.initial.length):s.pinyin))];
    const symbol=f.id==='io'?'yo':matrixFinalId(f.id);
    const context=f.id==='i'?'yi・mi系':f.id==='-i(z)'?'zi系':f.id==='-i(zh)'?'zhi系':'';
    return `<button class="sound-card" data-final="${f.id}" data-pick="${s.pinyin}"><div><span class="card-symbol">${esc(symbol)}</span><span class="ipa">[${f.ipa}]</span>${context?`<span class="card-context">（${context}）</span>`:''}</div><div class="card-spelling">${f.id==='io'?'分析上の韻母：io<br>':''}綴り：${forms.join(' / ')}</div><p class="note">${esc(f.note)}</p><span class="card-foot"><span>例：${s.pinyin}</span><span>詳細・音声 ↗</span></span></button>`;
  }).join('')}</div></section>`).join('');
  return `<div class="section-heading"><h2>韻母の音と綴り</h2><span>${list.length} / ${finals.length} 欄</span></div><div class="filters"><span class="filter-label">綴りの系統で絞り込む</span>${groupButtons(state)}</div><p class="tone-note">単韻母の中で i の3種類を比較できるように並べ、ê・er も単韻母に含めています。末尾の補足は yo（分析上の韻母 io）です。カードを選ぶと、その韻母の例音節を表示します。韻母単体の録音ではありません。</p>${list.length?cards:empty()}${renderOrderGuide()}`;
}
