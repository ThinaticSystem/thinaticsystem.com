# テストの異常と製品の不具合を区別するための修正報告

既知不具合のテストについて、製品の不具合を示すアサーション失敗と、テストの準備・実行中に起きたエラーを区別する仕組みを修正した作業の報告。  
判定に使うエラー情報、RxJSエラーを捕捉する範囲、画像エラーの検査、要件の記述を見直し、両者の区別に関する指摘を解決した。
通常テストと判定処理のテストは成功したが、登録済みの製品不具合9件は失敗したまま残った。

以下は、要件テストの判定とエラーの後始末について、承認を受けて修正した記録。  
対象は `chore/modernization-local` 上の候補実装 `f9a33d0f8b325dbf09d3b4685fd0e597ce0b1bf3`  
現在の受入状態を示すものではない。

## 修正した検査の仕組み

### エラーの種類と発生元による判定

登録済みの失敗を確認する判定処理は、該当する製品不具合による失敗だけを受け入れる必要がある。  
エラー文だけで通過しないよう、Vitest 4の実行情報を出力するreporter `scripts/known-defect-reporter.mjs` を追加した。  
エラーの種類、発生元、ソース位置と、テスト実行基盤（runner）側のエラーを構造化して出力する。

`scripts/known-defect-contract.mjs` は、このreporterのスキーマを判定に使う。  
テスト実行基盤のエラーと未処理エラーがなく、テスト本体の `AssertionError` がmanifest（既知不具合の登録情報）に記載した
アサーションのソース行と完全に一致することを必須にした。  
判定用のテストデータに加え、実際のテストランナーで発生元の異なるエラーを起こすテストを用意し、分類を検査した。

### エラー捕捉と要件テストの範囲

RxJSのテストでは、想定したエラーだけを対象ケースの中で捕捉するようにした。  
`requirements.debt.spec.ts` からモジュール単位の `process.on('uncaughtException')` ハンドラを除き、
スコープを限定した `rxjs.config.onUnhandledError` を使った。
テスト用タイマーを進めて予約されたエラー通知を待ち、想定したエラーと同じオブジェクトかを照合する。  
`finally` でonUnhandledErrorを捕捉前の設定へ戻し、`afterEach` で初期値への復元を確認した。
後始末の検査対象は、捕捉用の設定が後続テストへ残らないことに限られる。  
未実行のタイマーや非同期処理がすべてなくなったことまでは確認していない。

画像エラーのケースは、必要な画像を必ず取得してから検証する形に変えた。  
discographyではAngularの安定化・描画後に、アクセシブルroleに基づくロケータで画像を取得する。
テスト用データの出力がなければ検証基盤の失敗とし、画像がないままイベント送出を省略できる扱いはやめた。

要件の説明も、アサーションが観測する範囲に合わせた。  
blogのローディングケースについて、失敗報告まで検証しているという記述を削除した。
テスト内で生成したclipboardイベントについても、実ブラウザのclipboard操作経路を検証しているという記述を削除した。  
一方、ルート遷移の負債には、新しい記事の内容を観測するアサーションを追加した。

## 検証結果と変更しなかった範囲

`corepack pnpm run check` は成功し、型検査、lint、通常のVitestテスト17ファイル・23テスト、
判定用のテストデータによる検査、実際のテストランナーによる異常系の確認、
登録済みの失敗を確認する判定処理がPASSだった。  
既知不具合テストを実行した子プロセスは終了コード1で、4/4のテスト群と9/9の登録済みアサーションが失敗した。
成功、保留（pending）、未実装（todo）、未処理エラー、テスト実行基盤のエラーは0件だった。  
判定処理の成功は登録した失敗を確認した結果で、製品の修正完了を意味しない。

