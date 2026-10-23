import {esc} from './shared.js';

// Teaching groups, not rules for generating rhotic IPA or accepting new syllables.
const changes = [
  {finals:'a・ia・ua・o・uo・e・u・ao・iao・ou・iou', note:'母音がrの響きを帯びます。母音の音色や、音の移り方も変わることがあります。', example:'花 huā → 花儿 huār'},
  {finals:'ai・an・uai・uan', note:'末尾の [i] や [n] が消え、ア寄りの母音がrの響きを帯びます。', example:'盖 gài → 盖儿 gàir'},
  {finals:'ei・en・uei・uen', note:'末尾の [i] や [n] が消え、[ɚ] 系の音になります。uei・uen では初めの [w] が残ります。', example:'门 mén → 门儿 ménr'},
  {finals:'ian・üan', note:'末尾の [n] が消え、主母音が中央寄りに変わります。ア寄りに聞こえる発音もあります。', example:'点 diǎn → 点儿 diǎnr'},
  {finals:'i・ü・in・ün', note:'[ɚ] に向かう音の移動が加わります。in・ün の末尾の [n] は消えます。', example:'鱼 yú → 鱼儿 yúr'},
  {finals:'ie・üe', note:'後半の母音が弱まったり、音色が変わったりして、rの響きを持つ音に続きます。', example:'街 jiē → 街儿 jiēr'},
  {finals:'ang・eng・ing・ong・iang・uang・iong', note:'末尾の [ŋ] が消え、母音がrの響きと鼻音の響きを帯びます。鼻音の強さには話者差があります。', example:'影 yǐng → 影儿 yǐngr'},
  {finals:'舌先の i（zi・zhi系）', note:'[ɹ̩]・[ɻ̩] と表す音が、児化では [ɚ] 系の音になります。', example:'事 shì → 事儿 shìr'},
] as const;

export function renderErhua(): string {
  return `<div class="section-heading"><h2>児化：-r が付くと変わる音</h2><span>儿化 / érhuà</span></div>
    <p class="comparison-intro">児化は、語末の「儿」が前の音節と一体になり、韻母がrの響きを帯びる発音です。母音の音色や、末尾の n・ng も変わることがあります。</p>
    <section class="rule-card erhua-example" aria-labelledby="erhua-example-title">
      <h3 id="erhua-example-title">diǎn と diǎnr は、母音も違う</h3>
      <div class="erhua-pair">
        <div><small>児化前</small><strong lang="zh-CN">点</strong><span>diǎn</span><span class="ipa">[tjɛn]</span><p>母音はエ寄りの [ɛ]。末尾に [n] があります。</p></div>
        <div><small>児化後</small><strong lang="zh-CN">点儿</strong><span>diǎnr</span><span class="ipa">[tjɐ˞] など</span><p>[n] が消え、中央寄りの母音がrの響きを帯びます。ア寄りに聞こえる発音の一例です。</p></div>
      </div>
      <p>IPAは声調を省いた代表的な表記です。˞ はrの響きを示します。児化後の母音は話者や分析で異なり、ian の児化を [jəɚ] 系で表す記述もあります。</p>
    </section>
    <section class="erhua-changes" aria-labelledby="erhua-changes-title">
      <h3 id="erhua-changes-title">韻母ごとの主な変化</h3>
      <p class="tone-note">普通話・北京語の代表的な変化をまとめています。すべての語に自由に -r を付けられるわけではなく、使われる語や発音には地域差があります。</p>
      <div class="erhua-table-wrap"><table class="erhua-table">
        <caption>元の韻母と、児化したときの発音の変化</caption>
        <thead><tr><th scope="col">元の韻母</th><th scope="col">主な変化</th><th scope="col">綴りの例</th></tr></thead>
        <tbody>${changes.map(row=>`<tr><th scope="row">${esc(row.finals)}</th><td>${esc(row.note)}</td><td>${esc(row.example)}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>
    <div class="erhua-notes">
      <section class="rule-card"><h3>綴りは元の音節 ＋ r</h3><p>発音で n・ng などが消えても、綴りには残します。点儿は <strong>diǎnr</strong>、影儿は <strong>yǐngr</strong>。声調記号も元の音節に付けます。</p></section>
      <section class="rule-card"><h3>独立した er との違い</h3><p>「耳 ěr」「二 èr」の er は、それだけで一音節です。児化の -r は前の音節と一体になり、「点儿 diǎnr」も一音節です。</p></section>
    </div>
    <p class="tone-note">児化音の録音は未収録です。音節詳細で再生するのは、児化していない基本音節です。</p>
    <p class="vowel-sources">参考：<a href="https://www.hniu.cn/jxxy/info/1126/1327.htm" target="_blank" rel="noreferrer">普通話水平測試大綱の児化解説（湖南信息職業技術学院）↗</a> · <a href="https://www.isca-archive.org/interspeech_2005/lee05d_interspeech.pdf" target="_blank" rel="noreferrer">Lee（2005）：北京語の児化韻の音声研究 ↗</a></p>`;
}
