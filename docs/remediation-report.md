# モダナイゼーションの是正報告

この報告書は当時の実施記録を残したもの。現在の受入状態を示すものではない。  
成功・失敗の判定や検証の制約は、以下の是正作業時点の記録として読む。

## 作業範囲

モダナイゼーションの独立レビューを受けて行った、是正作業の記録をまとめた。  
既存の製品不具合は、承認済みの移行契約にすでに含まれていたものを除き、明示的な負債として残した。  
無関係な不具合修正を、移行の成功として扱うことはしていない。

## 実装と検証

- **既知不具合の契約検査**

  次の異常を合格にしない、fail-closedの判定にした。

  - manifestのスキーマ欠落・不正
  - case/spec識別情報の重複
  - 未対応の結果
  - runnerの起動・signal・statusの異常
  - 想定外の診断出力
  - 構造化レポートの欠落・形式不正
  - runnerレベルのエラー
  - 件数の不一致
  - 想定外のsuite
  - suiteの重複
  - 想定外のアサーション
  - 想定外の成功

- **異常系フィクスチャ**

  上記の拒否経路を検査した。  
  もっともらしいテスト出力の後に致命的なsignalが発生するケースと、  
  正常に見えるレポートに無関係なstderrエラーが伴うケースも含めた。

- **入れ子のanchorの既知不具合テスト**

  セマンティックなロケータを使い、遷移先の一致とキーボードフォーカスの停止位置を検証した。  
  登録済みの不具合は、意図したアサーション失敗として残した。

- **既知不具合の実行記録**

  rawログとVitestレポートに加え、`.artifacts/known-defects-result.json` を出力するようにした。  
  子プロセスのstatus、signal、runnerエラー、検証エラーを保持する。

- **ブラウザスモーク検査**

  基準版と候補版に同じセマンティックな操作順序を使った。  
  管理下のAPIフィクスチャとreduced motionを使い、表示準備が整うまでの時間を測定した。  
  アクセシビリティ検査は、時間測定を止めてから実行した。

- **性能の基準データ**

  対になる基準版の実行と同じ、browser-smoke v3の実行基盤を記録した。  
  次の検査は、引き続きfail-closedとした。

  - 初期アーティファクト
  - リクエスト数
  - 遅延読込ルートのバイト数
  - 3回反復の中央値による時間

- **CIとローカル配信検査**

  CIには固定したsetup-node actionを使い、`.node-version` と一致するNode 22の移行用ランタイムを明示した。  
  配信スモーク検査はローカル限定とし、Cloudflareへのデプロイを示すものとは扱っていない。

- **要件一覧の状態区分**

  次の状態を区別するようにした。

  - PASS
  - 登録済みの既知の失敗
  - 負債として残した失敗
  - 未完了の手動作業
  - 未実施の外部検証

## 検証の証拠

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

対になる基準版の証拠は、候補版と次の条件をそろえて取得した。

- browser-smoke v3ハーネス
- Chromiumの実行ファイルとバージョン
- 合成フィクスチャの組
- reduced-motion設定
- loopbackの静的サーバー
- 準備完了の待機
- セマンティックな操作順序
- 3回反復の集計

基準版の記録は、リポジトリ外の次のファイルに保存した。

`/home/hermes/.hermes/work/thinaticsystem-modernization/paired-baseline-browser.json`

候補版の記録は `.artifacts/browser-smoke.json` に保存した。

最終記録での候補版の時間中央値は次のとおり。

| 操作経路 | 中央値（ms） |
|---|---:|
| home | 286.42 |
| theme toggle | 696.53 |
| blog list | 116.91 |
| article | 94.09 |
| back | 30.80 |
| discography | 88.16 |
| mobile menu/blog | 1388.47 |

これらはローカルの実験環境での観測値に限られる。実環境のUXを保証しない。

## Nixと外部検証の制約

次のコマンドを、時間制限付きで実際に試した。

`nix develop --offline --no-write-lock-file -c bash -lc 'node --version && corepack pnpm --version'`

バージョンが出力される前に、300秒でタイムアウトした。  
そのため、Nix環境での次の実行は **UNVERIFIED** のままで、PASSではない。

- install
- typecheck
- unit/debt
- build
- dev-server
- browser

上記のホスト側の検査結果を、Nixの証拠と混同してはいけない。

次の外部確認・操作は実施していない。

- Cloudflareアカウントへのアクセス
- ブランチの紐付け
- リモートActions
- preview
- 本番デプロイ
- DNS操作
- CMSへの書込み
- 本番のpatronデータへのアクセス
- 本番CMSへのアクセス

人による見た目の確認と、代表的なスクリーンリーダー操作は未完了として残った。  
axeの出力だけでは、これらを保証できない。

## 残った負債

基準版にあった次の製品不具合は、`docs/requirements-tests.md` に  
明示的な `DEBT FAIL` またはセキュリティレビュー項目として残した。

- blogのHTTP失敗時の処理
- blogの並行ページ取得での応答順序
- 記事のルートパラメータ変更時のライフサイクル
- 記事の404/500の区別
- clipboardの拒否時の処理
- 通知タイマーの置き換え
- discographyの画像エラー・空結果でのローディング終了処理
- sanitizerのバイパスとiframeのallowlist方針

これらを黙って成功した要件に変えたり、移行の成功として分類したりはしていない。
