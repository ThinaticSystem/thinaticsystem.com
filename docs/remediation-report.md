# モダナイゼーションの是正報告

モダナイゼーションの独立レビューを受け、既知不具合の判定、ブラウザ・性能比較、CIとローカル配信の検査方法を修正した作業の報告。  
ホスト側の検査は成功し、登録済みのアサーション失敗も確認できた。一方、Nixの検証はタイムアウトで未確認のまま残り、
既存の製品不具合、手動確認、外部検証を完了扱いにはしていない。

以下は2026-09-05の是正作業時点の記録で、現在の受入状態を示すものではない。  
既存の製品不具合は、承認済みの移行契約にすでに含まれていたものを除き、明示的な負債として残した。
無関係な不具合修正を移行の成功として扱う作業は行っていない。

## 是正した検査の仕組み

### 既知不具合の判定と実行記録

登録済みの失敗を確認する判定処理は、該当するアサーション失敗と実行基盤の異常を分けて判定するようにした。  
manifestにある登録情報、テスト実行基盤（runner）の終了状態、診断出力、構造化レポート、テストの識別情報や件数を確認し、
欠落・不正・想定外の結果があれば合格にしない。
もっともらしい結果の後に致命的なシグナルが発生する場合や、正常に見えるレポートに無関係な標準エラー出力が伴う場合も、
異常系のテストケースで拒否できることを検査した。

リンクの入れ子に対する既知不具合テストでは、要素の役割や名前を使って操作対象を特定し、
遷移先の一致とキーボードフォーカスの停止位置を検証した。登録済みの不具合は意図したアサーション失敗として残した。  
実行記録には生ログとVitestレポートに加え、`.artifacts/known-defects-result.json` を出力し、
子プロセスの終了コード、終了シグナル、テスト実行基盤のエラー、検証エラーを保持するようにした。

### 同じ条件でのブラウザ・性能比較

ブラウザスモーク検査は、要素の役割や名前を使って操作対象を特定し、
基準版と候補版で同じ順序で操作する形にそろえた。  
API応答をテスト用データへ差し替え、動きを抑える設定（reduced motion）を有効にして、
画面の表示を待つ時間も含めて測った。  
アクセシビリティ検査は時間測定を止めてから実行した。

性能の基準データには、対になる基準版の実行と同じbrowser-smoke v3の実行基盤を記録した。  
初回表示用のファイル量、リクエスト数、各画面の遅延読み込みで取得するファイル量、3回反復の中央値による時間を比較し、
不明な結果を合格にしない判定を維持した。

### CI環境と検証範囲の明示

CIには固定したsetup-node actionを使い、`.node-version` と一致するNode 22の移行用ランタイムを明示した。  
配信スモーク検査はローカル限定とし、Cloudflareへのデプロイを確認した結果とは扱っていない。

要件一覧では、PASS、登録済みの既知の失敗、負債として残した失敗、未完了の手動作業、未実施の外部検証を区別した。  
自動検査の成功だけで、残った製品不具合や未実施の検証まで完了したように読めないようにした。

## 検証結果と制約

ホスト側では通常テストの17ファイル・19テストが成功し、登録済みの失敗を確認する判定処理は該当するアサーション失敗をちょうど1件確認した。  
本番ビルド、ブラウザスモーク検査、性能比較、ローカル配信検査、TypeDocの検査もPASSだった。
性能は初回表示用のファイル量、各画面の遅延読み込みで取得するファイル量、リクエスト数が基準版を超えず、
時間も事前に定めた20%の実験環境向け基準内に収まった。  
これらはローカルでの観測値に限られ、実環境のUXを保証しない。

Nixではバージョン確認を試みたが、出力前に300秒でタイムアウトした。  
そのため、Nix環境でのインストール、型検査、単体・既知不具合テスト、ビルド、開発サーバー、ブラウザ検証は **UNVERIFIED** のままで、PASSではない。
ホスト側の成功をNix環境での検証結果に置き換えていない。試行したコマンドは実行記録に残した。

