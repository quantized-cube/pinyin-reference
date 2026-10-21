import {renderCompare} from './views/compare.js';
import {renderVowels} from './views/vowels.js';
import {comparisonAudioHint,comparisonPresets,comparisonSequence,getComparisonPreset} from './comparison.js';
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
import {parseExampleCatalog,detailExample} from './examples.js';
import {detailRecording} from './detail-recordings.js';
import {isThirdToneFormId} from './third-tone.js';
import {neutralToneExamples} from './neutral-tone.js';
import {isToneId,isTabId,required} from './types.js';
import type {ExampleCatalog,ToneId,ThirdToneFormId} from './types.js';

function $<T extends HTMLElement = HTMLElement>(selector: string): T { return required(document.querySelector<T>(selector), selector); }
const state = createState();
let exampleLoad: {status: 'loading' | 'error'} | {status: 'ready'; catalog: ExampleCatalog} = {status: 'loading'};
let exampleRequestPending = false;
function loadedExamples(){return exampleLoad.status==='ready'?exampleLoad.catalog:undefined;}
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
  if(state.tab==='compare') $('#reference-body').innerHTML=renderCompare(state,loadedExamples()?.isolatedExamples??{},exampleLoad.status,!!speaker?.recordingsSupported,speaker?.messageFor('comparison')??null);
  if(state.tab==='vowels') $('#reference-body').innerHTML=renderVowels(state);
  const searchable=['matrix','finals','initials'].includes(state.tab);
  $<HTMLInputElement>('#search').disabled=!searchable;
  $<HTMLSelectElement>('#search-mode').disabled=!searchable;
  updateComparisonAudio();
  updateNeutralToneAudio();
}
function updateSearchMode(){
  const input=$<HTMLInputElement>('#search');
  input.placeholder=state.searchMode==='ipa'?'IPAで検索… 例：pa / ɕ / ɥɛn':'ピンイン・用語で検索… 例：xuan / nǚ / ma3 / 唇音';
  input.setAttribute('aria-label',state.searchMode==='ipa'?'IPAを検索':'ピンイン・韻母・発音用語を検索');
}
function updateComparisonAudio(){
  if(state.tab!=='compare')return;
  const preset=getComparisonPreset(state.comparePreset);
  document.querySelectorAll<HTMLButtonElement>('[data-compare-play]').forEach(button=>{
    button.disabled=!speaker?.recordingsSupported||!comparisonSequence(preset.syllables,preset.tone,button.dataset.comparePlay??'');
  });
  const status=document.querySelector('#compare-status');
  if(status)status.textContent=speaker?.messageFor('comparison')??comparisonAudioHint(!!speaker?.recordingsSupported);
}
function playComparison(side: string){
  const preset=getComparisonPreset(state.comparePreset);
  const items=comparisonSequence(preset.syllables,preset.tone,side);
  if(items)speaker?.playRecordingSequence(items,'comparison');
}
function updateNeutralToneAudio(){
  if(state.tab!=='rules')return;
  document.querySelectorAll<HTMLButtonElement>('[data-neutral-tone-play],#neutral-tone-stop').forEach(button=>{
    button.disabled=!speaker?.recordingsSupported;
  });
  const status=document.querySelector('#neutral-tone-status');
  if(status)status.textContent=speaker?.messageFor('recording')??(!speaker?.recordingsSupported?'このブラウザは録音の再生に対応していません。':'話者の録音を元の速度で再生します。');
}
function ensureGridFocus(){if(!document.querySelector('[data-syllable][tabindex="0"]'))document.querySelector('[data-syllable]')?.setAttribute('tabindex','0');}
function exampleFor(){return detailExample(state.selected,state.tone,state.thirdToneForm,loadedExamples());}
function recordingFor(){return detailRecording(state.selected,state.tone,state.thirdToneForm);}


