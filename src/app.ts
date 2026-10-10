import {renderCompare} from './views/compare.js';
import {renderVowels} from './views/vowels.js';
import {comparisonPresets,comparisonExample} from './comparison.js';
import {renderAbout} from './views/about.js';
import {createState,save} from './state.js';
import {esc} from './views/shared.js';
import {renderMatrix} from './views/matrix.js';
import {renderFinals} from './views/finals.js';
import {renderInitials} from './views/initials.js';
import {renderRules} from './views/rules.js';
import {renderDetail as detailView} from './views/detail.js';
import {syllables,syllableMap,markTone,parseQuery,findSyllables,isInitialId,isGroupFilter} from './data.js';
import {Speaker} from './speech.js';
import {parseExampleCatalog} from './examples.js';
import {isThirdToneFormId,thirdToneExample} from './third-tone.js';
import {isToneId,isTabId,required} from './types.js';
import type {ExampleState,ExampleMap,ToneId,ThirdToneFormId,ThirdToneExampleMap} from './types.js';

function $<T extends HTMLElement = HTMLElement>(selector: string): T { return required(document.querySelector<T>(selector), selector); }
const state = createState();
let examples: ExampleMap={};
let thirdToneExamples: ThirdToneExampleMap={};
let exampleState: ExampleState='loading';
let speaker: Speaker | undefined;
function readHash(){const h=new URLSearchParams(location.hash.slice(1));const pinyin=h.get('s');if(pinyin&&syllableMap.has(pinyin))state.selected=pinyin;const t=Number(h.get('t'));if(isToneId(t))state.tone=t;const form=h.get('form');state.thirdToneForm=isThirdToneFormId(form)?form:'full';state.thirdToneExpanded=state.tone===3&&state.thirdToneForm!=='full';}
function updateHash(){history.replaceState(null,'',`#s=${encodeURIComponent(state.selected)}&t=${state.tone}${state.tone===3?'&form='+state.thirdToneForm:''}`);}
function toTone(value: string): ToneId | null { const tone=Number(value);return isToneId(tone)?tone:null; }
readHash();
function select(pinyin: string,{tone,form,scroll=false}: {tone?: ToneId | null; form?: ThirdToneFormId; scroll?: boolean}={}){
  if(!syllableMap.has(pinyin))return;
  speaker?.stop(false);if(pinyin!==state.selected||(tone&&tone!==state.tone))state.thirdToneForm='full';state.selected=pinyin;if(tone)state.tone=tone;if(form){state.thirdToneForm=form;state.thirdToneExpanded=true;}
  updateHash();renderDetail();
  document.querySelectorAll<HTMLElement>('[data-syllable]').forEach(b=>{const selected=b.dataset.syllable===pinyin;b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;});
  ensureGridFocus();$('#announce').textContent=`${markTone(pinyin,state.tone)} を選択しました。`;
  if(scroll && matchMedia('(max-width:800px)').matches)$('#detail').scrollIntoView({behavior:'auto',block:'start'});
}
function renderReference(){
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>{if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(state.tab==='matrix') { $('#reference-body').innerHTML=renderMatrix(state); ensureGridFocus(); }
  if(state.tab==='finals') $('#reference-body').innerHTML=renderFinals(state);
  if(state.tab==='initials') $('#reference-body').innerHTML=renderInitials(state);
  if(state.tab==='rules') $('#reference-body').innerHTML=renderRules();
  if(state.tab==='compare') $('#reference-body').innerHTML=renderCompare(state,examples,exampleState,!!speaker?.supported,speaker?.message??null);
  if(state.tab==='vowels') $('#reference-body').innerHTML=renderVowels(state);
  const searchable=['matrix','finals','initials'].includes(state.tab);
  $<HTMLInputElement>('#search').disabled=!searchable;
  $<HTMLSelectElement>('#search-mode').disabled=!searchable;
  updateComparisonAudio();
}
function updateSearchMode(){
  const input=$<HTMLInputElement>('#search');
  input.placeholder=state.searchMode==='ipa'?'IPAで検索… 例：pa / ɕ / ɥɛn':'ピンイン・用語で検索… 例：xuan / nǚ / ma3 / 唇音';
  input.setAttribute('aria-label',state.searchMode==='ipa'?'IPAを検索':'ピンイン・韻母・発音用語を検索');
}
function updateComparisonAudio(){
  if(state.tab!=='compare')return;
  const available=(pinyin: string)=>exampleState==='ready'&&!!comparisonExample(pinyin,state.compareTone,examples);
  document.querySelectorAll<HTMLButtonElement>('[data-compare-play]').forEach(button=>{
    const side=button.dataset.comparePlay;
    button.disabled=!speaker?.supported||(side==='A'?!available(state.compareA):side==='B'?!available(state.compareB):!available(state.compareA)||!available(state.compareB));
  });
  const status=document.querySelector('#compare-status');
  if(status)status.textContent=speaker?.message??(!speaker?.supported?'このブラウザは音声合成に対応していません。':'再生する音声・速度は、音節詳細の設定と共通です。');
}
function playComparison(side: string){
  if(exampleState!=='ready'||!['A','B','alternate'].includes(side))return;
  const sides=side==='alternate'?['A','B','A','B']:[side];
  const items=sides.map(label=>{const pinyin=label==='A'?state.compareA:state.compareB;const example=comparisonExample(pinyin,state.compareTone,examples);return example?{text:example.text,label:`${label} · ${markTone(pinyin,state.compareTone)}`}:undefined;});
  if(items.every((item): item is {text: string;label: string}=>!!item))speaker?.speakSequence(items,state.voice,state.rate);
}
function ensureGridFocus(){if(!document.querySelector('[data-syllable][tabindex="0"]'))document.querySelector('[data-syllable]')?.setAttribute('tabindex','0');}
function exampleFor(){return state.tone===3
  ? thirdToneExample(state.selected,state.thirdToneForm,thirdToneExamples,examples)
  : examples[state.selected+state.tone];}


function renderDetail(){ $('#detail').innerHTML=detailView(state,exampleFor(),exampleState); updateVoices(); }
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
  updateComparisonAudio();
}
speaker=new Speaker({onVoices:()=>{if(speaker)updateVoices();},onStatus:(message,kind)=>{for(const id of ['#voice-status','#compare-status']){const status=document.querySelector(id);if(status)status.textContent=message;}if(kind==='error'){const help=document.querySelector<HTMLDetailsElement>('#voice-help');if(help)help.open=true;}}});
async function loadExamples(){exampleState='loading';renderDetail();try{const r=await fetch('examples.json');if(!r.ok)throw new Error(String(r.status));const data=parseExampleCatalog(await r.json());examples=data.examples;thirdToneExamples=data.thirdToneExamples;exampleState='ready';}catch{exampleState='error';}renderDetail();if(state.tab==='compare')renderReference();}
function reset(){state.query='';state.group='all';state.initial='all';state.rare=true;$<HTMLInputElement>('#search').value='';renderReference();}

