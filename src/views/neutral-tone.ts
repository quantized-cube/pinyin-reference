import {neutralToneExamples} from '../neutral-tone.js';
import {tones} from '../data.js';
import {getThirdToneForm} from '../third-tone.js';
import {required} from '../types.js';

function neutralToneContour(example: typeof neutralToneExamples[number]): string {
  // The third-tone example uses the low form before its neutral syllable.
  const preceding = example.precedingTone === 3
    ? getThirdToneForm('half')
    : required(tones.find(tone => tone.id === example.precedingTone), 'preceding tone');
  const dotY = 72 - example.height * 12;
  return `<svg viewBox="0 0 140 72" aria-hidden="true">
    <path d="M20 12H132M20 36H132M20 60H132" stroke="currentColor" stroke-opacity=".12" fill="none"/>
    <g fill="currentColor" font-size="9" opacity=".6"><text x="4" y="15">5</text><text x="4" y="39">3</text><text x="4" y="63">1</text></g>
    <polyline points="${preceding.points}" transform="translate(20 0) scale(.75 1)" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="120" cy="${dotY}" r="3.5" fill="currentColor"/>
  </svg>`;
}

export function renderNeutralToneGuide(): string {
  return `<details class="neutral-tone-guide">
    <summary>軽声の高さと発音例</summary>
    <p>軽声は短く弱く読みます。線は前の音節の声調、点は軽声の高さの目安を示します。</p>
    <div class="neutral-tone-grid">${neutralToneExamples.map(example=>`<button class="neutral-tone-example" data-neutral-tone-play="${example.precedingTone}" aria-label="第${example.precedingTone}声＋軽声、高さの目安 ${example.height}（${example.label}）。${example.text} ${example.pinyin} の録音を聞く" disabled>
      <strong>第${example.precedingTone}声＋軽声</strong>
      ${neutralToneContour(example)}
      <small>軽声：${example.height}（${example.label}）</small>
      <span class="neutral-tone-word"><span lang="zh-CN">${example.text}</span> <span aria-hidden="true">▶</span></span>
      <span class="neutral-tone-pinyin">${example.pinyin}</span>
    </button>`).join('')}</div>
    <div class="neutral-tone-audio"><button id="neutral-tone-stop" class="text-button" disabled>停止</button><span id="neutral-tone-status" role="status" aria-live="polite"></span></div>
    <details class="neutral-tone-notes"><summary>図の補足・出典</summary>
      <p>第3声の図は「奶奶」のように低く読む場合を示しています。実際の高さは語や話し方によって変わります。図は録音を測定して描いたものではありません。</p>
      <p class="neutral-tone-source"><a href="audio/neutral/credits.html" target="_blank" rel="noreferrer">録音の出典・ライセンス ↗</a><br><a href="https://www.cheng-tsui.com/sites/default/files/ic_1_textbook_chapters_1-3_reduced.pdf" target="_blank" rel="noreferrer">高さの参考：Integrated Chinese（PDF） ↗</a></p>
    </details>
  </details>`;
}
