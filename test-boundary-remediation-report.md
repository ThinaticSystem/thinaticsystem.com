# テスト境界の是正報告

この報告書は当時の実施記録を残したもの。現在の受入状態を示すものではない。  
検証結果と未解決事項は、以下の候補版に対する記録として読む。

## 作業範囲

実行可能な要件のテスト境界について、承認済みの後続是正を行った。  
候補実装のコミットは、`chore/modernization-local` 上の `f9a33d0f8b325dbf09d3b4685fd0e597ce0b1bf3`。

次の対象は変更していない。

- 製品のコンポーネント
- サービス
- テンプレート
- スタイル
- 実行時設定
- Nix
- CI
- デプロイ
- 稼働中のサービス

## テスト境界の修正

- **Vitest reporterの追加**

  `scripts/known-defect-reporter.mjs` は、Vitest 4の小さなreporterとして実装した。  
  サポートされたライフサイクル `onHookStart`、`onHookEnd`、`onTestRunEnd` を使い、次の情報を出力する。

  - アサーションの識別情報
  - エラー名
  - エラーの発生元
  - ソース位置
  - 構造化したrunnerエラー
  - 未処理エラー
  - file/describe suiteのカウンタ

- **契約ゲートの判定根拠**

  `scripts/known-defect-contract.mjs` は、次の条件を必須にした。  
  エラー文だけではゲートを通過できない。

  - 判定根拠となるreporterのスキーマ
  - runnerエラーと未処理エラーのコレクションが空
  - テスト本体からの `AssertionError`
  - manifestに記載したアサーションのソース行との完全一致

- **実runnerによるプローブ**

  次のフィクスチャを実際のrunnerで実行した。

  - アサーションの失敗
  - テスト本体の `TypeError`
  - `beforeEach` の `TypeError`
  - `afterEach` の `TypeError`
  - 未処理の非同期 `TypeError`

  各プローブには、想定した発生元を構造化して出力することを求めた。  
  当時の記録では、5件すべてをrunnerの失敗として拒否した。

- **RxJSエラー捕捉のスコープ**

  `requirements.debt.spec.ts` から、モジュール単位の `process.on('uncaughtException')` ハンドラを除いた。  
  想定したRxJSフィクスチャのエラーは、スコープを限定した `rxjs.config.onUnhandledError` の境界で捕捉する。

  捕捉と後始末には、次の仕組みを使った。

  - オブジェクト同一性による照合
  - 決定的なタイマーのフラッシュ
  - `finally` での復元
  - `afterEach` での漏れがないことのアサーション

- **discography画像エラーの検査**

  Angularの安定化・描画後に、必須のアクセシブルroleロケータで画像を取得するようにした。  
  フィクスチャの出力がなければ検証基盤の失敗とし、省略可能なイベント送出として受け入れない。

- **要件の記述とアサーション**

  blogのローディングケースについて、失敗報告まで検証しているという記述をやめた。  
  合成clipboardイベントについても、実ブラウザのclipboard操作経路を検証しているという記述をやめた。

  ルート遷移の負債には、記事内容を観測するアサーションを含めた。

## 検証の証拠

当時のコマンド、終了コード、観測結果を原文のまま示す。

| Command | Exit | Observed result |
|---|---:|---|
| `corepack pnpm run check` | 0 | Typecheck PASS; lint PASS; ordinary Vitest 17 files / 23 tests PASS; contract fixtures and real runner probes PASS; strict known-defect gate PASS |
| `node scripts/verify-known-defects-fixtures.mjs` | 0 | Poisoned TypeError report, wrong status, signal, runner error, malformed report, counter, identity, unexpected assertion, and unexpected pass fixtures rejected |
| `node scripts/verify-known-defect-runner-probes.mjs` | 0 | 5/5 real runner probes classified with expected origin/name |
| `corepack pnpm run test:known-defects` | 0 | Supported report schema; raw child status 1; 4/4 failed suites; 9/9 failed registered assertions; 0 passed, pending, todo, unhandled, or runner errors |
| `corepack pnpm exec tsc -p tsconfig.spec.json --noEmit` | 0 | TypeScript verification PASS |
| `git diff --check` | 0 | No whitespace errors |

既知不具合のraw記録と構造化アーティファクトは、次の場所に保存した。

- `.artifacts/known-defects.raw.log`
- `.artifacts/known-defects-report.json`
- `.artifacts/known-defects-result.json`

`/home/hermes/.hermes/work/thinaticsystem-modernization/` にある以前の証拠レポートは変更していない。

## 要件ごとの判定

以下は、当時の判定とソース位置を含む原表。  
`expectedFAIL` は登録済みの失敗を示し、製品の修正完了を意味しない。

| ID | Status | Evidence |
|---|---|---|
| `blog-card-nested-anchor` | expectedFAIL | Semantic anchor/focus assertion at `src/known-defects/blog-card.nested-anchor.spec.ts:26` |
| `blog-http-error-loading` | expectedFAIL | Scoped RxJS identity capture; loading assertion at `src/known-defects/requirements.debt.spec.ts:96` |
| `blog-concurrent-page-order` | expectedFAIL | Late older response assertion at `src/known-defects/requirements.debt.spec.ts:115` |
| `article-route-parameter-transition` | expectedFAIL | New article-content assertion at `src/known-defects/requirements.debt.spec.ts:136` |
| `article-404-loading-cleanup` | expectedFAIL | Redirect/loading assertion at `src/known-defects/requirements.debt.spec.ts:154` |
| `notification-replacement-lifetime` | expectedFAIL | Replacement timer assertion at `src/known-defects/requirements.debt.spec.ts:166` |
| `discography-empty-loading` | expectedFAIL | Empty-result loading assertion at `src/known-defects/requirements.debt.spec.ts:178` |
| `discography-image-error-loading` | expectedFAIL | Required semantic image locator/error assertion at `src/known-defects/requirements.debt.spec.ts:193` |
| `unsafe-html-content` | expectedFAIL / security review | Unsafe-content assertion at `src/known-defects/requirements.debt.spec.ts:200`; no security remediation claimed |

## 指摘事項の扱い

### 解決したテスト境界の指摘

- `TB-001-authoritative-error-kind-and-origin`
- `TB-002-scoped-rxjs-error-lifetime`
- `TB-003-required-semantic-image-fixture`
- `TB-004-calibrated-requirement-claims`

### 未解決のまま残した製品・方針の指摘

次の項目は、明示的な負債または未定義の方針として意図的に残した。  
この作業で修正したわけでも、受け入れたわけでもない。

- `DEBT-blog-http-error-loading`
- `DEBT-blog-concurrent-page-order`
- `DEBT-article-route-parameter-transition`
- `DEBT-article-404-loading-cleanup`
- `DEBT-notification-replacement-lifetime`
- `DEBT-discography-loading`
- `SEC-unsafe-html-boundary`
- `POLICY-provider-specific-iframe-allowlist`

## 保護対象ソースの確認

`a21dba1` の `src/` にある追跡対象の製品ソース75ファイルを、候補版と比較した。  
既知不具合のspecと、すべての `*.spec.*` ファイルは比較対象から除いた。

変更パスは0件で、バイト単位の不一致も0件だった。製品ソースの追加もなかった。  
`src/` の変更は、許可されたテスト専用ファイル `src/known-defects/requirements.debt.spec.ts` だけだった。

次の作業は対象外として残った。

- Nix
- リモートCI
- Cloudflare・本番CMS
- デプロイ
- 見た目の確認
- スクリーンリーダー操作
- 製品の不具合修正