変更したのはテストの判定とエラーの扱いだけで、製品のコンポーネント、サービス、テンプレート、スタイル、実行時設定には手を加えていない。  
`a21dba1` の `src/` にある追跡対象の製品ソース75ファイルを候補版と比較したところ、
変更パスもバイト単位の不一致も0件で、製品ソースの追加もなかった。
比較からは既知不具合のspecと、すべての `*.spec.*` ファイルを除いた。  
`src/` の変更は、許可されたテスト専用ファイル `src/known-defects/requirements.debt.spec.ts` だけだった。

Nix、CI、デプロイ、稼働中のサービスは変更していない。  
Nixの検証、リモートCI、Cloudflare・本番CMS、デプロイ、見た目の確認、スクリーンリーダー操作、製品の不具合修正は対象外とした。

## 当時の残課題

blogのエラー時処理と並行取得、記事のルート遷移と404時処理、通知の置き換え、discographyのローディングには、
製品側の負債が残った。安全でないHTMLの扱いと、プロバイダーごとのiframe許可方針も解決していない。  
これらは明示的な負債または未定義の方針として意図的に残したもので、この作業で修正したわけでも、受け入れたわけでもない。
要件ごとの失敗と指摘IDは、後述の記録に残した。

## 実行記録

### 実行情報の出力とテストランナーの異常系検査

reporterは、Vitest 4でサポートされた `onHookStart`、`onHookEnd`、`onTestRunEnd` を使い、次の情報を出力した。

- アサーションの識別情報
- エラー名・発生元・ソース位置
- 構造化したrunnerエラーと未処理エラー
- file/describe suiteのカウンタ

実際のテストランナーでは、次の5件のテストケースを実行した。

- アサーションの失敗
- テスト本体の `TypeError`
- `beforeEach` の `TypeError`
- `afterEach` の `TypeError`
- 未処理の非同期 `TypeError`

各テストでは、想定した発生元を構造化して出力することを求めた。  
当時の記録では、5件すべてをテスト実行基盤の失敗として拒否した。

### コマンドと観測結果

当時のコマンド、終了コード、観測結果を原文のまま示す。

| Command | Exit | Observed result |
|---|---:|---|
| `corepack pnpm run check` | 0 | Typecheck PASS; lint PASS; ordinary Vitest 17 files / 23 tests PASS; contract fixtures and real runner probes PASS; strict known-defect gate PASS |
| `node scripts/verify-known-defects-fixtures.mjs` | 0 | Poisoned TypeError report, wrong status, signal, runner error, malformed report, counter, identity, unexpected assertion, and unexpected pass fixtures rejected |
| `node scripts/verify-known-defect-runner-probes.mjs` | 0 | 5/5 real runner probes classified with expected origin/name |
| `corepack pnpm run test:known-defects` | 0 | Supported report schema; raw child status 1; 4/4 failed suites; 9/9 failed registered assertions; 0 passed, pending, todo, unhandled, or runner errors |
| `corepack pnpm exec tsc -p tsconfig.spec.json --noEmit` | 0 | TypeScript verification PASS |
| `git diff --check` | 0 | No whitespace errors |

既知不具合テストの生ログと構造化した実行記録は、次の場所に保存した。

- `.artifacts/known-defects.raw.log`
- `.artifacts/known-defects-report.json`
- `.artifacts/known-defects-result.json`

`/home/hermes/.hermes/work/thinaticsystem-modernization/` にある以前の証拠レポートは変更していない。

### 要件ごとの判定

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

### 指摘事項の状態

テスト境界については、次の指摘を解決した。

- `TB-001-authoritative-error-kind-and-origin`
- `TB-002-scoped-rxjs-error-lifetime`
- `TB-003-required-semantic-image-fixture`
- `TB-004-calibrated-requirement-claims`

製品・方針に関する次の指摘は、未解決のまま残した。

- `DEBT-blog-http-error-loading`
- `DEBT-blog-concurrent-page-order`
- `DEBT-article-route-parameter-transition`
- `DEBT-article-404-loading-cleanup`
- `DEBT-notification-replacement-lifetime`
- `DEBT-discography-loading`
- `SEC-unsafe-html-boundary`
- `POLICY-provider-specific-iframe-allowlist`
