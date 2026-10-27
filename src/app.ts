import {renderCompare} from './views/compare.js';
import {renderVowels} from './views/vowels.js';
import {renderErhua} from './views/erhua.js';
import {comparisonAudioHint,comparisonPresets,comparisonSequence,getComparisonPreset} from './comparison.js';
import {renderAbout} from './views/about.js';
import {createState,save} from './state.js';
import {SearchNavigation,searchPresentation} from './search-navigation.js';
import {ComparisonNavigation} from './comparison-navigation.js';
import {esc} from './views/shared.js';
import {renderMatrix} from './views/matrix.js';
import {renderFinals} from './views/finals.js';
import {renderInitials} from './views/initials.js';
import {renderRules} from './views/rules.js';
import {renderDetail as detailView} from './views/detail.js';
import {syllables,syllableMap,markTone,parseQuery,findSyllables,isInitialId,isGroupFilter} from './data.js';
import {Speaker} from './speech.js';
import {parseExampleCatalog} from './examples.js';
import {resolveDetailPlayback,unavailablePlaybackMessage} from './detail-playback.js';
import {isThirdToneFormId} from './third-tone.js';
import {neutralToneExamples} from './neutral-tone.js';
import {erhuaSequence} from './erhua-recordings.js';
import {isToneId,isTabId,required} from './types.js';
import type {ExampleCatalog,ToneId,ThirdToneFormId,TabId} from './types.js';

