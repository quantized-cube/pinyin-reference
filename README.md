# Pinyin Atlas

日本語で使う、普通話のピンイン・IPA・発音リファレンス。TypeScript 7.0.2 / strict モードで実装しています。

[公開アプリ](https://pinyin-reference.pages.dev/) · [GitHubリポジトリ](https://github.com/quantized-cube/pinyin-reference)

## 起動

Windows で `start.cmd` をダブルクリックすると、ローカルサーバーが起動して既定のブラウザが開きます。Node.js 20 以降が必要です。インストール済みの Node.js 24 で確認しました。初回は開発用パッケージを自動インストールし、起動のたびにTypeScriptをビルドします。初回インストールにはネット接続が必要です。

PowerShell から起動する場合は、プロジェクトのフォルダーで実行します：

```powershell
npm ci    # 初回のみ
npm start
```

ブラウザで <http://127.0.0.1:4173> を開きます。停止するときはサーバーのウィンドウで Ctrl+C。4173 番が使用中の場合は既存サーバーを利用するか、`$env:PORT = '4174'` を指定してから `npm start` で起動します。

`dist/index.html` の直接ダブルクリック（file://）では、JavaScriptモジュールと例語取得が制限されるため、上記のローカルサーバーを使ってください。

## Cloudflare Pages で公開

ビルド後の `dist/` はHTML・CSS・JavaScript・JSONからなる静的サイトです。Cloudflare Pagesで公開でき、サーバーの常駐やアプリ用APIキーは不要です。音声再生は、公開後も閲覧者の端末・ブラウザが提供する普通話の音声を使います。

GitHubにプロジェクトを保存し、Cloudflare PagesのGit連携でリポジトリを選択します。公開・非公開のどちらのリポジトリも対応しています。

プロジェクト一式をリポジトリ直下に置く場合の設定：

| 設定項目 | 値 |
|---|---|
| Framework preset | None（フレームワークなし） |
| Production branch | 公開に使うブランチ（例：`main`） |
| Root directory | 空欄（リポジトリ直下） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `24.12.0`（`.node-version` で指定） |

Cloudflare側で依存関係のインストールとビルドが行われ、`dist/` の内容が公開されます。TypeScriptのコンパイルが必要なので、ビルドコマンドを設定してください。公開に使うブランチへ変更をpushすると、標準設定では自動的に再ビルド・公開されます。

`src/`・`public/`・`scripts/`・`tests/` と、`package.json`・`package-lock.json`・TypeScript設定をGitHubに含めます。`public/examples.json` は生成済みデータとして含めるため、公開時にPythonや辞書の再取得は不要です。`work/`・`node_modules/`・`.build/`・`dist/` は `.gitignore` で除外しています。

例語データの出典・CC BY-SA 4.0の表記は、公開するリポジトリとアプリにも維持してください。詳細は「出典」を参照してください。

参考：[Cloudflare PagesのGit連携](https://developers.cloudflare.com/pages/get-started/git-integration/)、[ビルド設定](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Node.jsのバージョン指定](https://developers.cloudflare.com/pages/configuration/build-image/#override-default-versions)。

## できること

- 21声母＋声母なしの行、40韻母欄、413音節のマトリクス。存在する収録音節だけを選択できます。
- 全音節のピンイン・IPA、声母と韻母への分解、表記上の変化。
- 声母一覧、韻母一覧、表記規則と声調ガイド。
- 音節・韻母・IPA検索。`nǚ`、`nv3`、`nu:3`、`ma0`、`ma5` に対応。
- 韻母グループ、声母、周辺的な音節による絞り込みとIPA併記。
- 第1〜4声・軽声の綴りと調形。声調ごとの例字・例語の読み上げ、停止、音声と速度の選択。
- 第3声の「全三声 / 半三声 / 3声＋3声の変調」を切り替え、辞書の読みと発音形の目安を区別。21音節・62例の比較用例語を収録。
- 検索への `/` キー、マトリクス上の矢印キー、Home / End。Enter / Space で音節を選択。
- スマートフォン幅のレイアウト。選択音節・声調・第3声の発音形をURLのハッシュで再現。

`xuan` は `x + üan`、`jun` は `j + ün`、`dun` は `d + uen`。`iou → iu`、`uei → ui`、`uen → un`、`ü → u`、声母なしの y / w 規則を説明します。

## 第3声・半三声の比較

`hao3` を検索して第3声を選び、「第3声の発音形」で切り替えます。「表記と声調」にも比較ガイドがあります。

| 発音形 | 代表的な調形 | 比較例（下線の対象は最初の音節） |
|---|---|---|
| 全三声 | 214 / [˨˩˦] | 好 hǎo：丁寧な単独形の目安 |
| 半三声 | 21 / [˨˩] | 好吃 hǎochī：後半を上げない低い形 |
| 3声＋3声の変調 | 35相当 / [˧˥] | 好友 hǎoyǒu：同じまとまりの前の第3声が上昇形になる |

辞書の読みはすべて第3声のままです。半三声・変調を選んでもピンインの `ǎ` は変えず、IPAと調形図、対象音の発音の目安を切り替えます。比較例は発音形ごとに手動で選び、CC-CEDICTに読みが存在することを生成時に検証しています。すべて音声を聴取検証したデータではありません。

全三声は丁寧な単独発音などでの代表形で、自然な発話では語末でも上がらないことがあります。半三声の比較例には第1・2・4声の前を採用しています。軽声の前は語ごとの性質も関係し、第3声が3つ以上続く場合も意味・韻律上の区切りが関係するため、自動判定は行いません。

対応する比較例がない場合は再生を無効にし、`hǎo` の同じ発音形の比較例へ移れます。全三声のみ、既存の単独例字があれば利用します。異なる発音形や文脈の例語を代わりに再生しません。

調値・IPAは学習用の代表値で、再生音声の測定値ではありません。ブラウザTTSに全三声・半三声・変調を直接指定できないため、図どおりの音声を保証する比較録音ではありません。

## 音声について

Web Speech API を使用し、端末・ブラウザが提供する普通話の音声で漢字・例語を読み上げます。ピンインやIPAを読み上げサービスにそのまま渡したり、pitch を変更して声調を偽装したりはしません。

声調の読み上げを厳密に強制するAPIではありません。TTS が多音字・軽声を別の読みで発音する場合があります。母音・子音だけの分離録音、ネイティブ話者の録音、発音評価は含みません。軽声は必ず複数音節の例語に含め、対象の文字とピンインに下線を引きます。例語全体を読み上げるので、変調が起こる場合もあります。

有効な音節のすべてに全声調の語があるわけではありません。例語がない音節・声調では再生を無効にし、「未収録」と表示します。現在の自動選別データでは `ê / tei / lo / zhei / chua / rua` に例語がありません。綴り・IPAは調べられますが、これらの再生には今後の例語整備が必要です。未収録は「その発音の語が存在しない」との断定ではありません。

中国語音声が見つからない場合は、端末の言語・音声設定で普通話の音声を追加し、ブラウザを再起動してください。表は音声なしでも動作します。オンライン音声には通信が必要です。画面の読み込み自体はローカルファイルだけで完結します。

## 収録範囲とIPA方針

学習用の明示的な音節リストを採用し、声母と韻母の直積は使いません。40は本アプリの「欄数」であり、言語学で唯一の韻母数という意味ではありません。一般的な韻母のほか、舌尖の `-i(z)` / `-i(zh)`、`er`、`ê`、`io` を区別しています。

茶色は感動詞・口語の異読など、掲載範囲が資料によって異なる周辺的な音節です。児化の全組み合わせ、方言だけの綴り、音節主音の `m / n / ng / hm / hng` は対象外です。

IPAは広い音声表記の一案に統一しています。`eng [əŋ]`、`ie [jɛ]`、`üe [ɥɛ]`、`r [ɻ]`、舌尖の `i [ɹ̩ / ɻ̩]` などを採用し、主要な異表記は注記します。唇音の後の `o` は `[wo]` 系。`ri` 全体は `[ɻ̩]` とまとめます。わたり音は `[j / w / ɥ]` で表記します。

マトリクスのIPAは声調なし、詳細では1〜4声の代表的な調形を付記し、第3声は選択した発音形に応じて切り替えます。軽声には固定の高さを与えず、母音の弱化などは説明にとどめます。機械的な連結では表せないすべての異音・変調を再現する音声学辞典ではありません。

## 出典

確認日：2026-10-07。

- [中国教育部：汉语拼音方案](https://www.moe.gov.cn/jyb_sjzl/ziliao/A19/195802/t19580201_186000.html) と [本文の転記](https://zh.wikisource.org/zh-hans/汉语拼音方案)：表記規則。
- [Pinyin](https://en.wikipedia.org/wiki/Pinyin)、[Standard Chinese phonology](https://en.wikipedia.org/wiki/Standard_Chinese_phonology)、[Pinyin table](https://en.wikipedia.org/wiki/Pinyin_table)：音節・IPAの照合。説明文は独自に日本語で作成。
- [MIT: Mandarin Tones](https://web.mit.edu/~jinzhang/www/pinyin/tones/)：全三声・半三声・第3声連続の解説。
- [CC-CEDICT / MDBG](https://www.mdbg.net/chinese/dictionary?page=cedict)：漢字・例語のピンイン。簡体字見出しと読みを抽出し、例語の自動選別と手動優先例を追加、英語定義は省略。`public/examples.json`（ビルド時に `dist/` へコピー）は **CC BY-SA 4.0** の派生データです。取得日・元圧縮ファイルのSHA-256はJSON内の `meta` に記録しています。
- [MDN: SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) および関連API：Context7 CLIで現行ドキュメントを取得して実装。

CC-CEDICT の原著作者は CC-CEDICT contributors（CEDICT 創始者 Paul Denisowski）、配布元は MDBG です。[CC BY-SA 4.0 ライセンス本文](https://creativecommons.org/licenses/by-sa/4.0/)。例語データを再配布・改変する際は出典・変更の明示と同一ライセンスが必要です。第三者サイトの録音音声は取得・再配布していません。

## ファイル構成

```text
src/
  app.ts           画面操作・詳細表示・型付きDOM操作
  data.ts          声母・韻母・音節・綴り・声調・検索
  types.ts         声母・韻母・声調・状態・例語の型定義
  examples.ts      JSON例語データの読み込み時検証
  third-tone.ts    第3声の発音形・比較例の選択・文脈検証
  speech.ts        型付き音声アダプター・再生・停止・エラー処理
public/
  index.html       画面の構造
  styles.css       配色・レイアウト
  examples.json    ライセンス情報を含む派生例語データ
scripts/
  build.ts         TypeScriptコンパイル・静的ファイルのコピー
  server.ts        Node.js標準機能だけのローカルサーバー
  build_examples.py  CC-CEDICTから例語を再生成
tests/            TypeScriptの自動テスト（4ファイル）
tsconfig.json      ブラウザ用・strict設定
tsconfig.tools.json  サーバー・ビルド・テスト用設定
package-lock.json  開発用パッケージのバージョン固定
start.cmd          Windows用起動ファイル
```

編集対象は `src/` と `public/` です。`dist/` はブラウザ用の生成物、`.build/` はサーバー・ビルド・テスト用の生成物なので直接編集しません。ブラウザが実行するJavaScriptはTypeScriptから生成します。実行時の外部ライブラリは不要です。

`strict` に加えて `noUncheckedIndexedAccess` を有効にしています。声母・韻母のIDと声調（1〜5）は限定した型で定義し、JSONとDOMイベントは読み込み・入力時に確認します。ソースマップを生成します。

TypeScript設定は [公式ドキュメント](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html) をContext7で確認し、NodeNext・拡張子付きES Modulesを採用しました。

## 検証・例語再生成

```powershell
npm run typecheck  # 型チェックだけ
npm run build      # コンパイルと静的ファイルのコピー
npm test           # ビルド後にテスト
```

開発用パッケージのインストール後、型チェック・ビルド・テストは外部ネットワークを使いません。413音節の声調記号往復変換、既知の綴り規則、不正組み合わせ、例語とピンインの対応、軽声の文脈、第3声の例語と調形の対応・曖昧な文脈の除外、中国語音声の選別、音声の遅延ロード・停止・失敗を検証します。

例語を再生成するときは、Python 3.10以降と初回辞書ダウンロード用ネット接続が必要です。再生成後は自動でビルドします：

```powershell
npm run data:refresh
```

`work/cedict.txt.gz` があれば再利用します。最新辞書で更新したい場合は、このキャッシュを別名にしてから実行してください。例語の読みは辞書に基づきますが、TTSで全件を聴取確認したものではありません。

2026-10-08 の確認：strict型チェック・ビルド・TypeScript自動テスト19件成功。Windows Chromeで第3声の3形のIPA・例語切替、辞書の第3声表記の維持、半三声・変調の例語再生完了、URLからの発音形復元、未収録時の再生無効化と比較例への移動を確認。既存の軽声表示も確認しました。375px幅でもページ全体の横はみ出しがないことを確認しました。
