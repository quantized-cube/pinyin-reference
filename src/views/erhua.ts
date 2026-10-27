import {esc} from './shared.js';
import {getFinal} from '../data.js';
import {erhuaGroups} from '../erhua.js';
import {erhuaComparisons} from '../erhua-recordings.js';
import type {FinalId} from '../types.js';

export function renderErhua(): string {
  return `<div class="section-heading"><h2>児化：-r が付くと変わる音</h2><span>儿化 / érhuà</span></div>
    <p class="comparison-intro">児化は語末の「儿」が前の音節と一体になり、韻母がrの響きを帯びる発音です。母音の音色や末尾の n・ng も変わることがあります。</p>
    <section class="rule-card erhua-example" aria-labelledby="erhua-example-title">
      <h3 id="erhua-example-title">diǎn と diǎnr の母音の違い</h3>
      <div class="erhua-pair">
        <div><small>児化前</small><strong lang="zh-CN">点</strong><span>diǎn</span><span class="ipa">[tjɛn]</span><p>母音はエ寄りの [ɛ]。末尾に [n] があります。</p></div>
        <div><small>児化後</small><strong lang="zh-CN">点儿</strong><span>diǎnr</span><span class="ipa">[tjɐ˞] など</span><p>[n] が消え、中央寄りの母音がrの響きを帯びます。ア寄りに聞こえる発音の一例です。</p></div>
      </div>
      <p>IPAは声調を省いた代表的な表記です。˞ はrの響きを示します。児化後の母音は話者によって異なり、IPAの表記も分析によって変わります。ian の児化を [jəɚ] 系で表す記述もあります。</p>
    </section>
    <section class="erhua-changes" aria-labelledby="erhua-changes-title">
      <h3 id="erhua-changes-title">韻母ごとの主な変化</h3>
      <p class="tone-note">普通話・北京語の代表的な変化をまとめています。すべての語に自由に -r を付けられるわけではなく、児化する語やその発音には地域差があります。</p>
      <p class="tone-note">IPAは韻母だけを示し、声調は省いています。児化後のIPAは広い表記の一例で、話者や分析によって異なります。˞ はrの響き、[ɑ̃] の上の波線は鼻音の響き、[u̯] の下の弧はその音が単独で音節を作らないことを表します。</p>
      <p class="tone-note">録音のある行では、同じ声調で児化前・児化後を聞き比べられます。「前 → 後」で続けて再生します。前後で話者が異なるため、声質や速さにも違いがあります。<a href="audio/erhua/credits.html" target="_blank" rel="noreferrer">録音の出典・ライセンス ↗</a></p>
      <p id="erhua-support-status" class="tone-note" role="status"></p>
      <div class="erhua-table-wrap"><table class="erhua-table">
        <caption>元の韻母と、児化したときの発音の変化</caption>
        <thead><tr><th scope="col">元の韻母</th><th scope="col">児化前 → 児化後のIPA例</th><th scope="col">綴りの例・録音</th></tr></thead>
        ${erhuaGroups.map(group=>`<tbody>
          <tr class="erhua-group"><th colspan="3" scope="rowgroup">${esc(group.title)}<p>${esc(group.note)}</p></th></tr>
          ${group.rows.map(row=>`<tr data-erhua-final="${esc(row.final)}">
            <th scope="row">${esc(row.label ?? row.final)}</th>
            <td><div class="erhua-ipa-pair"><span class="ipa">[${esc(row.before ?? getFinal(row.final).ipa)}]</span><span>→</span><span class="ipa">[${esc(row.after)}]</span></div>${row.alternative ? `<small class="erhua-alternative">別の分析：<span class="ipa">[${esc(row.alternative)}]</span></small>` : ''}</td>
            <td>${renderExample(row.final,row.example)}</td>
          </tr>`).join('')}
        </tbody>`).join('')}
      </table></div>
      <p class="tone-note">唇音後の o は本アプリの音節表示に合わせて [wo] としています。er は独立した音節として下で説明し、感動詞の ê・io はこの表の対象外です。</p>
    </section>
    <div class="erhua-notes">
      <section class="rule-card"><h3>綴りは元の音節 ＋ r</h3><p>発音で n・ng などが消えても、綴りには残します。点儿は <strong>diǎnr</strong>、影儿は <strong>yǐngr</strong>。声調記号も元の音節に付けます。</p></section>
      <section class="rule-card"><h3>独立した er との違い</h3><p>「耳 ěr」「二 èr」の er は、それだけで一音節です。児化の -r は前の音節と一体になり、「点儿 diǎnr」も一音節です。</p></section>
    </div>
    <p class="tone-note">録音で比較できるのは9組です。どちらも一音節全体を元の速度で再生します。音節詳細で再生するのは、児化していない基本音節です。</p>
    <p class="vowel-sources">参考：<a href="https://www.hniu.cn/jxxy/info/1126/1327.htm" target="_blank" rel="noreferrer">普通話水平測試大綱の児化解説（湖南信息職業技術学院）↗</a> · <a href="https://www.isca-archive.org/interspeech_2005/lee05d_interspeech.pdf" target="_blank" rel="noreferrer">Lee（2005）：北京語の児化韻の音声研究 ↗</a> · <a href="https://websites.umich.edu/~duanmu/2021syllable_count.pdf#page=27" target="_blank" rel="noreferrer">端木三（2021）：児化韻の分類・表29 ↗</a> · <a href="https://rwxy.xaut.edu.cn/info/1080/1812.htm" target="_blank" rel="noreferrer">児化の発音規則（西安理工大学）↗</a></p>`;
}

function renderExample(final: FinalId, fallback: string): string {
  const comparison=erhuaComparisons.find(item=>item.final===final);
  if(!comparison)return `${esc(fallback)}<small class="erhua-unrecorded">録音未収録</small>`;
  const {id,before,after}=comparison;
  return `<div class="erhua-recorded-example"><span lang="zh-CN">${esc(before.text)}</span> ${esc(before.pinyin)} → <span lang="zh-CN">${esc(after.text)}</span> ${esc(after.pinyin)}</div>
    <div class="erhua-row-controls" role="group" aria-label="${esc(before.text)}・${esc(after.text)}の録音">
      <button data-erhua-pair="${esc(id)}" data-erhua-play="before" aria-label="児化前 ${esc(before.text)} ${esc(before.pinyin)} を聞く">児化前</button>
      <button data-erhua-pair="${esc(id)}" data-erhua-play="after" aria-label="児化後 ${esc(after.text)} ${esc(after.pinyin)} を聞く">児化後</button>
      <button data-erhua-pair="${esc(id)}" data-erhua-play="both" aria-label="${esc(before.text)} ${esc(before.pinyin)} → ${esc(after.text)} ${esc(after.pinyin)} を続けて聞く">前 → 後</button>
      <button data-erhua-stop="${esc(id)}" aria-label="${esc(before.text)}・${esc(after.text)}の録音を停止">停止</button>
    </div><p class="erhua-row-status" data-erhua-status="${esc(id)}" role="status" aria-live="polite"></p>`;
}