人による見た目の確認と代表的なスクリーンリーダー操作は未完了だった。axeの出力だけでは、これらを保証できない。  
また、Cloudflareアカウントへのアクセス、ブランチの紐付け、リモートActions、preview、本番デプロイ、
DNS操作、CMSへの書込み、本番のpatronデータと本番CMSへのアクセスは行っていない。

## 当時の製品負債

基準版にあった次の不具合・方針上の課題は、`docs/requirements-tests.md` に
明示的な `DEBT FAIL` またはセキュリティレビュー項目として残した。

- blogのHTTP失敗時の処理と、並行ページ取得での応答順序
- 記事のルートパラメータ変更時のライフサイクルと、404/500の区別
- clipboardの拒否時の処理
- 通知タイマーの置き換え
- discographyの画像エラー・空結果でのローディング終了処理
- sanitizerのバイパスとiframeのallowlist方針

これらを成功した要件や移行の成果へ変更していない。

## 実行記録

### 既知不具合の判定処理で拒否した条件

以下の異常を合格にしない判定とし、それぞれの拒否経路を異常系のテストケースで検査した。

- manifestのスキーマ欠落・不正
- case/spec識別情報の重複
- 未対応の結果
- runnerの起動・signal・statusの異常
- 想定外の診断出力
- 構造化レポートの欠落・形式不正
- runnerレベルのエラー
- 件数の不一致
- 想定外のsuiteとsuiteの重複
- 想定外のアサーション
- 想定外の成功

### コマンドと検証結果

以下のコマンドは、2026-09-05にリポジトリのルートから実行した。  
結果と証拠の表は、当時の記録を原文のまま残している。

| Command | Result | Evidence |
|---|---|---|
| `corepack pnpm run check` | PASS; 17 test files and 19 tests passed; known-defect gate observed exactly 1 registered assertion failure | `.artifacts/known-defects-report.json`, `.artifacts/known-defects-result.json`, `.artifacts/known-defects.raw.log` |
| `corepack pnpm run test:known-defects:contract` | PASS; negative fixtures passed | command output |
| `corepack pnpm run build` | PASS; initial total 433.06 kB raw / 112.64 kB estimated transfer | build output |
| `node scripts/browser-smoke.mjs` | PASS; Chromium 140.0.7339.16, 3 repeats, no console/page/request errors, no blocked external requests, axe violations empty for all recorded journeys | `.artifacts/browser-smoke.json`, `.artifacts/screenshots/` |
| `corepack pnpm run perf:check` | PASS; initial size and route/request counts did not regress; timing remained within the preset 20% lab rule | `.artifacts/performance.json` |
| `corepack pnpm run deploy:check` | PASS; local static artifact and explicit fixture API contract only | command output; external validation is `NOT_RUN` |
| `corepack pnpm run docs:check` | PASS | `.artifacts/typedoc/` |
| `git diff --check` | PASS | command output |

### ブラウザ比較の条件と測定値

対になる基準版の証拠は、候補版と次の条件をそろえて取得した。

- browser-smoke v3の実行基盤
- Chromiumの実行ファイルとバージョン
- API応答を差し替えるテスト用データの組
- reduced-motion設定
- ローカル接続限定の静的ファイル配信サーバー
- 画面表示の待機条件
- 役割や名前で特定した要素の操作順序
- 3回反復の集計

基準版の記録は、リポジトリ外の次のファイルに保存した。

`/home/hermes/.hermes/work/thinaticsystem-modernization/paired-baseline-browser.json`

候補版の記録は `.artifacts/browser-smoke.json` に保存した。最終記録での候補版の時間中央値は次のとおり。

| 操作経路 | 中央値（ms） |
|---|---:|
| home | 286.42 |
| theme toggle | 696.53 |
| blog list | 116.91 |
| article | 94.09 |
| back | 30.80 |
| discography | 88.16 |
| mobile menu/blog | 1388.47 |

### Nixで試行したコマンド

次のコマンドを時間制限付きで実際に試し、バージョンが出力される前に300秒でタイムアウトした。

`nix develop --offline --no-write-lock-file -c bash -lc 'node --version && corepack pnpm --version'`
