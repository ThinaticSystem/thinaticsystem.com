# 検証報告：CI・TypeDoc・配信検査・性能比較

この報告書は当時の実施記録を残したもの。現在の受入状態を示すものではない。  
成功・失敗の判定や未実施事項は、以下の検証時点の記録として読む。

- 日付：2026-09-05
- リポジトリ：`/home/hermes/projects/thinaticsystem.com`
- ブランチ：`chore/modernization-local`
- 検証した候補コミット：`da9b15c48190d5759e605aebcba649f37258a3f5`
- 承認済みの比較基準：`33b4ef4e8d21276130127a61aede6f0a8e1c47cb`

## 作業範囲と権限

Mission Dの承認済み範囲として、次の項目を追加した。

- CIワークフロー
- TypeDoc
- 合成フィクスチャによるブラウザ・アクセシビリティ・キーボード・モバイル検証の証拠
- サイズ・リクエスト数・ルート別の比較
- Cloudflare互換のローカルHTTPスモーク検査
- README・品質・アーキテクチャのドキュメント

次の操作は実施していない。

- push
- PR作成
- merge
- リモートCI
- Cloudflareアカウントの確認
- preview・deploy
- DNS操作
- CMSへの書込み

`AGENTS.md` の追加は試みたが、作成できなかった。  
エージェント指示用の保護ファイルへの書込み承認が、headless実行中にタイムアウトしたため。  
保護は迂回せず、未完了事項としてこの報告書に残した。

## コマンドと終了コード

当時の実行記録を原文のまま示す。

| Command | Exit | Evidence |
|---|---:|---|
| `corepack pnpm install --frozen-lockfile --offline --reporter=append-only` | 0 | `.artifacts/install.log` |
| `corepack pnpm run check` | 0 | `.artifacts/check.log` |
| `NG_BUILD_MAX_WORKERS=2 corepack pnpm run build` | 0 | `.artifacts/build.log`, `dist/app/browser/` |
| `corepack pnpm run docs:check` | 0 | `.artifacts/docs.log`, `.artifacts/typedoc/` |
| `corepack pnpm run test:e2e` | 0 | `.artifacts/e2e.log`, `.artifacts/browser-smoke.json`, `.artifacts/screenshots/` |
| `corepack pnpm run perf:check` | 0 | `.artifacts/perf.log`, `.artifacts/performance.json` |
| `corepack pnpm run deploy:check` | 0 | `.artifacts/deploy.log` |
| `git diff --check` | 0 | terminal verification |

`check` の結果は、通常テストと既知不具合の検査を分けて読む必要がある。

- **通常テスト**

  17 test files / 19 testsがPASSだった。

- **既知不具合の契約フィクスチャ**

  known-defect contract fixtureはPASSだった。

- **既知不具合のraw runner**

  登録済みのnested interactive-anchor assertion 1件だけが実際にFAILした。  
  ゲート自身の終了コードは0だった。runner/setup/importの失敗や想定外の成功はなかった。

## ブラウザとアクセシビリティの証拠

`test:e2e` は、次の条件で3回反復した。

- Chromium：`140.0.7339.16`
- 実行ファイル：`/home/hermes/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`
- デスクトップ：`1280x900`
- モバイル：`375x812`
- モーション設定：`reducedMotion=reduce`
- データ：合成CMS/APIフィクスチャ

検証した操作経路は、すべて完了した。

- home
- theme toggle
- blog list
- article
- back
- discography
- mobile menu/blog

各反復で、次の件数はいずれも0件だった。

- axe violations
- console error
- page error
- failed request
- blocked external request

キーボード操作、フォーカス、モバイルのreflowも記録した。  
reflowの値はscrollWidth=clientWidth=375だった。

手動の見た目確認と代表的なスクリーンリーダー操作は、自動実行していないため未完了として残った。  
axeのPASSを、スクリーンリーダーの使いやすさの証明とは扱わない。

## 性能比較

`perf:check` は、承認済みの基準版と同じ圧縮条件でアーティファクトを比較した。

- gzip：level9/mtime0
- Brotli：quality11

| 初期アセット | 基準版から候補版への変化（bytes） | 差分（bytes） |
|---|---|---:|
| raw | `531195 -> 433060` | `-98135` |
| gzip | `155551 -> 127352` | `-28199` |
| Brotli | `136693 -> 112405` | `-24288` |

代表的な操作経路のリクエスト数は、すべて基準版以下だった。例を示す。

- home：12 vs 13
- mobile menu：18 vs 19

時間は3回反復の中央値として `.artifacts/performance.json` に保存した。  
ローカルの実験環境で得た時間は、実環境のUXを保証しない。測定のばらつきだけで性能優位を主張しない。

## ローカル配信のスモーク検査

`dist/app/browser` を127.0.0.1限定のサーバーで配信し、次の項目を検査した。

- `/blog` と `/blog/article/1` のdeep-link
- 未知のSPA route
- `/workers/patrons` のGET：JSON 200
- 同APIのPOST：JSON 405
- 未知のAPI：JSON 404
- 存在しないアセット：404

APIをSPAのHTML fallbackへ混ぜずに検査した。デプロイは行っていない。

## 必須検査と残った未完了事項

以下のチェック状態は、当時の記録を示す。

- [x] frozen install
- [x] TypeScriptの型検査
- [x] Angular lint
- [x] 単体・コンポーネントテスト
- [x] 厳格な既知不具合の契約検査と異常系フィクスチャ
- [x] 本番ビルド
- [x] 警告なしのTypeDoc生成
- [x] Playwrightによるセマンティックな操作・ブラウザ・アクセシビリティ・キーボード・モバイルの証拠
- [x] 比較可能なサイズ・リクエスト数・ルート別時間の証拠
- [x] Cloudflare互換のローカルアーティファクト・deep-link・API・アセットのスモーク検査
- [x] `.github/workflows/ci.yml` の最小権限・SHA固定のGitHub Actionsワークフロー
- [ ] リモートGitHub Actionsの実行（未実施、PASSとは報告しない）
- [ ] 人による見た目とスクリーンリーダーの確認
- [ ] Cloudflareのアカウント・プロジェクト・ブランチ紐付け・preview・本番デプロイの検証
- [ ] 最小構成の `AGENTS.md`（保護ファイルの書込み承認を取得できず）

PR作成、push、mergeに加え、publishも行っていない。  
デプロイやDNS・CMS・インフラの変更も行っていない。
