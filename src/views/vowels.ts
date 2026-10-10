import type {AppState} from '../types.js';

const vowels = [
  {pinyin:'i', ipa:'i', pick:'yi', x:125, y:80, note:'前舌・狭母音。唇を丸めない。'},
  {pinyin:'ü', ipa:'y', pick:'yu', x:197, y:80, note:'i と同じく前舌・狭母音。唇を丸める。'},
  {pinyin:'u', ipa:'u', pick:'wu', x:551, y:80, note:'後舌・狭母音。唇を丸める。'},
  {pinyin:'e', ipa:'ɤ', pick:'e', x:477, y:170, note:'後舌・半狭母音。唇を丸めない。日本語の「え」とは異なる。'},
  {pinyin:'o', ipa:'o', pick:'o', x:551, y:170, note:'後舌・半狭母音。唇を丸める。唇音後の渡り音はこの点に含めない。'},
  {pinyin:'ê', ipa:'ɛ', pick:'ê', x:273, y:253, note:'前舌・半広母音。ie / üe などの主母音の目安にもなる。'},
  {pinyin:'a', ipa:'a', pick:'a', x:346, y:342, note:'広母音。実際の舌の前後位置は音節・話者により変わる。'},
] as const;
const japanese = [
  {label:'い [i]',x:159,y:119}, {label:'う [ɯ̟]',x:420,y:116},
  {label:'え [e̞]',x:235,y:207}, {label:'お [o̞]',x:516,y:220}, {label:'あ [ä]',x:428,y:319},
] as const;

export function renderVowels(state: AppState): string {
  return `<div class="section-heading"><h2>母音の位置を見る</h2><span>前後・高さ・唇の形</span></div>
    <p class="comparison-intro">上ほど舌が高く、左ほど舌が前にある母音です。i と ü、e と o の横並びは、主に唇を丸めるかどうかの対比を示します。</p>
    <label class="vowel-overlay-toggle"><input type="checkbox" id="japanese-vowels" ${state.japaneseVowels?'checked':''}> 日本語の「あいうえお」を重ねる</label>
    <div class="vowel-map" aria-label="母音四辺形。中国語の母音ボタンから音節詳細へ移動できます。">
      <svg viewBox="0 0 640 410" aria-hidden="true"><path d="M125 80H551V342H346ZM199 167H551M272 254H551M338 80L448 342" fill="none" stroke="currentColor" stroke-width="1.5"/><g class="vowel-axis"><text x="110" y="30">前</text><text x="328" y="30">中</text><text x="538" y="30">後</text><text x="12" y="85">高（狭）</text><text x="12" y="175">半狭</text><text x="12" y="260">半広</text><text x="12" y="347">低（広）</text></g></svg>
      ${vowels.map(v=>`<button class="vowel-point" style="left:${v.x/640*100}%;top:${v.y/410*100}%" data-pick="${v.pick}" aria-label="${v.pinyin} [${v.ipa}]。${v.note}" title="${v.note}">${v.pinyin}<small>[${v.ipa}]</small></button>`).join('')}
      ${state.japaneseVowels?japanese.map(v=>`<span class="japanese-vowel" style="left:${v.x/640*100}%;top:${v.y/410*100}%">${v.label}</span>`).join(''):''}
    </div>
    <p class="vowel-legend"><span>● 普通話の代表的な母音（クリックで詳細）</span>${state.japaneseVowels?'<span>◇ 日本語の代表的な位置</span>':''}</p>
    ${state.japaneseVowels?'<div class="vowel-japanese-note"><p>日本語の「う」は、普通話の u [u] ほど唇を突き出さず、舌の位置もやや前寄りになることがあります。ここでは [ɯ̟] と略記していますが、唇を圧縮する発音など、話者・文脈で幅があります。</p><p>日本語の「え」[e̞] は前寄り。普通話の e [ɤ] は後ろ寄りで、同じ「エ」ではありません。近い点でも、両言語の音が常に同じという意味ではありません。</p></div>':''}
    <p class="tone-note">図は学習用の模式図で、話者の実測位置ではありません。日本語は標準語を想定した代表例です。ə は en / eng などに現れる中舌母音ですが、独立した単韻母としては置いていません。舌先の i と er のそり舌性、二重母音の移動も省略しています。o の渡り音の扱いは音節詳細で確認できます。</p>
    <p class="vowel-sources">参考：<a href="https://www.internationalphoneticassociation.org/IPAcharts/IPA_charts_EI/IPA_charts_EI.html" target="_blank" rel="noreferrer">国際音声学会の母音表 ↗</a> · <a href="https://doi.org/10.1017/S002510030000445X" target="_blank" rel="noreferrer">Okada『Japanese』 ↗</a></p>`;
}
