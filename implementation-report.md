# 実装報告：Angular 22・Vitest・要件・アクセシビリティ

AngularアプリケーションをAngular 22とVitestへ移行し、移行で生じた表示の不具合を修正して、アクセシビリティを改善した作業の報告。  
通常テストと本番ビルドは成功し、初期読込量も減少した。一方、リンクの入れ子による既知不具合は未修正のまま残り、
NixのNode 26ではテストと開発サーバーが異常終了した。

以下は2026-09-05のタスク `t_a044fe90`（B+C）で得た実装・検証記録をまとめている。  
現在の受入状態ではなく、この時点の変更内容、結果、残課題を示す。

## 移行した開発・テスト環境

レビュー済みのAngular 19/20移行作業を維持し、Angular 22.1.5、CLIとbuild 22.1.7、
TypeScript 6.0.3、Vitest 4.1.11へ移行した。  
アプリケーションと単体テストのターゲットには公式のapplication・unit-test builderを使い、
Karma/Jasmineのブートストラップファイルを削除して、独立したprovider・setupファイルを追加した。

Markdownの動的importで起きていた解決失敗は、ngx-markdownがサポートするpeer依存の組を追加して修正した。  
追加したのは `marked-katex-extension@5.1.12` と `katex@0.16.47` で、Viteのエラーを抑制する対応は取っていない。

再現可能な開発環境として、最小構成の `flake.nix` と `flake.lock` も追加した。  
nixpkgsは `801bef6abd86b91e51083066b83fb354a11fc640`（2026-09-04）に固定し、
Node 26.8.1とpnpm 10.17.1を提供する構成にした。ただし、この環境ですべての検証が成功したわけではない。

## 表示と操作の変更

zoneless環境でローディングオーバーレイに生じた不具合は、
`LoadingService` のgetter/setterをsignalで支える形で修正した。  
既存の呼び出し箇所は維持し、この問題に絞った回帰テストを追加した。
blogとdiscographyのテンプレートでは、日付パターンを週基準の `YYYY` から暦年の `yyyy` へ変更し、
ブラウザ操作で観測した実行時エラー `NG02300` を解消した。

ナビゲーションとアクセシビリティには、候補版の移行作業に含まれていた次の変更を適用した。

- ナビゲーション用のネイティブなrouter linkとnavigationランドマーク
- 明示的なアクセシブル名と代替テキスト
- テーマ切替の `aria-pressed`
- モバイルナビゲーションの `aria-controls` と `aria-expanded`
- 外部リンクの `rel` 属性

アニメーションは、グローバルに読み込んでいた `animate.css` 全体をやめ、
実際に使う4つのCSSクラスに必要な定義と、動きを抑える設定（reduced motion）への対応だけを残した。  
`animated`、`fadeIn`、`slideInRight`、`slideOutRight` の視覚的な挙動を維持し、
観測された初期バンドルの肥大化を解消した。

## 要件と既知不具合の検査

既知不具合の検査では、登録した製品不具合による失敗と、テスト自体を実行できない失敗を区別する仕組みを追加した。  
`test/known-defects.json` と判定プログラムを使い、不明な結果は合格にしない。
テスト準備やimportの失敗、実行の欠落、想定外の成功、重複実行を拒否することを、異常系のテストケースで検査した。

リンクの入れ子に対するアサーションは、Testing Libraryのroleに基づく検証へ変更した。  
`src` には `querySelector*`、XPath、test-id、CSSによるUIロケータは残っていない。
ただし、ここで変更したのは検査方法で、操作可能なリンクが入れ子になる製品不具合は意図的に未修正のまま残した。  
このテストは失敗する必要があり、登録済みの失敗を確認する判定処理は、該当するアサーション失敗だけを受け入れる。

開発時の操作経路には `scripts/dev-browser-smoke.mjs` を追加した。  
CMS/APIの応答をテスト用データへ差し替えて検証する仕組みで、本番CMSデータには接続しない。

## 検証結果と当時の残課題

通常テストは17ファイル・19テストが成功し、型検査、lint、既知不具合の判定テストも成功した。  
既知不具合テストの生の実行結果には登録済みアサーションの失敗が1件残り、テストの実行基盤や準備処理の失敗はなかった。
開発時のスモークテストと本番ビルドのブラウザ検証では、対象の操作経路を完了し、エラーを観測しなかった。  
コマンドと実行環境の対応は、後述の実行記録に残した。

本番ビルドの初期アセットは、raw・gzip・Brotliの3種類とも基準版から減少した。  
静的リソースのエントリ数と転送量も減少したが、操作時間は経路や反復によってばらつきがあった。
時間の測定値は固定したローカルのテスト用データでの観測に限られ、実環境のUXを保証しない。

NixのNode 26では、Vitestが結果を出す前に `double free or corruption (out)` で異常終了し、
`ng serve` も開発サーバーの起動中にSIGSEGVで終了した。  
サポート対象の同じlockファイルとソースコードの組み合わせは、承認済みのAngular移行用ランタイムNode 22.22.3で検証した。
Nixの本番用builder自体はNode 26.8.1で成功したが、テストと開発サーバーについては検証上の不足が残った。

