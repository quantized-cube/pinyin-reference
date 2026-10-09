import {initials,finals,groups,syllables,syllableMap,tones,markTone,parseQuery,rulesFor,findSyllables,getInitial,getFinal,getSyllable,getTone,isInitialId,isGroupFilter} from './data.js';
import {Speaker} from './speech.js';
import {initialSections,finalSections,orderedFinals,finalHeading,matrixFinals,matrixFinalId,finalContext} from './layout.js';
import {places,manners,aspirations,voicings,articulationTerms,articulationSearchText,aspirationPairs} from './articulation.js';
import {parseExampleCatalog} from './examples.js';
import {getThirdToneForm,isThirdToneFormId,thirdToneForms,thirdToneExample} from './third-tone.js';
import {isToneId,isTabId,required} from './types.js';
import type {AppState,ExampleMap,Tone,ToneId,InitialId,ThirdToneFormId,ThirdToneExampleMap,ThirdToneForm} from './types.js';

function $<T extends HTMLElement = HTMLElement>(selector: string): T { return required(document.querySelector<T>(selector), selector); }
const esc=(s: unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
const getSetting=(key: string,fallback: string)=>{try{return localStorage.getItem(key) ?? fallback;}catch{return fallback;}};
const save=(key: string,value: string | number)=>{try{localStorage.setItem(key,String(value));}catch{/* Private mode can block storage. */}};
const state: AppState={tab:'matrix',group:'all',initial:'all',rare:true,ipa:false,query:'',selected:'xuan',tone:1,thirdToneForm:'full',voice:getSetting('pinyin.voice',''),rate:Number(getSetting('pinyin.rate','0.85'))||.85,settings:false};
let examples: ExampleMap={};
let thirdToneExamples: ThirdToneExampleMap={};
let exampleState: 'loading' | 'ready' | 'error'='loading';
let speaker: Speaker | undefined;
const speakerIcon='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14"/></svg>';
function contour(t: Tone | ThirdToneForm,large=false){return `<svg viewBox="0 0 100 72" aria-hidden="true"><path d="M8 12H92M8 36H92M8 60H92" stroke="currentColor" stroke-opacity=".12" fill="none"/><polyline points="${t.points}" fill="none" stroke="currentColor" stroke-width="${large?3:4}" stroke-linecap="round" stroke-linejoin="round" ${t.id===5?'stroke-dasharray="4 6"':''}/></svg>`;}
function readHash(){const h=new URLSearchParams(location.hash.slice(1));const pinyin=h.get('s');if(pinyin&&syllableMap.has(pinyin))state.selected=pinyin;const t=Number(h.get('t'));if(isToneId(t))state.tone=t;const form=h.get('form');state.thirdToneForm=isThirdToneFormId(form)?form:'full';}
function updateHash(){history.replaceState(null,'',`#s=${encodeURIComponent(state.selected)}&t=${state.tone}${state.tone===3?'&form='+state.thirdToneForm:''}`);}
function toTone(value: string): ToneId | null { const tone=Number(value);return isToneId(tone)?tone:null; }
readHash();
function select(pinyin: string,{tone,form,scroll=false}: {tone?: ToneId | null; form?: ThirdToneFormId; scroll?: boolean}={}){
  if(!syllableMap.has(pinyin))return;
  speaker?.stop(false);if(pinyin!==state.selected||(tone&&tone!==state.tone))state.thirdToneForm='full';state.selected=pinyin;if(tone)state.tone=tone;if(form)state.thirdToneForm=form;
  updateHash();renderDetail();
  document.querySelectorAll<HTMLElement>('[data-syllable]').forEach(b=>{const selected=b.dataset.syllable===pinyin;b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;});
  ensureGridFocus();$('#announce').textContent=`${markTone(pinyin,state.tone)} を選択しました。`;
  if(scroll && matchMedia('(max-width:800px)').matches)$('#detail').scrollIntoView({behavior:'auto',block:'start'});
}
function groupButtons(){return `<div class="groups" aria-label="韻母グループ">${groups.map(([id,label])=>`<button data-group="${id}" aria-pressed="${state.group===id}">${label}</button>`).join('')}</div>`;}
function empty(){return '<div class="empty-state"><h3>該当する音が見つかりません</h3><p>綴りや絞り込み条件を確認してください。<br>ü は v / u:、声調は数字でも入力できます。</p><button class="primary" data-reset style="margin:18px auto 0">条件をリセット</button></div>';}
function renderReference(){
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>{if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(state.tab==='matrix') renderMatrix();
  if(state.tab==='finals') renderFinals();
  if(state.tab==='initials') renderInitials();
  if(state.tab==='rules') renderRules();
}
function renderOrderGuide(){return `<details class="table-order-guide"><summary>並び順・韻母の綴りについて</summary><p>声母は一般的なピンイン表の順で、発音する場所ごとに区切っています。歯茎付近の音は d・t・n・l と z・c・s の2か所に現れます。</p><p>韻母は初級教材でよく使う a・o・e・i・u・ü から始め、複合韻母、er、鼻韻母へ進む学習順です。教材によって配列や収録範囲は異なります。追加の韻母は各分類の後ろに補っています。</p><p>ui・iu・un は、この表では省略前の uei・iou・uen を見出しに使い、括弧内に短い綴りを添えています。jun などの un は ün の綴りです。er は複合韻母と分け、ê・io は末尾の補足欄に置いています。マトリクスでは i を1列にまとめ、韻母一覧では発音別に3枚のカードで示します。</p><a href="https://pressbooks.uiowa.edu/zheng/back-matter/pinyin-chart-finals/" target="_blank" rel="noreferrer">学習順の参考：アイオワ大学の韻母表 ↗</a></details>`;}
function renderMatrix(){
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
  $('#reference-body').innerHTML=`<div class="section-heading"><h2>声母 × 韻母</h2><span role="status">${matches.length} 音節を表示</span></div><p class="matrix-order">単韻母 → 複合韻母 → er → 鼻韻母 → 補足</p><div class="filters"><span class="filter-label">綴りの系統で絞り込む</span>${groupButtons()}</div><div class="filter-bottom"><label>声母 <select id="initial-filter" aria-label="声母で絞り込む"><option value="all">すべての声母</option>${initials.map(i=>`<option value="${i.id}" ${i.id===state.initial?'selected':''}>${i.id||'∅（声母なし）'}</option>`).join('')}</select></label><div><label><input id="show-ipa" type="checkbox" ${state.ipa?'checked':''}> IPAを併記</label><label><input id="show-rare" type="checkbox" ${state.rare?'checked':''}> 周辺的な音節</label></div></div>${matches.length?`<div class="matrix-scroll" tabindex="0" aria-label="音節表。左右にスクロールできます。音節ボタンでは矢印キーで移動できます。"><table class="matrix"><caption>普通話の有効音節。行は発音する場所で分類した声母、列は学習順の韻母。横棒は未収録の組み合わせ。</caption>${header}${body}</table></div><div class="table-hint"><div class="legend"><span>クリックで詳細</span><span>茶色：周辺的な音節</span></div><span>← 左右にスクロール / 矢印キーで音節を移動 →</span></div>`:empty()}<p class="tone-note">i 列の発音：yi・mi などは [i]、zi・ci・si は [ɹ̩]、zhi・chi・shi・ri は [ɻ̩]。見出しの / は発音の区別を示します。「i 系」は [i] 系、「特殊韻母」は舌先の i を含む分類です。</p>${renderOrderGuide()}`;
  ensureGridFocus();
}
function ensureGridFocus(){if(!document.querySelector('[data-syllable][tabindex="0"]'))document.querySelector('[data-syllable]')?.setAttribute('tabindex','0');}
function renderFinals(){
  const {text}=parseQuery(state.query);
  const list=orderedFinals.filter(f=>(state.group==='all'||f.group===state.group)&&(!text||f.id.includes(text)||f.ipa.includes(text)||syllables.some(s=>s.final===f.id&&s.pinyin.includes(text))));
  const sections=finalSections.map(section=>({...section,visible:list.filter(f=>section.finals.includes(f.id))})).filter(section=>section.visible.length);
  const cards=sections.map(section=>`<section class="final-section" data-final-section="${section.id}"><h3>${section.label}<small>${section.visible.length} 欄</small></h3><div class="card-grid">${section.visible.map(f=>{
    const s=required(syllables.find(s=>s.final===f.id&&!s.initial)||syllables.find(s=>s.final===f.id),`example for ${f.id}`);
    const forms=[...new Set(syllables.filter(s=>s.final===f.id).map(s=>s.initial?s.pinyin.slice(s.initial.length):s.pinyin))];
    return `<button class="sound-card" data-final="${f.id}" data-pick="${s.pinyin}"><div><span class="card-symbol">${esc(f.id)}</span><span class="ipa">[${f.ipa}]</span></div><div class="card-spelling">綴り：${forms.join(' / ')}</div><p class="note">${esc(f.note)}</p><span class="card-foot"><span>例：${s.pinyin}</span><span>詳細・音声 ↗</span></span></button>`;
  }).join('')}</div></section>`).join('');
  $('#reference-body').innerHTML=`<div class="section-heading"><h2>韻母の音と綴り</h2><span>${list.length} / ${finals.length} 欄</span></div><div class="filters"><span class="filter-label">綴りの系統で絞り込む</span>${groupButtons()}</div><p class="tone-note">マトリクスと同じ学習順を基本とし、i は発音別に分けて、舌先の2種類を補足欄に示します。カードを選ぶと、その韻母の例音節を表示します。韻母単体の録音ではありません。</p>${list.length?cards:empty()}${renderOrderGuide()}`;
}
function articulationBadges(id: InitialId){return `<span class="articulation-badges">${articulationTerms(id).map(term=>`<span>${esc(term.label)}</span>`).join('')}</span>`;}
function renderArticulationGuide(){
  const sections=[['発音する場所（調音位置）',places],['音の作り方（調音方法）',manners],['息の出方',aspirations],['声帯の振動',voicings]] as const;
  return `<details class="articulation-guide"><summary>用語ガイド（唇音・無気音など）</summary><p>声母は「どこで」「どう作るか」「息の出方」「声帯の振動」で整理できます。有気／無気と、有声／無声は別の特徴です。</p><div class="articulation-glossary">${sections.map(([title,terms])=>`<section><h3>${title}</h3><dl>${Object.values(terms).map(term=>`<dt>${term.label}</dt><dd>${term.note}</dd>`).join('')}</dl></section>`).join('')}</div><section class="aspiration-comparison"><h3>無気音・有気音を比べる</h3><p>同じ場所・作り方のペアです。どちらも無声音で、主な違いは開放後の息。口の前に手をかざして、同じ声調・速さで例音節を比べてみましょう。</p><div class="aspiration-pairs">${aspirationPairs.map(([a,b,sa,sb])=>`<div><button data-pick="${sa}"><strong>${a} [${getInitial(a).ipa}]</strong><small>無気音 · 例 ${sa}</small></button><button data-pick="${sb}"><strong>${b} [${getInitial(b).ipa}]</strong><small>有気音 · 例 ${sb}</small></button></div>`).join('')}</div><p>この表で有気／無気を対比するのは破裂音・破擦音です。摩擦音や鼻音などには、有気／無気のラベルを付けていません。</p></section><p class="articulation-source">分類は本アプリのIPA表記に対応します。r の分析など資料による違いがあります。<a href="https://courses.washington.edu/chin342/ipa/consonants.html" target="_blank" rel="noreferrer">ワシントン大学の子音表 ↗</a></p></details>`;
}
function renderInitialArticulation(id: InitialId){
  if(!id)return '';
  const initial=getInitial(id);
  return `<section class="initial-articulation" aria-label="声母の発音の特徴"><h3 class="mini-title">声母 ${id} の発音<span>調音の特徴</span></h3>${articulationBadges(id)}<p>${esc(initial.note)}</p><details><summary>用語の意味を見る</summary><dl>${articulationTerms(id).map(term=>`<dt>${term.label}</dt><dd>${term.note}</dd>`).join('')}</dl><p>有気／無気は息の出方、有声／無声は声帯の振動を表します。</p></details></section>`;
}
function renderInitials(){
  const {text}=parseQuery(state.query);
  const list=initials.filter(i=>i.id&&(!text||i.id.includes(text)||i.ipa.includes(text)||articulationSearchText(i.id).includes(text)));
  const samples: Partial<Record<InitialId,string>>={b:'ba',p:'pa',m:'ma',f:'fa',d:'da',t:'ta',n:'na',l:'la',g:'ga',k:'ka',h:'ha',j:'ji',q:'qi',x:'xi',zh:'zhi',ch:'chi',sh:'shi',r:'ri',z:'zi',c:'ci',s:'si'};
  $('#reference-body').innerHTML=`<div class="section-heading"><h2>21 の声母</h2><span>${list.length} / 21 声母</span></div><p class="tone-note">発音する場所・音の作り方・息・声帯の振動を表示します。「唇音」「無気音」「鼻音」などでも検索できます。音声は声母を含む例音節です。</p>${renderArticulationGuide()}${list.length?`<div class="card-grid">${list.map(i=>`<button class="sound-card" data-pick="${samples[i.id]}"><div><span class="card-symbol">${i.id}</span><span class="ipa">[${i.ipa}]</span></div>${articulationBadges(i.id)}<p class="note">${i.note}</p><span class="card-foot"><span>例：${samples[i.id]}</span><span>詳細・音声 ↗</span></span></button>`).join('')}</div>`:empty()}`;
}
function renderRules(){
  const rules: [string,string,[string,string,ToneId?][]][]=[
    ['ü の点は、いつ消える？','j / q / x の後は ü → u。声母がないときは y を前に置き、点を省略します。n / l の後は点を残します。綴りが u でも、舌の位置は ü [y] のままです。',[['ju','j + ü → ju'],['xuan','x + üan → xuan'],['nü','n + ü → nü'],['yuan','üan → yuan']]],
    ['長い韻母を短く書く','声母が前にあると iou → iu、uei → ui、uen → un。jun / qun / xun の un は ün なので、この uen の省略とは別です。',[['liu','l + iou → liu'],['gui','g + uei → gui'],['dun','d + uen → dun'],['jun','j + ün → jun']]],
    ['声母なしの y / w 規則','i 系は yi / ya / ye / yao / you / yan / yin / yang / ying / yong。u 系は wu / wa / wo / wai / wei / wan / wen / wang / weng。ü 系は yu / yue / yuan / yun と書きます。y と w は、この表では声母なしの綴りとして扱います。',[['yi','i → yi'],['you','iou → you'],['wen','uen → wen'],['yun','ün → yun']]],
    ['同じ文字でも、音が違う','ian・üan の a は [ɛ] 系。zi / ci / si と zhi / chi / shi / ri の i は、yi の [i] と区別します。er は独立音節の [ɚ] です。',[['xian','xian [ɕjɛn]'],['zi','zi [tsɹ̩]'],['zhi','zhi [ʈʂɻ̩]'],['er','er [ɚ]']]],
    ['声調記号はどこに付く？','a → e の順で優先し、ou では o、それ以外は最後の母音に付けます。iu は u（liù）、ui は i（guì）。軽声は記号なしで、数字式では 5 または 0。このアプリはどちらも検索できます。',[['liu','liù',4],['gui','guì',4],['nü','nǚ',3]]],
  ];
  $('#reference-body').innerHTML=`<div class="section-heading"><h2>綴りのルールをほどく</h2><span>例を選んで確認</span></div><div class="rules-list">${rules.map(([title,note,links],i)=>`<article class="rule-card"><h3><span class="rule-index">0${i+1}</span>${title}</h3><p>${note}</p><div class="rule-examples">${links.map(([s,label,tone])=>`<button data-pick="${s}"${tone?` data-pick-tone="${tone}"`:''}>${label}</button>`).join('')}</div></article>`).join('')}<article class="rule-card"><h3><span class="rule-index">06</span>4つの声調と軽声</h3><p>図は基本の調形です。第3声の発音形は次の欄で比較できます。数字は高さを低い1〜高い5で示します。</p><div class="tone-guide">${tones.map(t=>`<button data-demo-tone="${t.id}">${t.label}${contour(t,true)}<small>${t.value}</small></button>`).join('')}</div><p>「一」「不」にも変調があります。軽声の高さは直前の声調に依存します。例語TTSでは、表示した基本の調形と実際の発音が異なる場合があります。</p></article>${renderThirdToneGuide()}</div>`;
}
function exampleFor(){return state.tone===3
  ? thirdToneExample(state.selected,state.thirdToneForm,thirdToneExamples,examples)
  : examples[state.selected+state.tone];}
function renderThirdToneGuide(){return `<article class="rule-card third-tone-guide"><h3><span class="rule-index">07</span>第3声には、3つの発音形</h3><p>辞書の声調はどれも第3声。半三声・変調でも、ピンインの記号は ǎ のままです。</p><div class="third-guide-grid">${thirdToneForms.map(form=>`<button data-third-demo="${form.id}"><strong>${form.label}</strong>${contour(form,true)}<span>${form.value} [${form.ipa}]</span><small>${form.id==='full'?'好 hǎo':form.id==='half'?'好吃 hǎochī':'好友 hǎoyǒu'}</small></button>`).join('')}</div><p>上の例を選ぶと、対象の「好」のIPA・調形・例語音声を比較できます。数字は相対的な高さ（1＝低い、5＝高い）の代表値で、音声を測定した値ではありません。</p><ul class="third-context-notes"><li>全三声：丁寧な単独形など。自然な発話では、語末でも必ず上がるとは限りません。</li><li>半三声：後半を上げない低い形。第1・2・4声の前などに現れます。</li><li>3声＋3声：同じまとまりの前の第3声が上昇形に変わります。後ろの第3声の形は、さらに後続する音や区切りによります。</li><li>軽声の前は語ごとの性質も関係します。3声が3つ以上続く場合も意味や韻律の区切りが関わるため、自動判定していません。</li></ul><p>図とIPAは学習用の目安。TTSに調形を指定することはできず、実際の音声との一致は保証できません。<a href="https://web.mit.edu/~jinzhang/www/pinyin/tones/" target="_blank" rel="noreferrer">声調の参考資料（MIT） ↗</a></p></article>`;}
function renderThirdToneSelector(){const form=getThirdToneForm(state.thirdToneForm);return `<section class="third-tone-panel" aria-labelledby="third-tone-title"><h3 class="mini-title" id="third-tone-title">第3声の発音形<span>辞書の記号は変えません</span></h3><div class="third-tone-options" role="group" aria-label="第3声の発音形">${thirdToneForms.map(item=>`<button data-third-tone-form="${item.id}" aria-pressed="${item.id===form.id}" aria-label="${item.label} ${item.value}"><strong>${item.label}</strong>${contour(item)}<small>${item.value}</small></button>`).join('')}</div><p class="tone-note">${form.note}</p></section>`;}

function renderVoiceHelp(){return `<details id="voice-help" class="voice-help"><summary>音声が出ないとき</summary><p>このアプリは端末の読み上げ音声を使います。音声一覧に表示されなくても、中国語を指定して再生を試せます。無音や別の言語になる場合は、音声データを確認してください。</p><strong>Android・Chrome</strong><ol><li>端末の「設定」で「テキスト読み上げ」を検索します。</li><li>使用中の読み上げエンジンの設定で「音声データをインストール」を開き、「中国語（中国本土）」または「普通話」を追加します。</li><li>Chromeを開き直し、このページを再読み込みしてから再生します。</li></ol><p>項目名は機種・読み上げエンジンにより異なります。<a href="https://support.google.com/accessibility/android/answer/6006983?hl=ja" target="_blank" rel="noreferrer">Googleの設定手順 ↗</a></p><p>ほかの端末でも中国語の読み上げ音声を確認してください。メディア音量・Bluetoothの出力先・通信接続もご確認ください。</p></details>`;}

function renderDetail(){
  const s=getSyllable(state.selected),t=getTone(state.tone),f=getFinal(s.final),i=getInitial(s.initial),example=exampleFor();
  const third=state.tone===3?getThirdToneForm(state.thirdToneForm):undefined;
  const pronunciation=third??t;
  const ipaCaption=third?`${third.label}の目安 · ${third.value}`:state.tone===5?'分節音の目安（軽声の高さは文脈依存）':'単独声調の目安';
  let exampleHtml='';
  if(example){
    const chars=[...example.text];
    const context=third?.id==='full'?'丁寧に単独で読む場合。TTSでは上昇が弱いこともあります。'
      :third?.id==='half'?`第3声 → 第${parseQuery(example.tokens[1]??'').tone}声。同じまとまりで続けて読む場合。`
      :'第3声 → 第3声。同じまとまりで読むと、前の音節が上昇形になります。';
    exampleHtml=`<div class="example"><small>${chars.length>1?'例語全体を再生・下線が対象音節':'例字を再生'}</small><div class="example-word" lang="zh-CN">${chars.map((c,n)=>n===example.target?`<mark>${c}</mark>`:c).join('')}</div><small>辞書の読み</small><div class="example-pinyin">${example.tokens.map((p,n)=>{const {text,tone}=parseQuery(p);const py=esc(markTone(text,tone));return n===example.target?`<mark>${py}</mark>`:py;}).join(' ')}</div>${third?`<div class="example-realization"><small>対象音の発音の目安</small><strong>${third.label} · ${third.value} <span>[${s.ipa}${third.ipa}]</span></strong><p>${context}</p></div>`:''}</div>`;
  } else {
    const missing=state.tone===3?'この音節・発音形の比較用例語は未収録です。図とIPAは練習用の目安です。':'この音節・声調の例語は未収録です。声調の綴りは練習用の表示です。';
    exampleHtml=`<div class="example"><small>${exampleState==='loading'?'例語を読み込み中…':exampleState==='error'?'例語データを読み込めませんでした。':missing}</small>${exampleState==='error'?'<button id="retry-examples" class="text-button">再試行</button>':exampleState==='ready'&&third?`<button class="example-demo" data-third-demo="${third.id}">hǎo の比較例を開く ↗</button>`:''}</div>`;
  }
  $('#detail').innerHTML=`<div class="detail-top"><p class="eyebrow">SYLLABLE / 音節の詳細</p><span class="detail-number">${s.peripheral?'周辺的な音節':t.name}</span><p class="reading-caption">辞書の読み · ${t.label}</p><h2>${markTone(s.pinyin,state.tone)}</h2><div class="detail-ipa">[${s.ipa}${pronunciation.ipa}]</div><p class="ipa-caption">${ipaCaption}</p></div>
  <div class="detail-content"><div class="decomposition"><div><small>声母</small><strong>${s.initial||'∅'}</strong><span class="ipa">${i.ipa?'['+i.ipa+']':'声母なし'}</span></div><span>＋</span><div><small>分析上の韻母</small><strong>${esc(matrixFinalId(s.final))}</strong>${finalContext(s.final)?`<small>${finalContext(s.final)}</small>`:''}<span class="ipa">[${s.rimeIpa}]</span></div></div>${renderInitialArticulation(s.initial)}${rulesFor(s).map(r=>`<p class="rule-note">${r}</p>`).join('')}<p class="tone-note">${esc(f.note)}${state.tone===5?' 軽声のIPAは分節音の目安のみ。母音の弱化を含む細かな変化は省略。':''}</p>
  <hr class="detail-separator"><h3 class="mini-title">辞書上の声調<span>1〜4声・軽声</span></h3><div class="tones" aria-label="声調">${tones.map(t=>`<button class="tone" data-tone="${t.id}" aria-pressed="${state.tone===t.id}" aria-label="${t.label} ${markTone(s.pinyin,t.id)}">${t.id===5?'軽声':t.id+'声'}${contour(t)}<small>${markTone(s.pinyin,t.id)}</small></button>`).join('')}</div>
  ${third?renderThirdToneSelector():`<p class="tone-note">${t.id===5?'':t.value+'：'}${t.note}</p>`}${exampleHtml}
  ${third?'<p class="tone-note context-caution">図・IPAは選んだ発音形の目安で、再生音声の測定値ではありません。軽声の前や長い第3声の連続は自動判定していません。</p>':''}
  <div class="play-row"><button id="play" class="primary" disabled>${speakerIcon}<span>${example&&example.text.length>1?'例語を聞く':'発音を聞く'}</span></button><button id="stop" class="stop" aria-label="再生を停止">■</button></div><p id="voice-status" class="voice-status" role="status" aria-live="polite"></p><details class="voice-settings" ${state.settings?'open':''}><summary>音声・速度を調整</summary><label>中国語の音声<select id="voice" aria-label="中国語の音声"></select></label><label>読み上げ速度 <span class="speed-control"><input id="rate" type="range" min="0.6" max="1.2" step="0.05" value="${state.rate}" aria-label="読み上げ速度"><output id="rate-value">${state.rate.toFixed(2)}×</output></span></label><button id="refresh-voices" class="text-button">音声を再読み込み</button></details>${renderVoiceHelp()}<p class="audio-footnote">端末の中国語TTSを使用。${third?'全三声・半三声・変調を直接指定できないため、図どおりの発音は保証できません。':'辞書の読みと異なる場合があります。'}ネイティブ録音・IPA指定合成ではありません。</p></div>`;
  updateVoices();
}
function updateVoices(){
  if(!speaker || !document.querySelector('#voice'))return;
  const voices=speaker.voices;
  // Keep the requested voice while the browser loads the rest of its voice list.
  const selectedVoice=voices.find(v=>v.voiceURI===state.voice)??voices[0];
  $<HTMLSelectElement>('#voice').innerHTML=voices.length?voices.map(v=>`<option value="${esc(v.voiceURI)}" ${v===selectedVoice?'selected':''}>${esc(v.name)} (${esc(v.lang)})${v.localService?'':' · オンライン'}</option>`).join(''):'<option value="">自動選択（中国語・中国本土）</option>';
  $<HTMLSelectElement>('#voice').disabled=!speaker.supported;
  $<HTMLButtonElement>('#play').disabled=!speaker.supported||!exampleFor();
  const msg=!speaker.supported?'このブラウザは音声合成に対応していません。':!exampleFor()?(state.tone===3?'この発音形の比較用例語は未収録です。':'例語のある声調を選ぶと再生できます。'):!voices.length?'音声一覧に普通話が表示されていません。再生ボタンで中国語の再生を試せます。音が出ない場合は下の設定手順をご確認ください。':`中国語TTS · ${selectedVoice?.lang || 'zh'}`;
  $('#voice-status').textContent=speaker.message??msg;
}
speaker=new Speaker({onVoices:()=>{if(speaker)updateVoices();},onStatus:(message,kind)=>{const status=document.querySelector('#voice-status');if(status)status.textContent=message;if(kind==='error'){const help=document.querySelector<HTMLDetailsElement>('#voice-help');if(help)help.open=true;}}});
async function loadExamples(){exampleState='loading';renderDetail();try{const r=await fetch('examples.json');if(!r.ok)throw new Error(String(r.status));const data=parseExampleCatalog(await r.json());examples=data.examples;thirdToneExamples=data.thirdToneExamples;exampleState='ready';}catch{exampleState='error';}renderDetail();}
function reset(){state.query='';state.group='all';state.initial='all';state.rare=true;$<HTMLInputElement>('#search').value='';renderReference();}

document.addEventListener('click',event=>{
  if(!(event.target instanceof Element))return;
  const b=event.target.closest('button');if(!b)return;
  if(isTabId(b.dataset.tab)){state.tab=b.dataset.tab;renderReference();}
  if(isGroupFilter(b.dataset.group)){state.group=b.dataset.group;renderReference();document.querySelector<HTMLElement>(`[data-group="${state.group}"]`)?.focus();}
  if(b.dataset.syllable)select(b.dataset.syllable);
  if(b.dataset.pick)select(b.dataset.pick,{tone:b.dataset.pickTone?toTone(b.dataset.pickTone):undefined,scroll:true});
  if(b.dataset.tone){select(state.selected,{tone:toTone(b.dataset.tone)});document.querySelector<HTMLElement>(`[data-tone="${state.tone}"]`)?.focus();}
  if(b.dataset.demoTone)select('ma',{tone:toTone(b.dataset.demoTone),scroll:true});
  if(isThirdToneFormId(b.dataset.thirdToneForm)){select(state.selected,{tone:3,form:b.dataset.thirdToneForm});document.querySelector<HTMLElement>(`[data-third-tone-form="${state.thirdToneForm}"]`)?.focus();}
  if(isThirdToneFormId(b.dataset.thirdDemo))select('hao',{tone:3,form:b.dataset.thirdDemo,scroll:true});
  if(b.id==='reset'||b.hasAttribute('data-reset'))reset();
  const example=exampleFor();if(b.id==='play'&&example)speaker?.speak(example.text,state.voice,state.rate);
  if(b.id==='stop')speaker?.stop();
  if(b.id==='refresh-voices'){speaker?.stop(false);speaker?.refresh();}
  if(b.id==='retry-examples')loadExamples();
  if(b.id==='about')$<HTMLDialogElement>('#about-dialog').showModal();
  if(b.matches('.dialog-close,.dialog-done'))$<HTMLDialogElement>('#about-dialog').close();
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement))return;
  if(el.id==='initial-filter'&&(el.value==='all'||isInitialId(el.value))){state.initial=el.value;renderReference();$<HTMLSelectElement>('#initial-filter').focus();}
  if(el instanceof HTMLInputElement&&el.id==='show-ipa'){state.ipa=el.checked;renderReference();$('#show-ipa').focus();}
  if(el instanceof HTMLInputElement&&el.id==='show-rare'){state.rare=el.checked;renderReference();$('#show-rare').focus();}
  if(el.id==='voice'){speaker?.stop(false);state.voice=el.value;save('pinyin.voice',state.voice);updateVoices();}
});
document.addEventListener('toggle',event=>{if(event.target instanceof HTMLDetailsElement&&event.target.matches('.voice-settings'))state.settings=event.target.open;},true);
$<HTMLInputElement>('#search').addEventListener('input',()=>{state.query=$<HTMLInputElement>('#search').value;const q=parseQuery(state.query);if(syllableMap.has(q.text))select(q.text,{tone:q.tone});renderReference();});
document.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement&&event.target.id==='rate'){state.rate=Number(event.target.value);save('pinyin.rate',state.rate);$('#rate-value').textContent=state.rate.toFixed(2)+'×';}});
document.addEventListener('keydown',event=>{
  if(!(event.target instanceof Element))return;
  if(event.key==='/'&&!event.target.matches('input,textarea,select')&&!$<HTMLDialogElement>('#about-dialog').open){event.preventDefault();$<HTMLInputElement>('#search').focus();}
  if(event.key==='Escape'){speaker?.stop();if(event.target.id==='search')reset();}
  if(event.key==='Enter'&&event.target.id==='search'){const match=findSyllables(state.query,state)[0];if(match)select(match.pinyin,{tone:parseQuery(state.query).tone,scroll:true});}
  const b=event.target.closest<HTMLElement>('[data-syllable]');if(!b||!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  event.preventDefault();const row=Number(b.dataset.row),col=Number(b.dataset.col);const cells=[...document.querySelectorAll<HTMLElement>('[data-syllable]')];let candidates: HTMLElement[]=[];
  if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key))candidates=cells.filter(c=>Number(c.dataset.row)===row&&(event.key==='ArrowRight'?Number(c.dataset.col)>col:event.key==='ArrowLeft'?Number(c.dataset.col)<col:true));
  else candidates=cells.filter(c=>Number(c.dataset.col)===col&&(event.key==='ArrowDown'?Number(c.dataset.row)>row:Number(c.dataset.row)<row));
  const target=['ArrowLeft','ArrowUp','End'].includes(event.key)?candidates.at(-1):candidates[0];
  if(target){cells.forEach(c=>c.tabIndex=-1);target.tabIndex=0;target.focus();}
});
window.addEventListener('hashchange',()=>{readHash();select(state.selected);});
window.addEventListener('pagehide',()=>speaker?.stop(false));
window.addEventListener('pageshow',()=>speaker?.refresh());
window.addEventListener('focus',()=>speaker?.refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)speaker?.refresh();});