document.addEventListener('click',event=>{
  if(!(event.target instanceof Element))return;
  const b=event.target.closest('button');if(!b)return;
  if(isTabId(b.dataset.tab)){speaker?.stop(false);state.tab=b.dataset.tab;renderReference();updateVoices();}
  if(isGroupFilter(b.dataset.group)){state.group=b.dataset.group;renderReference();document.querySelector<HTMLElement>(`[data-group="${state.group}"]`)?.focus();}
  if(b.dataset.syllable)select(b.dataset.syllable);
  if(b.dataset.comparePreset){const preset=comparisonPresets.find(p=>p.id===b.dataset.comparePreset);if(preset){speaker?.stop(false);state.compareA=preset.a;state.compareB=preset.b;state.compareTone=preset.tone;renderReference();updateVoices();document.querySelector<HTMLElement>(`[data-compare-preset="${preset.id}"]`)?.focus();}}
  if(b.dataset.comparePlay)playComparison(b.dataset.comparePlay);
  if(b.id==='compare-stop')speaker?.stop();
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
  if(el instanceof HTMLInputElement&&el.id==='show-ipa'){state.ipa=el.checked;save('pinyin.ipa',state.ipa);renderReference();$('#show-ipa').focus();}
  if(el instanceof HTMLInputElement&&el.id==='show-rare'){state.rare=el.checked;renderReference();$('#show-rare').focus();}
  if(el.id==='search-mode'&&(el.value==='pinyin'||el.value==='ipa')){state.searchMode=el.value;updateSearchMode();renderReference();}
  if(el.id==='compare-a'||el.id==='compare-b'){if(syllableMap.has(el.value)){speaker?.stop(false);if(el.id==='compare-a')state.compareA=el.value;else state.compareB=el.value;renderReference();updateVoices();$('#'+el.id).focus();}}
  if(el.id==='compare-tone'){const tone=toTone(el.value);if(tone&&tone!==5){speaker?.stop(false);state.compareTone=tone;renderReference();updateVoices();$('#compare-tone').focus();}}
  if(el instanceof HTMLInputElement&&el.id==='japanese-vowels'){state.japaneseVowels=el.checked;renderReference();$('#japanese-vowels').focus();}
  if(el.id==='voice'){speaker?.stop(false);state.voice=el.value;save('pinyin.voice',state.voice);updateVoices();}
});
document.addEventListener('toggle',event=>{if(!(event.target instanceof HTMLDetailsElement)||!event.target.isConnected)return;if(event.target.matches('.voice-settings'))state.settings=event.target.open;if(event.target.matches('.third-tone-panel'))state.thirdToneExpanded=event.target.open;},true);
$<HTMLInputElement>('#search').addEventListener('input',()=>{state.query=$<HTMLInputElement>('#search').value;const q=parseQuery(state.query);if(state.searchMode==='pinyin'&&syllableMap.has(q.text))select(q.text,{tone:q.tone});renderReference();});
document.addEventListener('input',event=>{if(event.target instanceof HTMLInputElement&&event.target.id==='rate'){speaker?.stop(false);state.rate=Number(event.target.value);updateVoices();save('pinyin.rate',state.rate);$('#rate-value').textContent=state.rate.toFixed(2)+'×';}});
document.addEventListener('keydown',event=>{
  if(!(event.target instanceof Element))return;
  if(event.key==='/'&&!event.target.matches('input,textarea,select')&&!$<HTMLDialogElement>('#about-dialog').open){event.preventDefault();if($<HTMLInputElement>('#search').disabled){speaker?.stop(false);state.tab='matrix';renderReference();updateVoices();}$<HTMLInputElement>('#search').focus();}
  if(event.key==='Escape'){speaker?.stop();if(event.target.id==='search')reset();}
  if(event.key==='Enter'&&event.target.id==='search'){const match=findSyllables(state.query,state)[0];if(match)select(match.pinyin,{tone:state.searchMode==='pinyin'?parseQuery(state.query).tone:undefined,scroll:true});}
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
$('#about-content').innerHTML=renderAbout();
renderReference();renderDetail();loadExamples();
