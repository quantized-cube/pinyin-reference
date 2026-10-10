import type {AppState} from '../types.js';
import {initials,findSyllables} from '../data.js';
import {initialSections,finalSections,matrixFinals,matrixFinalId,finalHeading} from '../layout.js';
import {esc,groupButtons,empty,renderOrderGuide} from './shared.js';
export function renderMatrix(state: AppState){
  const matches=findSyllables(state.query,state), matchSet=new Set(matches.map(s=>s.pinyin));
  const fs=matrixFinals.filter(f=>f.variants.some(v=>state.group==='all'||state.group===v.group)&&(!state.query||matches.some(s=>matrixFinalId(s.final)===f.id)));
  const ins=initials.filter(i=>(state.initial==='all'||state.initial===i.id)&&matches.some(s=>s.initial===i.id));
  const finalBands=finalSections.map(section=>({...section,visible:fs.filter(f=>section.finals.includes(f.id))})).filter(section=>section.visible.length);
  const initialBands=initialSections.map(section=>({...section,visible:ins.filter(i=>section.initials.includes(i.id))})).filter(section=>section.visible.length);
  const starts=new Set(finalBands.map(section=>section.visible[0]?.id));
  const cells=new Map(matches.map(s=>[`${s.initial}|${matrixFinalId(s.final)}`,s]));
  const header=`<thead><tr class="final-section-row"><th scope="col" rowspan="2" class="matrix-corner">声母<small>↓ / 韻母 →</small></th>${finalBands.map(section=>`<th scope="colgroup" colspan="${section.visible.length}" class="final-section-start">${section.label}</th>`).join('')}</tr><tr class="final-heading">${fs.map(f=>`<th scope="col" id="final-${f.id}" data-final="${f.id}" class="${starts.has(f.id)?'final-section-start':''}" title="${esc(f.note)}">${esc(finalHeading(f.id))}<small>[${f.ipa}]</small></th>`).join('')}</tr></thead>`;
  const body=initialBands.map(section=>`<tbody data-initial-section="${section.id}"><tr class="initial-group-row"><th scope="rowgroup" id="initial-group-${section.id}" colspan="${fs.length+1}"><span class="initial-group-title">${section.label}<small>${section.note}</small></span></th></tr>${section.visible.map(i=>{
    const row=ins.indexOf(i),rowId=`initial-${i.id||'zero'}`;
    return `<tr><th scope="row" id="${rowId}">${i.id||'∅'}<small>${i.ipa}</small></th>${fs.map((f,col)=>{
      const s=cells.get(`${i.id}|${f.id}`),divider=starts.has(f.id)?' final-section-start':'';
      return s&&matchSet.has(s.pinyin)?`<td class="${divider.trim()}" headers="initial-group-${section.id} ${rowId} final-${f.id}"><button data-syllable="${s.pinyin}" data-row="${row}" data-col="${col}" aria-label="${s.pinyin}、IPA ${s.ipa}、詳細を表示" aria-pressed="${s.pinyin===state.selected}" tabindex="${s.pinyin===state.selected?0:-1}" class="${s.peripheral?'peripheral':''}">${s.pinyin}${state.ipa?`<span class="cell-ipa">[${s.ipa}]</span>`:''}</button></td>`:`<td class="empty${divider}">—</td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody>`).join('');
  return `<div class="section-heading"><h2>声母 × 韻母</h2><span role="status">${matches.length} 音節を表示</span></div><p class="matrix-order">単韻母 → 複合韻母 → 鼻韻母 → 補足の音節</p><div class="filters"><span class="filter-label">綴りの系統で絞り込む</span>${groupButtons(state)}</div><div class="filter-bottom"><label>声母 <select id="initial-filter" aria-label="声母で絞り込む"><option value="all">すべての声母</option>${initials.map(i=>`<option value="${i.id}" ${i.id===state.initial?'selected':''}>${i.id||'∅（声母なし）'}</option>`).join('')}</select></label><div><label><input id="show-ipa" type="checkbox" ${state.ipa?'checked':''}> IPAを併記</label><label><input id="show-rare" type="checkbox" ${state.rare?'checked':''}> 周辺的な音節</label></div></div>${matches.length?`<div class="matrix-scroll" tabindex="0" aria-label="音節表。左右にスクロールできます。音節ボタンでは矢印キーで移動できます。"><table class="matrix"><caption>普通話の有効音節。行は発音する場所で分類した声母、列は学習順の韻母。横棒は未収録の組み合わせ。</caption>${header}${body}</table></div><div class="table-hint"><div class="legend"><span>クリックで詳細</span><span>茶色：周辺的な音節</span></div><span>← 左右にスクロール / 矢印キーで音節を移動 →</span></div>`:empty()}<p class="tone-note">i 列の発音：yi・mi などは [i]、zi・ci・si は [ɹ̩]、zhi・chi・shi・ri は [ɻ̩]。見出しの / は発音の区別を示します。「i 系」は [i] 系、「特殊韻母」は舌先の i を含む分類です。</p>${renderOrderGuide()}`;
}