function $<T extends HTMLElement = HTMLElement>(selector: string): T { return required(document.querySelector<T>(selector), selector); }
const state = createState();
const searches = new SearchNavigation();
const comparison = new ComparisonNavigation();
let detailOrigin: {element: HTMLElement; preset?: string; side?: string} | undefined;
let detailAudioActive = false;
let erhuaAudioId: string | undefined;
let exampleLoad: {status: 'loading' | 'error'} | {status: 'ready'; catalog: ExampleCatalog} = {status: 'loading'};
let exampleRequestPending = false;
function loadedExamples(){return exampleLoad.status==='ready'?exampleLoad.catalog:undefined;}
let speaker: Speaker | undefined;
function readHash(){
  const h=new URLSearchParams(location.hash.slice(1));
  const pinyin=h.get('s'),tone=Number(h.get('t'));
  const validPinyin=!!pinyin&&syllableMap.has(pinyin);
  if(!validPinyin&&!isToneId(tone))return false;
  if(validPinyin)state.selected=pinyin;
  if(isToneId(tone))state.tone=tone;
  const form=h.get('form');
  state.thirdToneForm=isThirdToneFormId(form)?form:'full';
  state.thirdToneExpanded=state.tone===3&&state.thirdToneForm!=='full';
  return true;
}
function updateHash(){history.replaceState(null,'',`#s=${encodeURIComponent(state.selected)}&t=${state.tone}${state.tone===3?'&form='+state.thirdToneForm:''}`);}
function toTone(value: string): ToneId | null { const tone=Number(value);return isToneId(tone)?tone:null; }
readHash();
function focusAndScroll(element: HTMLElement){
  element.focus({preventScroll:true});
  if(matchMedia('(max-width:800px)').matches)element.scrollIntoView({behavior:'auto',block:'start'});
}
function revealDetail(){
  const panel=$('#detail'),heading=$('#detail-title');
  heading.focus({preventScroll:true});
  // Keep both the heading and the close control visible when the card was opened below the fold.
  if(matchMedia('(max-width:800px)').matches||panel.getBoundingClientRect().top<0||heading.getBoundingClientRect().bottom>window.innerHeight){
    panel.scrollIntoView({behavior:'auto',block:'start'});
  }
}
function updateDetailVisibility(){
  const hidden=state.tab==='compare'&&!comparison.detailOpen;
  $('#detail').hidden=hidden;
  $('#workspace').classList.toggle('detail-hidden',hidden);
}
function closeComparisonDetail(){
  if(state.tab!=='compare')return;
  if(detailAudioActive)speaker?.stop(false);
  comparison.closeDetail();updateDetailVisibility();
  let origin=detailOrigin?.element.isConnected?detailOrigin.element:undefined;
  if(!origin&&detailOrigin?.side&&detailOrigin.preset===state.comparePreset){
    origin=document.querySelector<HTMLElement>(`[data-side="${detailOrigin.side}"] [data-pick]`)??undefined;
  }
  focusAndScroll(origin??$('#comparison-title'));
}
function navigate(nextTab: TabId,{focusHeading=false}: {focusHeading?: boolean}={}){
  speaker?.stop(false);
  const compareTransition=state.tab!==nextTab&&(state.tab==='compare'||nextTab==='compare');
  searches.transition(state,nextTab);
  comparison.transition(state,nextTab);
  state.tab=nextTab;
  if(compareTransition)updateHash();
  renderReference();renderDetail();
  if(focusHeading){const heading=$('#reference-body h2');heading.tabIndex=-1;focusAndScroll(heading);}
}
function select(pinyin: string,{tone,form,scroll=false,origin}: {tone?: ToneId | null; form?: ThirdToneFormId; scroll?: boolean; origin?: HTMLElement | null}={}){
  if(!syllableMap.has(pinyin))return;
  speaker?.stop(false);if(pinyin!==state.selected||(tone&&tone!==state.tone))state.thirdToneForm='full';state.selected=pinyin;if(tone)state.tone=tone;if(form){state.thirdToneForm=form;state.thirdToneExpanded=true;}
  const opening=state.tab==='compare'&&!comparison.detailOpen;
  const externalOrigin=origin===null||!!origin&&!origin.closest('#detail');
  if(state.tab==='compare'){
    comparison.showDetail();
    if(origin===null)detailOrigin=undefined;
    else if(origin&&!origin.closest('#detail'))detailOrigin={element:origin,preset:state.comparePreset,side:origin.closest<HTMLElement>('[data-side]')?.dataset.side};
  }
  updateHash();renderDetail();
  document.querySelectorAll<HTMLElement>('[data-syllable]').forEach(b=>{const selected=b.dataset.syllable===pinyin;b.setAttribute('aria-pressed',String(selected));b.tabIndex=selected?0:-1;});
  ensureGridFocus();$('#announce').textContent=`${markTone(pinyin,state.tone)} を選択しました。`;
  if(state.tab==='compare'&&(opening||externalOrigin))revealDetail();
  else if(scroll && matchMedia('(max-width:800px)').matches)$('#detail').scrollIntoView({behavior:'auto',block:'start'});
}
function renderReference(){
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>{if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(state.tab==='matrix') { $('#reference-body').innerHTML=renderMatrix(state); ensureGridFocus(); }
  if(state.tab==='finals') $('#reference-body').innerHTML=renderFinals(state);
  if(state.tab==='initials') $('#reference-body').innerHTML=renderInitials(state);
  if(state.tab==='rules') $('#reference-body').innerHTML=renderRules();
  if(state.tab==='compare') $('#reference-body').innerHTML=renderCompare(state,loadedExamples()?.isolatedExamples??{},exampleLoad.status,!!speaker?.recordingsSupported,speaker?.messageFor('comparison')??null);
  if(state.tab==='vowels') $('#reference-body').innerHTML=renderVowels(state);
  if(state.tab==='erhua') $('#reference-body').innerHTML=renderErhua();
  updateSearchMode();updateDetailVisibility();
  updateComparisonAudio();
  updateNeutralToneAudio();
  updateErhuaAudio();
}
function updateSearchMode(){
  const presentation=searchPresentation(state.tab,state.searchMode);
  const input=$<HTMLInputElement>('#search');
  input.value=presentation.searchable?state.query:'';
  input.disabled=!presentation.searchable;
  input.placeholder=presentation.placeholder;
  input.setAttribute('aria-label',presentation.label);
  $('#search-label').textContent=presentation.label;
  $('.search-bar').setAttribute('aria-label',presentation.label);
  $('#search-mode-label').textContent=presentation.modeLabel;
  const mode=$<HTMLSelectElement>('#search-mode');
  mode.value=state.searchMode;mode.disabled=!presentation.searchable;
  mode.setAttribute('aria-label',presentation.modeLabel);
  required(mode.querySelector<HTMLOptionElement>('[value="pinyin"]'),'pinyin search option').textContent=presentation.pinyinOption;
  $<HTMLButtonElement>('#reset').disabled=!presentation.searchable;
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
function updateErhuaAudio(){
  if(state.tab!=='erhua')return;
  const supported=!!speaker?.recordingsSupported;
  document.querySelectorAll<HTMLButtonElement>('[data-erhua-play]').forEach(button=>{button.disabled=!supported;});
  document.querySelectorAll<HTMLButtonElement>('[data-erhua-stop]').forEach(button=>{button.disabled=!supported||button.dataset.erhuaStop!==erhuaAudioId||!speaker?.messageFor('erhua');});
  const support=document.querySelector('#erhua-support-status');
  if(support)support.textContent=supported?'':'このブラウザは録音の再生に対応していません。';
  document.querySelectorAll<HTMLElement>('[data-erhua-status]').forEach(status=>{
    status.textContent=status.dataset.erhuaStatus===erhuaAudioId?speaker?.messageFor('erhua')??'':'';
  });
}
function ensureGridFocus(){if(!document.querySelector('[data-syllable][tabindex="0"]'))document.querySelector('[data-syllable]')?.setAttribute('tabindex','0');}
function playbackFor(){return resolveDetailPlayback(state,loadedExamples(),exampleLoad.status);}


function renderDetail(){ $('#detail').innerHTML=detailView(state,playbackFor(),exampleLoad.status);updateDetailVisibility();updateVoices(); }
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
  const playback=playbackFor();
  $<HTMLButtonElement>('#play').disabled=playback.kind==='unavailable'||!(playback.kind==='recording'?speaker.recordingsSupported:speaker.supported);
  updateAudioStatuses();
}
function updateAudioStatuses(){
  if(!speaker)return;
  const voices=speaker.voices;
  const selectedVoice=voices.find(v=>v.voiceURI===state.voice)??voices[0];
  const playback=playbackFor(),recorded=playback.kind==='recording';
  const unavailable=playback.kind==='unavailable'?unavailablePlaybackMessage(playback.reason):recorded?(!speaker.recordingsSupported?'このブラウザは録音の再生に対応していません。':null):(!speaker.supported?'このブラウザは音声合成に対応していません。':null);
  const msg=unavailable??(recorded?`${playback.contextual?'例語全体':'単独音'}の録音を元の速度で再生します。`:!voices.length?'音声一覧に普通話が表示されていません。再生ボタンで中国語の再生を試せます。音が出ない場合は下の設定手順をご確認ください。':`中国語TTS · ${selectedVoice?.lang || 'zh'}`);
  const status=document.querySelector('#voice-status');
  if(status)status.textContent=unavailable??speaker.messageFor(recorded?'detail-recording':'speech')??msg;
  updateComparisonAudio();
  updateNeutralToneAudio();
  updateErhuaAudio();
}
speaker=new Speaker({onVoices:()=>{if(speaker)updateVoices();},onStatus:(_message,kind,source)=>{detailAudioActive=(source==='speech'||source==='detail-recording')&&(kind==='pending'||kind==='playing');updateAudioStatuses();if(kind==='error'&&source==='speech'){const help=document.querySelector<HTMLDetailsElement>('#voice-help');if(help)help.open=true;}}});
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
function reset(){searches.reset(state);renderReference();}

document.addEventListener('click',event=>{
  if(!(event.target instanceof Element))return;
  const b=event.target.closest('button');if(!b)return;
  if(isTabId(b.dataset.tab))navigate(b.dataset.tab);
  if(isTabId(b.dataset.openTab))navigate(b.dataset.openTab,{focusHeading:true});
  if(isGroupFilter(b.dataset.group)){state.group=b.dataset.group;renderReference();document.querySelector<HTMLElement>(`[data-group="${state.group}"]`)?.focus();}
  if(b.dataset.syllable)select(b.dataset.syllable,{origin:b});
  if(b.dataset.comparePreset){const preset=comparisonPresets.find(p=>p.id===b.dataset.comparePreset);if(preset){speaker?.stop(false);comparison.selectPreset(state,preset.id);renderReference();updateVoices();document.querySelector<HTMLElement>(`[data-compare-preset="${preset.id}"]`)?.focus();}}
  if(b.id==='close-detail')closeComparisonDetail();
  if(b.dataset.comparePlay)playComparison(b.dataset.comparePlay);
  if(b.id==='compare-stop')speaker?.stop();
  if(b.dataset.neutralTonePlay){const example=neutralToneExamples.find(item=>String(item.precedingTone)===b.dataset.neutralTonePlay);if(example)speaker?.playRecording(example.audio,example.text);}
  if(b.id==='neutral-tone-stop')speaker?.stop();
  if(b.dataset.erhuaPlay&&b.dataset.erhuaPair){const items=erhuaSequence(b.dataset.erhuaPair,b.dataset.erhuaPlay);if(items){erhuaAudioId=b.dataset.erhuaPair;speaker?.playRecordingSequence(items,'erhua');}}
  if(b.dataset.erhuaStop&&b.dataset.erhuaStop===erhuaAudioId)speaker?.stop();
  if(b.dataset.pick)select(b.dataset.pick,{tone:b.dataset.pickTone?toTone(b.dataset.pickTone):undefined,scroll:true,origin:b});
  if(b.dataset.tone){select(state.selected,{tone:toTone(b.dataset.tone)});document.querySelector<HTMLElement>(`[data-tone="${state.tone}"]`)?.focus();}
  if(b.dataset.demoTone)select('ma',{tone:toTone(b.dataset.demoTone),scroll:true,origin:b});
  if(isThirdToneFormId(b.dataset.thirdToneForm)){select(state.selected,{tone:3,form:b.dataset.thirdToneForm});document.querySelector<HTMLElement>(`[data-third-tone-form="${state.thirdToneForm}"]`)?.focus();}
  if(isThirdToneFormId(b.dataset.thirdDemo))select('lao',{tone:3,form:b.dataset.thirdDemo,scroll:true,origin:b});
  if(b.id==='reset'||b.hasAttribute('data-reset'))reset();
  if(b.id==='play'){
    const playback=playbackFor();
    if(playback.kind==='recording')speaker?.playRecording(playback.url,playback.contextual&&playback.example?playback.example.text:markTone(state.selected,state.tone),'detail-recording');
    else if(playback.kind==='speech')speaker?.speak(playback.text,state.voice,state.rate);
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
  if(event.key==='/'&&!event.target.matches('input,textarea,select')&&!$<HTMLDialogElement>('#about-dialog').open){event.preventDefault();if($<HTMLInputElement>('#search').disabled)navigate('matrix');$<HTMLInputElement>('#search').focus();}
  if(event.key==='Escape'){speaker?.stop();if(event.target.id==='search')reset();}
  if(event.key==='Enter'&&event.target.id==='search'){
    // Let the IME confirm text without treating that Enter as a search action.
    if(event.isComposing||event.keyCode===229)return;
    const supplement=state.tab==='finals'?document.querySelector<HTMLElement>('#reference-body [data-nasal-search-target]'):null;
    if(supplement){
      event.preventDefault();
      supplement.focus({preventScroll:true});
      supplement.scrollIntoView({behavior:'auto',block:'start'});
      return;
    }
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
window.addEventListener('hashchange',()=>{if(readHash())select(state.selected,{origin:null});});
window.addEventListener('pagehide',()=>speaker?.stop(false));
window.addEventListener('pageshow',()=>speaker?.refresh());
window.addEventListener('focus',()=>speaker?.refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)speaker?.refresh();});

$('#total-count').textContent=String(syllables.length);
$('#about-content').innerHTML=renderAbout();
renderReference();renderDetail();loadExamples();
