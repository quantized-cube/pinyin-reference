import type {AppState} from '../types.js';
import {getSyllable,getTone,getFinal,getInitial,parseQuery,markTone,rulesFor,tones} from '../data.js';
import {getThirdToneForm,thirdToneForms} from '../third-tone.js';
import {matrixFinalId,finalContext} from '../layout.js';
import type {PronunciationExample,ExampleState} from '../types.js';
import {renderInitialArticulation} from './initials.js';
import {esc,contour} from './shared.js';
const speakerIcon='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14"/></svg>';
export function renderThirdToneSelector(state: AppState){const form=getThirdToneForm(state.thirdToneForm);return `<details class="third-tone-panel" ${state.thirdToneExpanded?'open':''}><summary>半三声・変調を詳しく見る <span>現在：${form.label}</span></summary><div class="third-tone-options" role="group" aria-label="第3声の発音形">${thirdToneForms.map(item=>`<button data-third-tone-form="${item.id}" aria-pressed="${item.id===form.id}" aria-label="${item.label} ${item.value}"><strong>${item.label}</strong>${contour(item)}<small>${item.value}</small></button>`).join('')}</div><p class="tone-note">${form.note}</p><p class="tone-note">図・IPAは目安です。軽声の前や長い第3声連続は自動判定しません。</p></details>`;}
export function renderVoiceHelp(){return `<details id="voice-help" class="voice-help"><summary>音声が出ないとき</summary><p>このアプリは端末の読み上げ音声を使います。音声一覧に表示されなくても、中国語を指定して再生を試せます。無音や別の言語になる場合は、音声データを確認してください。</p><strong>Android・Chrome</strong><ol><li>端末の「設定」で「テキスト読み上げ」を検索します。</li><li>使用中の読み上げエンジンの設定で「音声データをインストール」を開き、「中国語（中国本土）」または「普通話」を追加します。</li><li>Chromeを開き直し、このページを再読み込みしてから再生します。</li></ol><p>項目名は機種・読み上げエンジンにより異なります。<a href="https://support.google.com/accessibility/android/answer/6006983?hl=ja" target="_blank" rel="noreferrer">Googleの設定手順 ↗</a></p><p>ほかの端末でも中国語の読み上げ音声を確認してください。メディア音量・Bluetoothの出力先・通信接続もご確認ください。</p></details>`;}
export function renderDetail(state: AppState, example: PronunciationExample | undefined, exampleState: ExampleState){
  const s=getSyllable(state.selected),t=getTone(state.tone),f=getFinal(s.final),i=getInitial(s.initial);
  const third=state.tone===3?getThirdToneForm(state.thirdToneForm):undefined;
  const pronunciation=third??t;
  const ipaCaption=third?`${third.label}の目安 · ${third.value}`:state.tone===5?'分節音の目安（軽声の高さは文脈依存）':'単独声調の目安';
  let exampleHtml='';
  if(example){
    const chars=[...example.text];
    const context=third?.id==='full'?'丁寧に単独で読む場合。TTSでは上昇が弱いこともあります。'
      :third?.id==='half'?`第3声 → 第${parseQuery(example.tokens[1]??'').tone}声。同じまとまりで続けて読む場合。`
      :'第3声 → 第3声。同じまとまりで読むと、前の音節が上昇形になります。';
    exampleHtml=`<div class="example"><small>${chars.length>1?'例語全体を再生・下線が対象音節':'例字を再生'}</small><div class="example-word" lang="zh-CN">${chars.map((c,n)=>n===example.target?`<mark>${c}</mark>`:c).join('')}</div><small>辞書の読み</small><div class="example-pinyin">${example.tokens.map((p,n)=>{const {text,tone}=parseQuery(p);const py=esc(markTone(text,tone));return n===example.target?`<mark>${py}</mark>`:py;}).join(' ')}</div>${third&&third.id!=='full'?`<div class="example-realization"><small>対象音の発音の目安</small><strong>${third.label} · ${third.value} <span>[${s.ipa}${third.ipa}]</span></strong><p>${context}</p></div>`:''}</div>`;
  } else {
    const missing=state.tone===3?'この音節・発音形の比較用例語は未収録です。図とIPAは練習用の目安です。':'この音節・声調の例語は未収録です。声調の綴りは練習用の表示です。';
    exampleHtml=`<div class="example"><small>${exampleState==='loading'?'例語を読み込み中…':exampleState==='error'?'例語データを読み込めませんでした。':missing}</small>${exampleState==='error'?'<button id="retry-examples" class="text-button">再試行</button>':exampleState==='ready'&&third?`<button class="example-demo" data-third-demo="${third.id}">hǎo の比較例を開く ↗</button>`:''}</div>`;
  }
  return `<div class="detail-top"><p class="eyebrow">SYLLABLE / 音節の詳細</p><span class="detail-number">${s.peripheral?'周辺的な音節':t.name}</span><p class="reading-caption">辞書の読み · ${t.label}</p><h2>${markTone(s.pinyin,state.tone)}</h2><div class="detail-ipa">[${s.ipa}${pronunciation.ipa}]</div><p class="ipa-caption">${ipaCaption}</p></div>
  <div class="detail-content"><div class="decomposition"><div><small>声母</small><strong>${s.initial||'∅'}</strong><span class="ipa">${i.ipa?'['+i.ipa+']':'声母なし'}</span></div><span>＋</span><div><small>分析上の韻母</small><strong>${esc(matrixFinalId(s.final))}</strong>${finalContext(s.final)?`<small>${finalContext(s.final)}</small>`:''}<span class="ipa">[${s.rimeIpa}]</span></div></div>${renderInitialArticulation(s.initial)}${rulesFor(s).map(r=>`<p class="rule-note">${r}</p>`).join('')}<p class="tone-note">${esc(f.note)}${state.tone===5?' 軽声のIPAは分節音の目安のみ。母音の弱化を含む細かな変化は省略。':''}</p>
  <hr class="detail-separator"><h3 class="mini-title">辞書上の声調<span>1〜4声・軽声</span></h3><div class="tones" aria-label="声調">${tones.map(t=>`<button class="tone" data-tone="${t.id}" aria-pressed="${state.tone===t.id}" aria-label="${t.label} ${markTone(s.pinyin,t.id)}">${t.id===5?'軽声':t.id+'声'}${contour(t)}<small>${markTone(s.pinyin,t.id)}</small></button>`).join('')}</div>
  ${third?renderThirdToneSelector(state):`<p class="tone-note">${t.id===5?'':t.value+'：'}${t.note}</p>`}${exampleHtml}
  <div class="play-row"><button id="play" class="primary" disabled>${speakerIcon}<span>${example&&example.text.length>1?'例語を聞く':'発音を聞く'}</span></button><button id="stop" class="stop" aria-label="再生を停止">■</button></div><p id="voice-status" class="voice-status" role="status" aria-live="polite"></p><details class="voice-settings" ${state.settings?'open':''}><summary>音声・速度を調整</summary><label>中国語の音声<select id="voice" aria-label="中国語の音声"></select></label><label>読み上げ速度 <span class="speed-control"><input id="rate" type="range" min="0.6" max="1.2" step="0.05" value="${state.rate}" aria-label="読み上げ速度"><output id="rate-value">${state.rate.toFixed(2)}×</output></span></label><button id="refresh-voices" class="text-button">音声を再読み込み</button></details>${renderVoiceHelp()}<p class="audio-footnote">端末の中国語TTSを使用。${third?'全三声・半三声・変調を直接指定できないため、図どおりの発音は保証できません。':'辞書の読みと異なる場合があります。'}ネイティブ録音・IPA指定合成ではありません。</p></div>`;
}