$('#total-count').textContent=String(syllables.length);
$('#about-content').innerHTML=`<h3>収録範囲</h3><p>普通話の21声母、声母なしの行、${finals.length}の韻母分類、${syllables.length}の基本音節を収録。マトリクスは i の3種類を1列にまとめた${matrixFinals.length}列です。韻母一覧では3種類を別カードにしています。分類数は ê / io なども加えた、このアプリ独自の数え方です。茶色は感動詞・口語の異読など周辺的な音節で、除外して表示できます。</p><p>児化の全組み合わせ、方言専用の綴り、音節主音の m / n / ng / hm / hng はマトリクスの対象外です。空欄はこの収録範囲で組み合わせがないことを示します。有効な音節にも、すべての声調の語があるとは限りません。</p><h3>IPA と音声</h3><p>IPA は広い音声表記を統一して採用しています。例：eng [əŋ]、ie [jɛ]、üe [ɥɛ]、r [ɻ]、舌尖の i [ɹ̩ / ɻ̩]。分析・話者による別表記も注記しています。表は無声調、詳細は基本の声調を付記。第3声は全三声・半三声・3声＋3声の変調を切り替え、辞書上の声調と発音の目安を分けて示します。第3声の比較用例語は21音節・62例を選び、軽声の前や長い第3声連続の調形は自動判定しません。図・IPAは再生音声の測定値ではありません。軽声では固定の調値を付けません。</p><p>ブラウザTTSは漢字・例語を読み上げます。声調をAPIで強制することはできず、多音字・軽声・変調が表示通りにならない場合があります。音声の種類・利用可否は端末とブラウザに依存し、オンライン音声は通信が必要です。音声一覧に普通話が表示されない場合も、中国語（中国本土）を指定して再生を試せます。端末に音声がなければ追加が必要です。「音声が出ないとき」に設定手順を載せています。</p><h3>出典・ライセンス</h3><ul><li><a href="https://courses.washington.edu/chin342/ipa/consonants.html" target="_blank" rel="noreferrer">ワシントン大学：IPA Consonants</a> — 声母の調音位置・調音方法・有気／無気の照合。用語説明は本アプリ用に作成。</li><li><a href="https://www.moe.gov.cn/jyb_sjzl/ziliao/A19/195802/t19580201_186000.html" target="_blank" rel="noreferrer">中国教育部：汉语拼音方案</a> — 表記規則。</li><li><a href="https://en.wikipedia.org/wiki/Pinyin" target="_blank" rel="noreferrer">Pinyin</a> / <a href="https://en.wikipedia.org/wiki/Standard_Chinese_phonology" target="_blank" rel="noreferrer">Standard Chinese phonology</a> / <a href="https://en.wikipedia.org/wiki/Pinyin_table" target="_blank" rel="noreferrer">Pinyin table</a> — IPAと音節の照合。説明文は本アプリ用に作成。</li><li><a href="https://web.mit.edu/~jinzhang/www/pinyin/tones/" target="_blank" rel="noreferrer">MIT：Mandarin Tones</a> — 全三声・半三声・第3声連続の解説。</li><li><a href="https://www.mdbg.net/chinese/dictionary?page=cedict" target="_blank" rel="noreferrer">CC-CEDICT / MDBG</a> — 漢字・例語と辞書上のピンイン。簡体字の例語を抽出・選別し、定義は省略。派生例語データは <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>。取得：2026-10-07。</li><li><a href="https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis" target="_blank" rel="noreferrer">MDN：SpeechSynthesis</a> — 音声API。</li></ul>`;
renderReference();renderDetail();loadExamples();
