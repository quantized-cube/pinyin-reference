import {getSyllable, getInitial, getFinal, getTone, markTone} from '../data.js';
import {comparisonEntries, comparisonExample, comparisonGroups, comparisonOrder, comparisonPresets, comparisonSequence, getComparisonPreset} from '../comparison.js';
import type {AppState, ExampleMap, ExampleState} from '../types.js';
import {esc} from './shared.js';

export function renderCompare(state: AppState, examples: ExampleMap, exampleState: ExampleState, supported: boolean, message: string | null): string {
  const preset=getComparisonPreset(state.comparePreset);
  const entries=comparisonEntries(preset.syllables);
  const triple=entries.length===3;
  const playable=(selection: string)=>supported&&exampleState==='ready'&&!!comparisonSequence(preset.syllables,preset.tone,examples,selection);
  const card=({side,pinyin}: typeof entries[number])=>{
    const s=getSyllable(pinyin), initial=getInitial(s.initial), example=comparisonExample(pinyin,preset.tone,examples);
    return `<article class="compare-card" data-side="${side}">
      <p class="compare-side">音節 ${side}</p>
      <h3>${markTone(pinyin,preset.tone)}</h3><p class="compare-ipa">[${s.ipa}${getTone(preset.tone).ipa}]</p>
      <p class="compare-initial">${s.initial?`声母 ${s.initial} [${initial.ipa}]`:'声母なし'}</p>
      <p class="compare-rime">韻母 ${esc(s.final)} [${s.rimeIpa}]</p><p class="note">${esc(getFinal(s.final).note)}</p>
      <div class="compare-example" lang="zh-CN">${exampleState==='ready'&&example?example.text:'—'}</div>
      <p class="tone-note">${exampleState==='loading'?'例字を読み込み中…':exampleState==='error'?'例字を読み込めませんでした。':example?'上の例字を第1声で再生します。':'第1声の聞き比べに使える単独例字は未収録です。'}</p>
      <button class="primary" data-compare-play="${side}" ${playable(side)?'':'disabled'}>${side}を聞く</button>
      <button class="text-button" data-pick="${pinyin}" data-pick-tone="${preset.tone}">音節の詳細を見る ↗</button>
    </article>`;
  };
  return `<div class="section-heading"><h2>音を聞き比べる</h2><span>第1声で聞き比べます</span></div>
    <p class="comparison-intro">下の組み合わせを選び、韻母や声母の違いを第1声の例字で比べます。声母・韻母だけを切り出した音声ではありません。</p>
    ${comparisonGroups.map(group=>`<section class="comparison-preset-group">
      <h3>${group.label}</h3>${'description' in group?`<p class="comparison-note">${esc(group.description)}</p>`:''}
      <div class="comparison-presets" role="group" aria-label="${group.label}">${comparisonPresets.filter(p=>p.group===group.id).map(p=>`<button data-compare-preset="${p.id}" aria-pressed="${preset===p}" ${preset===p?'aria-describedby="comparison-selection-note"':''}>${p.label}</button>`).join('')}</div>
      ${preset.group===group.id?`<p id="comparison-selection-note" class="comparison-note comparison-selection-note"><strong>選択中：${esc(preset.label)}</strong>${esc(preset.note)}</p>`:''}
    </section>`).join('')}
    <div class="comparison-grid${triple?' comparison-grid--three':''}">${entries.map(card).join('')}</div>
    <div class="compare-actions"><button class="primary" data-compare-play="alternate" ${playable('alternate')?'':'disabled'}>${triple?'順番に聞く':'交互に聞く'} <small>${comparisonOrder(preset.syllables,'alternate').map(entry=>entry.side).join(' → ')}</small></button><button class="stop" id="compare-stop">停止</button></div>
    <p id="compare-status" role="status" aria-live="polite">${esc(message??(!supported?'このブラウザは音声合成に対応していません。':'再生する音声・速度は、音節詳細の設定と共通です。'))}</p>
    ${exampleState==='error'?'<button id="retry-examples" class="text-button">例字の読み込みを再試行</button>':''}
    <p class="tone-note">音声は端末の中国語TTSです。多音字などでは辞書の読みと異なる場合があります。他の声調や軽声は、音節の詳細で確認できます。</p>`;
}
