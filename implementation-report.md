# 実装報告：Angular 22・Vitest・要件・アクセシビリティ

この報告書は当時の実施記録を残したもの。現在の受入状態を示すものではない。  
数値、実行結果、未解決事項は、以下の実装・検証時点の記録として読む。

- **日付：2026-09-05**
- **タスク：`t_a044fe90`（B+C）**
- **リポジトリ：`/home/hermes/projects/thinaticsystem.com`**
- **ブランチ：`chore/modernization-local`**
- **基準の証拠**

  次の2ファイルを参照した。

  - `/home/hermes/.hermes/work/thinaticsystem-modernization/baseline-report.md`
  - `baseline.json`

## 比較基準の再確認

候補版の検証前に、凍結した基準記録を読んだ。  
対象のSHAは `33b4ef4e8d21276130127a61aede6f0a8e1c47cb` で、追跡対象の差分はなかった。

基準記録の初期アセット合計は次のとおり。

- raw：531,195 bytes
- gzip：155,551 bytes
- Brotli：136,693 bytes

ブラウザ検証には、固定した合成フィクスチャと次の条件を使っていた。

- Chromium：`/home/hermes/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`
- デスクトップ：1280x900
- モバイル：375x812
- 反復回数：3回

基準版の旧テストは18件を実行し、4件が成功、14件が失敗していた。  
この失敗は、過去のテスト雛形・セットアップの負債として残した。製品の合格を示す根拠には使っていない。

## 実装範囲

- **ツールチェーンの移行**

  レビュー済みのAngular 19/20移行作業を維持し、候補版を次の構成まで移行した。

  - Angular 22.1.5
  - CLIとbuild 22.1.7
  - TypeScript 6.0.3
  - Vitest 4.1.11

- **公式builderへの移行**

  Angularアプリケーションと単体テストのターゲットを、公式のapplication・unit-test builderへ移行した。  
  Karma/Jasmineのブートストラップファイルを削除し、独立したprovider・setupファイルを追加した。

- **Markdown用peer依存の追加**

  ngx-markdownがサポートする `marked-katex-extension@5.1.12` と `katex@0.16.47` の組を追加した。  
  Viteのエラーを抑制せずに、動的importの解決失敗を修正した。

- **zoneless環境のローディング表示**

  `LoadingService` のgetter/setterをsignalで支え、ローディングオーバーレイの退行を修正した。  
  既存の呼び出し箇所を維持し、この問題に絞った回帰テストを追加した。

- **日付パターンの修正**

  blogとdiscographyのテンプレートで、Angular 22の日付パターンを週基準の `YYYY` から暦年の `yyyy` へ変更した。  
  ブラウザ操作で観測した実行時エラー `NG02300` を解消した。

- **ナビゲーションとアクセシビリティ**

  候補版の移行作業に含まれていた、次のセマンティックな変更を適用した。

  - ナビゲーション用のネイティブなrouter link
  - 明示的なアクセシブル名と代替テキスト
  - テーマ切替の `aria-pressed`
  - モバイルナビゲーションの `aria-controls` と `aria-expanded`
  - navigationランドマーク
  - 外部リンクの `rel` 属性

- **アニメーションの読込量削減**

  グローバルに読み込んでいた `animate.css` 全体を、実際に使う4つの契約とreduced-motion対応に置き換えた。

  - `animated`
  - `fadeIn`
  - `slideInRight`
  - `slideOutRight`

  アプリで使っていた視覚的な挙動を維持し、観測された初期バンドルの肥大化を解消した。

- **既知不具合テストのロケータ**

  入れ子のanchorに対する既知不具合のアサーションを、Testing Libraryのroleに基づく検証へ変更した。  
  `src` には `querySelector*`、XPath、test-id、CSSによるUIロケータは残っていない。

- **既知不具合の契約検査**

  `test/known-defects.json` と、不明な結果を合格にしないfail-closedの契約チェッカーを追加した。  
  実行可能な異常系フィクスチャで、次のケースを検査した。

  - setup/importの失敗
  - 実行の欠落
  - 想定外の成功
  - 重複実行