見た目とスクリーンリーダーによる確認は、別の未完了の受入条件として残った。  
CIワークフロー、TypeDoc、Cloudflare向けのビルド成果物・画面URLへの直接アクセス・API応答を確認するローカル検査、
最終の納品ドキュメント、独立レビューは、後続タスク `t_4fca1804` の担当範囲とした。

この作業では、リモートGitHub Actionsの実行、PR作成、push、Cloudflareへのデプロイ、
DNS操作、CMSへの書込み、稼働中のインフラの変更は行っていない。

## 実行記録

### 作業対象と比較条件

- リポジトリ：`/home/hermes/projects/thinaticsystem.com`
- ブランチ：`chore/modernization-local`
- 基準版のSHA：`33b4ef4e8d21276130127a61aede6f0a8e1c47cb`
- ローカルコミット：`ec77351d13da81054024586b904256aaf67dbefa`

候補版の検証前に、凍結した基準記録として次の2ファイルを読んだ。基準版には追跡対象の差分がなかった。

- `/home/hermes/.hermes/work/thinaticsystem-modernization/baseline-report.md`
- `baseline.json`

基準版の旧テストは18件を実行し、4件が成功、14件が失敗していた。  
これは過去のテスト雛形・セットアップの負債として残した記録で、製品の合格を示す根拠には使っていない。

ブラウザ比較には、基準版と同じ固定したテスト用データと実行基盤を使った。

- Chromium：`/home/hermes/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`
- デスクトップ：1280x900
- モバイル：375x812
- 反復回数：3回

上記のローカルコミットは、この報告書の執筆後に作成された。push済みまたはリモートレビュー済みを意味しない。

### コマンドと実行結果

以下は、当時ローカルで実行した記録を原文のまま残した表。リモートCIの結果は含まない。

| Command | Runtime | Exit/result |
|---|---|---:|
| `corepack pnpm install --frozen-lockfile --offline --reporter=append-only` | Node 22.22.3 / pnpm 10.17.1 | 0 |
| `nix develop -c pnpm install --frozen-lockfile --offline --reporter=append-only` | Nix Node 26.8.1 / pnpm 10.17.1 | 0 |
| `pnpm exec tsc -p tsconfig.spec.json --noEmit` | Node 22.22.3 | 0 |
| `pnpm run lint` | Node 22.22.3 | 0, all files pass |
| `pnpm run test` | Node 22.22.3 | 0, 17 files / 19 tests passed |
| `pnpm run test:known-defects:contract` | Node 22.22.3 | 0, negative fixtures passed |
| `pnpm run test:known-defects` | Node 22.22.3 | 0 gate exit; raw child is 1 registered assertion failure and no runner/setup failure |
| `NG_BUILD_MAX_WORKERS=2 nix develop -c pnpm run build` | Nix Node 26.8.1 | 0, output `dist/app/browser` |
| `node scripts/dev-browser-smoke.mjs` | Node 22.22.3 + cached Chromium | 0, home -> blog list -> readable article; zero console/page/request errors |
| candidate production browser harness, three sequential repeats | Node 22.22.3 + cached Chromium | 0 each; zero fatal/console/page/request errors each |
| `git diff --check` | git | 0 |

### 初期アセットと静的リソース

最終の本番ビルドで得た初期ファイル合計を、凍結した基準版と比較した。

| 圧縮条件 | 凍結した基準版（bytes） | 候補版（bytes） |
|---|---:|---:|
| raw | 531,195 | 432,891 |
| gzip level 9、mtime 0 | 155,551 | 127,385 |
| Brotli quality 11 | 136,693 | 112,482 |

候補版の本番用静的リソースの読込記録は、3回の反復で同じ値だった。

| 項目 | 基準版 | 候補版 |
|---|---:|---:|
| ローカルエントリ数 | 13 | 12 |
| 転送量（bytes） | 708,019 | 556,951 |
| デコード後の量（bytes） | 704,719 | 553,951 |

### 操作時間と保存先

同じテスト用データとブラウザ実行基盤で得た操作時間を、原表のまま示す。  
基準版は中央値、候補版は最終の各反復の値。

| Journey | Baseline median ms | Candidate final repeats ms |
|---|---:|---:|
| desktop.home | 301.50 | 369.55 / 265.30 / 382.73 |
| desktop.theme-toggle | 884.79 | 373.83 / 878.78 / 369.67 |
| desktop.blog-list | 1101.17 | 877.44 / 502.07 / 784.60 |
| desktop.blog-article | 106.36 | 137.10 / 96.92 / 93.33 |
| desktop.blog-back | 26.55 | 52.97 / 45.18 / 44.86 |
| desktop.discography | 966.85 | 76.67 / 84.34 / 77.93 |
| mobile.menu-blog | 2328.96 | 1442.30 / 1458.92 / 1443.90 |

測定の元データは次のファイルから、同じディレクトリの `candidate-browser-final-3.json` までを保存した。

`/home/hermes/.hermes/work/thinaticsystem-modernization/candidate-browser-final-1.json`

基準版のアーティファクトは変更していない。
