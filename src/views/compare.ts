import {getSyllable, getInitial, getFinal, getTone, markTone, syllables} from '../data.js';
import {comparisonEntries, comparisonExample, comparisonGroups, comparisonOrder, comparisonPresets, comparisonSequence} from '../comparison.js';
import type {AppState, ExampleMap, ExampleState} from '../types.js';
import {esc} from './shared.js';

export function renderCompare(state: AppState, examples: ExampleMap, exampleState: ExampleState, supported: boolean, message: string | null): string {
  const entries=comparisonEntries(state.compareSyllables);
  const triple=entries.length===3;
  const preset=comparisonPresets.find(p=>p.syllables.length===entries.length&&p.syllables.every((pinyin,index)=>pinyin===state.compareSyllables[index]));
  const playable=(selection: string)=>supported&&exampleState==='ready'&&!!comparisonSequence(state.compareSyllables,state.compareTone,examples,selection);
  const card=({side,pinyin}: typeof entries[number])=>{
    const s=getSyllable(pinyin), initial=getInitial(s.initial), example=comparisonExample(pinyin,state.compareTone,examples);
    return `<article class="compare-card" data-side="${side}">
      <label>音節 ${side}<select id="compare-${side.toLowerCase()}" aria-label="比較する音節 ${side}">${[...syllables].sort((a,b)=>a.pinyin.localeCompare(b.pinyin)).map(item=>`<option value="${item.pinyin}" ${item.pinyin===pinyin?'selected':''}>${item.pinyin}</option>`).join('')}</select></label>
      <h3>${markTone(pinyin,state.compareTone)}</h3><p class="compare-ipa">[${s.ipa}${getTone(state.compareTone).ipa}]</p>
      <p class="compare-initial">${s.initial?`声母 ${s.initial} [${initial.ipa}]`:'声母なし'}</p>
      <p class="compare-rime">韻母 ${esc(s.final)} [${s.rimeIpa}]</p><p class="note">${esc(getFinal(s.final).note)}</p>
      <div class="compare-example" lang="zh-CN">${exampleState==='ready'&&example?example.text:'—'}</div>
      <p class="tone-note">${exampleState==='loading'?'例字を読み込み中…':exampleState==='error'?'例字を読み込めませんでした。':example?'上の例字を単独で再生します。':'この声調の単独比較用例字は未収録です。'}</p>
      <button class="primary" data-compare-play="${side}" ${playable(side)?'':'disabled'}>${side}を聞く</button>
      <button class="text-button" data-pick="${pinyin}" data-pick-tone="${state.compareTone}">音節の詳細を見る ↗</button>
    </article>`;
  };
  return `<div class="section-heading"><h2>音を聞き比べる</h2><span>同じ声調・音声で比較</span></div>
    <p class="comparison-intro">韻母や声母の違いを、2〜3個の例字の音節で比べます。声母・韻母だけを切り出した音声ではありません。</p>
    ${comparisonGroups.map(group=>`<section class="comparison-preset-group"><h3>${group.label}</h3><div class="comparison-presets" role="group" aria-label="${group.label}">${comparisonPresets.filter(p=>p.group===group.id).map(p=>`<button data-compare-preset="${p.id}" aria-pressed="${preset===p}">${p.label}</button>`).join('')}</div></section>`).join('')}
    <p class="comparison-note">${preset?.note??`音節 A・B${triple?'・C':''} と声調を選んで比較できます。`}</p>
    <div class="compare-controls"><label class="compare-count-label">比較する音数<select id="compare-count"><option value="2" ${triple?'':'selected'}>2音</option><option value="3" ${triple?'selected':''}>3音</option></select></label>
    <label class="compare-tone-label">共通の声調<select id="compare-tone" aria-label="比較の声調">${([1,2,3,4] as const).map(t=>`<option value="${t}" ${state.compareTone===t?'selected':''}>第${t}声</option>`).join('')}</select></label></div>
    <div class="comparison-grid${triple?' comparison-grid--three':''}">${entries.map(card).join('')}</div>
    <div class="compare-actions"><button class="primary" data-compare-play="alternate" ${playable('alternate')?'':'disabled'}>${triple?'順番に聞く':'交互に聞く'} <small>${comparisonOrder(state.compareSyllables,'alternate').map(entry=>entry.side).join(' → ')}</small></button><button class="stop" id="compare-stop">停止</button></div>
    <p id="compare-status" role="status" aria-live="polite">${esc(message??(!supported?'このブラウザは音声合成に対応していません。':'再生する音声・速度は、音節詳細の設定と共通です。'))}</p>
    ${exampleState==='error'?'<button id="retry-examples" class="text-button">例字の読み込みを再試行</button>':''}
    <p class="tone-note">音声は端末の中国語TTSです。多音字などでは辞書の読みと異なる場合があります。第3声は単独形の比較です。軽声は文脈が必要なため、音節詳細の例語で確認してください。</p>`;
}