- **最小構成のNix開発シェル**

  `flake.nix` と `flake.lock` を追加した。  
  nixpkgsは `801bef6abd86b91e51083066b83fb354a11fc640`（2026-09-04）に固定した。  
  シェルが提供するバージョンはNode 26.8.1、pnpm 10.17.1だった。

- **開発時のブラウザスモークテスト**

  `scripts/dev-browser-smoke.mjs` を追加した。  
  ローカルの合成フィクスチャで開発時の操作経路を検証し、本番CMSデータには接続しない。

## 検証コマンドと実行結果

以下は、当時ローカルで実行した記録を原文のまま残した表。  
リモートCIの結果を示すものではない。

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

### Nix環境で残った実行時の問題

- **Vitestの異常終了**

  NixのNode 26では、テスト結果が出る前にネイティブエラー `double free or corruption (out)` で終了した。

- **開発サーバーの異常終了**

  NixのNode 26での `ng serve` は、開発サーバーの起動中にSIGSEGVで終了した。

これらは、その実行環境で残った検証上の不足として記録した。  
同じサポート対象のlock/source構成は、承認済みのAngular移行用ランタイムNode 22.22.3で検証した。  
Nixの本番用builder自体は、Node 26.8.1で成功した。

## 性能とブラウザの比較

最終の本番ビルドで得た候補版の初期ファイル合計は次のとおり。

| 圧縮条件 | 凍結した基準版（bytes） | 候補版（bytes） |
|---|---:|---:|
| raw | 531,195 | 432,891 |
| gzip level 9、mtime 0 | 155,551 | 127,385 |
| Brotli quality 11 | 136,693 | 112,482 |

測定した初期合計は、3種類とも候補版で減少した。

候補版の本番用静的リソースのtiming記録は、3回の反復で同じ値だった。

| 項目 | 基準版 | 候補版 |
|---|---:|---:|
| ローカルエントリ数 | 13 | 12 |
| 転送量（bytes） | 708,019 | 556,951 |
| デコード後の量（bytes） | 704,719 | 553,951 |

同じ合成フィクスチャとブラウザ実行基盤で得た操作時間を、原表のまま示す。  
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

時間の測定値は、固定したローカルフィクスチャでの証拠に限られる。実環境のUXを保証しない。

rawアーティファクトの保存先は次のとおり。

`/home/hermes/.hermes/work/thinaticsystem-modernization/candidate-browser-final-1.json`

このファイルから、同じディレクトリの `candidate-browser-final-3.json` までを保存した。  
基準版のアーティファクトは変更していない。

## 残った負債と受入条件

- **入れ子の対話的anchorの不具合**

  製品の不具合は意図的に未修正のまま残した。セマンティックな既知不具合テストは失敗する必要がある。  
  契約ゲートは、この登録済みアサーションだけを受け入れる。  
  未知の結果、setupの失敗、実行の欠落、想定外の結果は拒否する。

- **人による確認**

  見た目とスクリーンリーダーによる確認は、別の未完了の受入条件として残った。

- **外部操作の未実施**

  次の操作は行っていない。

  - リモートGitHub Actionsの実行
  - PR作成
  - push
  - Cloudflareへのデプロイ
  - DNS操作
  - CMSへの書込み
  - 稼働中のインフラの変更

- **後続タスクの担当範囲**

  次の作業は、後続タスク `t_4fca1804` の担当として残った。

  - CIワークフロー
  - TypeDoc
  - ローカルのCloudflare向けアーティファクト・deep-link・APIスモーク検査
  - 最終の納品ドキュメント
  - 独立レビュー

## ローカルコミット

この報告書の執筆後、実装はローカルの `ec77351d13da81054024586b904256aaf67dbefa` としてコミットされた。  
このSHAは、push済みまたはリモートレビュー済みを意味しない。
