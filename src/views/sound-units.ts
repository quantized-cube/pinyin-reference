import {getFinal} from '../data.js';

export function renderSoundUnitsGuide(): string {
  return `<section class="sound-units-guide" aria-label="母音と韻母の違い">
    <p><strong>母音は音の種類、韻母は音節の中のまとまり。</strong>韻母には母音だけでなく、末尾の子音も含まれることがあります。</p>
    <details>
      <summary>母音・子音と、声母・韻母はどう違う？</summary>
      <p>母音・子音は、音の作り方による分類です。一方、普通話の音節を「声母＋韻母」に分けるとき、声母は先頭の子音、韻母はその後の部分を指します。an のように声母のない音節もあります。声調はこの区分とは別に扱います。</p>
      <table>
        <caption>ban の2通りの見方（文字はピンイン、声調は省略）</caption>
        <thead><tr><th scope="col">見方</th><th scope="col">b</th><th scope="col">a</th><th scope="col">n</th></tr></thead>
        <tbody>
          <tr><th scope="row">音節の区切り</th><td>声母 b</td><td colspan="2">韻母 an</td></tr>
          <tr><th scope="row">音の種類</th><td>子音</td><td>母音</td><td>子音</td></tr>
        </tbody>
      </table>
      <p>ban の n は子音ですが、声母ではなく韻母 an の一部です。<strong>「声母＝すべての子音」「韻母＝母音」ではありません。</strong></p>
      <dl>
        <dt>a・ai</dt><dd>a は母音1つからなる韻母。ai は、母音の音色が連続的に変わる二重母音を含む韻母です。</dd>
        <dt>an・ang</dt><dd>末尾に鼻子音 [n]・[ŋ] を持つ韻母です。本アプリでは an [${getFinal('an').ipa}]・ang [${getFinal('ang').ipa}] と表し、主母音の音色の違いも示しています。</dd>
        <dt>uang</dt><dd>u（介音・韻頭）＋ a（主母音・韻腹）＋ ng（韻尾）と分けられます。介音は主母音へ移る短い音です。すべての韻母に介音や韻尾があるわけではありません。</dd>
      </dl>
      <p>「韻母一覧」は、介音や末尾の子音を含むまとまりを調べるための表です。「母音図」は、その中に現れる代表的な母音の舌の位置や唇の形を見る図です。</p>
      <p class="sound-units-source">参考：<a href="https://web.mit.edu/~jinzhang/www/pinyin/finals/index.html" target="_blank" rel="noreferrer">MITのピンイン教材：韻母の構成 ↗</a></p>
    </details>
  </section>`;
}