function renderDetail(){ $('#detail').innerHTML=detailView(state,exampleFor(),exampleLoad.status,!!recordingFor()); updateVoices(); }
function updateVoices(){
  if(!speaker)return;
  const voice=document.querySelector<HTMLSelectElement>('#voice');
  if(voice){
    const voices=speaker.voices;
    // Keep the requested voice while the browser loads the rest of its voice list.
    const selectedVoice=voices.find(v=>v.voiceURI===state.voice)??voices[0];
    voice.innerHTML=voices.length?voices.map(v=>`<option value="${esc(v.voiceURI)}" ${v===selectedVoice?'selected':''}>${esc(v.name)} (${esc(v.lang)})${v.localService?'':' · オンライン'}</option>`).join(''):'<option value="">自動選択（中国語・中国本土）</option>';
    voice.disabled=!speaker.supported;
  }
  $<HTMLButtonElement>('#play').disabled=!(recordingFor()?speaker.recordingsSupported:speaker.supported)||!exampleFor();
  updateAudioStatuses();
}
function updateAudioStatuses(){
  if(!speaker)return;
  const voices=speaker.voices;
  const selectedVoice=voices.find(v=>v.voiceURI===state.voice)??voices[0];
  const recorded=!!recordingFor();
  const unavailable=recorded?(!speaker.recordingsSupported?'このブラウザは録音の再生に対応していません。':null):(!speaker.supported?'このブラウザは音声合成に対応していません。':null);
  const msg=unavailable??(exampleLoad.status==='loading'?'例字・例語を読み込み中…':exampleLoad.status==='error'?'例字・例語データを読み込めませんでした。':!exampleFor()?(state.tone===3&&state.thirdToneForm==='full'?'この声調の単独例字は未収録です。':state.tone===3?'この発音形の例語は未収録です。':'例字・例語のある声調を選ぶと再生できます。'):recorded?'話者の録音を元の速度で再生します。':!voices.length?'音声一覧に普通話が表示されていません。再生ボタンで中国語の再生を試せます。音が出ない場合は下の設定手順をご確認ください。':`中国語TTS · ${selectedVoice?.lang || 'zh'}`);
  const status=document.querySelector('#voice-status');
  if(status)status.textContent=speaker.messageFor(recorded?'detail-recording':'speech')??msg;
  updateComparisonAudio();
  updateNeutralToneAudio();
}
speaker=new Speaker({onVoices:()=>{if(speaker)updateVoices();},onStatus:(_message,kind,source)=>{updateAudioStatuses();if(kind==='error'&&source==='speech'){const help=document.querySelector<HTMLDetailsElement>('#voice-help');if(help)help.open=true;}}});
function renderExampleViews(){
  renderDetail();
  if(state.tab==='compare')renderReference();
}
async function loadExamples(){
  if(exampleRequestPending)return;
  exampleRequestPending=true;
  exampleLoad={status:'loading'};
  renderExampleViews();
  try{
    const response=await fetch('examples.json?v=2');
    if(!response.ok)throw new Error(String(response.status));
    const catalog=parseExampleCatalog(await response.json());
    exampleLoad={status:'ready',catalog};
  }catch{
    exampleLoad={status:'error'};
  }finally{
    exampleRequestPending=false;
    renderExampleViews();
  }
}
function reset(){state.query='';state.group='all';state.initial='all';state.rare=true;$<HTMLInputElement>('#search').value='';renderReference();}

document.addEventListener('click',event=>{
  if(!(event.target instanceof Element))return;
  const b=event.target.closest('button');if(!b)return;
  if(isTabId(b.dataset.tab)){speaker?.stop(false);state.tab=b.dataset.tab;renderReference();updateVoices();}
  if(isGroupFilter(b.dataset.group)){state.group=b.dataset.group;renderReference();document.querySelector<HTMLElement>(`[data-group="${state.group}"]`)?.focus();}
  if(b.dataset.syllable)select(b.dataset.syllable);
  if(b.dataset.comparePreset){const preset=comparisonPresets.find(p=>p.id===b.dataset.comparePreset);if(preset){speaker?.stop(false);state.comparePreset=preset.id;renderReference();updateVoices();document.querySelector<HTMLElement>(`[data-compare-preset="${preset.id}"]`)?.focus();}}
  if(b.dataset.comparePlay)playComparison(b.dataset.comparePlay);
  if(b.id==='compare-stop')speaker?.stop();
  if(b.dataset.neutralTonePlay){const example=neutralToneExamples.find(item=>String(item.precedingTone)===b.dataset.neutralTonePlay);if(example)speaker?.playRecording(example.audio,example.text);}
  if(b.id==='neutral-tone-stop')speaker?.stop();
  if(b.dataset.pick)select(b.dataset.pick,{tone:b.dataset.pickTone?toTone(b.dataset.pickTone):undefined,scroll:true});
  if(b.dataset.tone){select(state.selected,{tone:toTone(b.dataset.tone)});document.querySelector<HTMLElement>(`[data-tone="${state.tone}"]`)?.focus();}
  if(b.dataset.demoTone)select('ma',{tone:toTone(b.dataset.demoTone),scroll:true});
  if(isThirdToneFormId(b.dataset.thirdToneForm)){select(state.selected,{tone:3,form:b.dataset.thirdToneForm});document.querySelector<HTMLElement>(`[data-third-tone-form="${state.thirdToneForm}"]`)?.focus();}
  if(isThirdToneFormId(b.dataset.thirdDemo))select('hao',{tone:3,form:b.dataset.thirdDemo,scroll:true});
  if(b.id==='reset'||b.hasAttribute('data-reset'))reset();
  const example=exampleFor();
  if(b.id==='play'&&example){
    const recording=recordingFor();
    if(recording)speaker?.playRecording(recording,markTone(state.selected,state.tone),'detail-recording');
    else speaker?.speak(example.text,state.voice,state.rate);
  }
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
  if(event.key==='Enter'&&event.target.id==='search'){
    let pinyin: string | undefined;
    if(state.tab==='matrix')pinyin=findSyllables(state.query,state)[0]?.pinyin;
    // Card views have their own filters and example syllables; use the visible result.
    else if(state.tab==='finals'||state.tab==='initials')pinyin=document.querySelector<HTMLElement>('#reference-body .sound-card[data-pick]')?.dataset.pick;
    if(pinyin)select(pinyin,{tone:state.searchMode==='pinyin'?parseQuery(state.query).tone:undefined,scroll:true});
  }
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
