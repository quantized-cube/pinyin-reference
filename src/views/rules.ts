import {tones} from '../data.js';
import {thirdToneForms} from '../third-tone.js';
import type {ToneId} from '../types.js';
import {contour} from './shared.js';
import {renderNeutralToneGuide} from './neutral-tone.js';
export function renderRules(){
  const rules: [string,string,[string,string,ToneId?][]][]=[
    ['ü の点は、いつ消える？','j / q / x の後は ü → u。声母がないときは y を前に置き、点を省略します。n / l の後は点を残します。綴りが u でも、舌の位置は ü [y] のままです。',[['ju','j + ü → ju'],['xuan','x + üan → xuan'],['nü','n + ü → nü'],['yuan','üan → yuan']]],
    ['長い韻母を短く書く','声母が前にあると iou → iu、uei → ui、uen → un。jun / qun / xun の un は ün なので、この uen の省略とは別です。',[['liu','l + iou → liu'],['gui','g + uei → gui'],['dun','d + uen → dun'],['jun','j + ün → jun']]],
    ['声母なしの y / w 規則','i 系は yi / ya / ye / yao / you / yan / yin / yang / ying / yong。u 系は wu / wa / wo / wai / wei / wan / wen / wang / weng。ü 系は yu / yue / yuan / yun と書きます。y と w は、この表では声母なしの綴りとして扱います。',[['yi','i → yi'],['you','iou → you'],['wen','uen → wen'],['yun','ün → yun']]],
    ['同じ文字でも、音が違う','ian・üan の a は [ɛ] 系。zi / ci / si と zhi / chi / shi / ri の i は、yi の [i] と区別します。er は独立音節の [ɚ] です。',[['xian','xian [ɕjɛn]'],['zi','zi [tsɹ̩]'],['zhi','zhi [ʈʂɻ̩]'],['er','er [ɚ]']]],
    ['声調記号はどこに付く？','a → e の順で優先し、ou では o、それ以外は最後の母音に付けます。iu は u（liù）、ui は i（guì）。軽声は記号なしで、数字式では 5 または 0。このアプリはどちらも検索できます。',[['liu','liù',4],['gui','guì',4],['nü','nǚ',3]]],
  ];
  return `<div class="section-heading"><h2>綴りのルールをほどく</h2><span>例を選んで確認</span></div><div class="rules-list">${rules.map(([title,note,links],i)=>`<article class="rule-card"><h3><span class="rule-index">0${i+1}</span>${title}</h3><p>${note}</p><div class="rule-examples">${links.map(([s,label,tone])=>`<button data-pick="${s}"${tone?` data-pick-tone="${tone}"`:''}>${label}</button>`).join('')}</div></article>`).join('')}${renderApostropheGuide(rules.length+1)}<article class="rule-card"><h3><span class="rule-index">${String(rules.length+2).padStart(2,'0')}</span>4つの声調と軽声</h3><p>図は第1〜4声の基本的な調形（音の高さの変化）を示します。数字は1が最も低く、5が最も高いことを表します。</p><div class="tone-guide">${tones.filter(t=>t.id!==5).map(t=>`<button data-demo-tone="${t.id}">${t.label}${contour(t,true)}<small>${t.value}</small></button>`).join('')}</div><p>上の第1〜4声を選ぶと、音節詳細で単独音の録音を聞けます。「一」「不」にも変調があります。</p>${renderThirdToneGuide()}${renderNeutralToneGuide()}</article></div>`;
}
function renderApostropheGuide(index: number): string {
  return `<article class="rule-card">
    <h3><span class="rule-index">${String(index).padStart(2,'0')}</span>音節の境目を示す '（隔音符号）</h3>
    <p>a・o・e で始まる音節を前の音節に続けて書くとき、音節の区切りを読み違えないように ' を入れます。</p>
    <p>西安 Xī'ān ＝ xī ＋ ān<br>皮袄 pí'ǎo ＝ pí ＋ ǎo<br>女儿 nǚ'ér ＝ nǚ ＋ ér</p>
    <p>Xī'ān（西安）は xī ＋ ān の2音節、xiān（先）は1音節です。xiān の ian は一つの韻母なので、途中に ' を入れません。</p>
    <div class="rule-examples"><button data-pick="xi" data-pick-tone="1">xī（西）</button><button data-pick="an" data-pick-tone="1">ān（安）</button><button data-pick="xian" data-pick-tone="1">xiān（先）</button></div>
    <p><a href="https://jwc.qzc.edu.cn/_upload/article/files/ff/32/cc69a400496186407e64fa4338cc/232fc89a-19af-4b9c-a829-a936d8a8919b.pdf#page=3" target="_blank" rel="noreferrer">参考：漢語拼音方案「隔音符号」（PDF） ↗</a></p>
  </article>`;
}
export function renderThirdToneGuide(){return `<details class="third-tone-guide"><summary>第3声を詳しく：全三声・半三声・3声＋3声</summary><p>辞書の表記はいずれも第3声です。半三声や変調でも、ピンインの記号は ǎ のままです。</p><div class="third-guide-grid">${thirdToneForms.map(form=>`<button data-third-demo="${form.id}"><strong>${form.label}</strong>${contour(form,true)}<span>${form.value} [${form.ipa}]</span><small>${form.id==='full'?'老 lǎo':form.id==='half'?'老师 lǎoshī':'老板 lǎobǎn'}</small></button>`).join('')}</div><p>この3例はすべて録音で聞けます。話者はそれぞれ異なります。数字は相対的な高さ（1＝低い、5＝高い）の目安で、音声を測定した値ではありません。</p><ul class="third-context-notes"><li>全三声：単独で丁寧に読むときなどの形です。自然な発話では、語末でも必ず上がるとは限りません。</li><li>半三声：後半を上げず、低く読む形です。第1・2・4声の前などに現れます。</li><li>3声＋3声：同じまとまりで第3声が続くと、前の第3声が上昇形に変わります。後ろの第3声の形は、その後に続く音や区切りによって変わります。</li><li>軽声の前では、語ごとの性質も第3声の発音に関わります。第3声が3つ以上続く場合も意味や韻律の区切りが関わるため、発音の形を自動判定していません。</li></ul><p>図とIPAは学習用の目安です。<a href="https://web.mit.edu/~jinzhang/www/pinyin/tones/" target="_blank" rel="noreferrer">声調の参考資料（MIT） ↗</a></p></details>`;}
