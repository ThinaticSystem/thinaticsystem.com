# 検証報告：CI・TypeDoc・配信検査・性能比較

Angular移行後の候補版にCIワークフローとTypeDocを追加し、ブラウザ操作、性能、ローカル配信を検証した作業の報告。  
ローカルの必須検査は成功し、初期アセットと代表的な操作経路のリクエスト数は基準版以下だった。
ただし、登録済みの製品不具合は失敗したままで、リモートCI、実際のCloudflare配信、人によるアクセシビリティ確認は未検証として残った。

以下は2026-09-05に、Mission Dの承認済み範囲で行った作業の記録。現在の受入状態を示すものではない。

## 追加した検証とドキュメント

候補版の品質を継続して確認するため、CIワークフロー、TypeDoc、README・品質・アーキテクチャのドキュメントを追加した。  
`.github/workflows/ci.yml` は最小権限とSHA固定を使う構成にしたが、リモートでの実行はこの作業に含めていない。

動作確認ではCMS/APIの応答をテスト用データへ差し替え、ブラウザ操作に加えてアクセシビリティ、キーボード、モバイルの記録を取得した。  
性能は承認済みの基準版に対して、初期アセットのサイズ、リクエスト数、ルート別の時間を比較した。

配信検査の対象は自前のローカルHTTPサーバーで、Cloudflareでの実配信や互換性を検証したものではない。  
このサーバーで、静的ファイルとテスト用APIの応答を分けて確認した。

## ローカル検証の結果

インストール、型検査、lint、本番ビルド、TypeDoc生成、ブラウザ検証、性能比較、配信検査はすべて成功した。  
`check` では通常テスト17ファイル・19件と、登録済みの失敗を確認する判定処理のテストケースがPASSだった。
一方、既知不具合テストの生の実行結果では、操作可能なリンクの入れ子に対する登録済みアサーション1件だけが実際にFAILした。  
判定処理の終了コード0は、この登録済みの失敗を確認した結果を示す。
テストの実行基盤、準備処理、importの失敗や想定外の成功はなく、製品不具合そのものを修正したわけではない。

ブラウザ検証では、homeからテーマ切替、blog一覧、記事、戻る操作、discography、モバイルメニューからblogへの移動を確認した。  
3回の反復ですべての操作経路を完了し、axeによる違反の検出、コンソールエラー、ページエラー、
リクエスト失敗、外部リクエストのブロックはいずれも各反復で0件だった。
キーボード操作とフォーカスも記録し、モバイルでは内容の幅と表示領域の幅が一致した（scrollWidth=clientWidth=375）。

性能比較では、初期アセットのraw・gzip・Brotliのサイズが減少し、代表的な操作経路のリクエスト数もすべて基準版以下だった。  
homeは12対13、mobile menuは18対19だった。
時間は3回反復の中央値を `.artifacts/performance.json` に保存したが、
ローカルの実験環境で得た値に限られる。測定のばらつきだけで性能優位を主張せず、実環境のUXを保証する値とも扱わない。

配信検査では `dist/app/browser` を127.0.0.1限定のサーバーで配信し、
画面URLへの直接アクセスと、アプリに未登録の画面URLへの応答を確認した。  
APIの成功・メソッド不許可・未知のパスと、存在しないアセットの応答も検査し、
APIへの応答として画面用のHTMLを返さないことを確認した。実際のデプロイは行っていない。

## 当時の未完了事項

手動の見た目確認と代表的なスクリーンリーダー操作は未完了として残った。  
axeのPASSは自動検査の結果に限られ、スクリーンリーダーの使いやすさを証明しない。
リモートGitHub Actionsの実行と、Cloudflareのアカウント・プロジェクト・ブランチ紐付け・preview・本番デプロイの検証も未実施だった。

最小構成の `AGENTS.md` は追加を試みたものの、作成できなかった。  
エージェント指示用の保護ファイルへの書込み承認がheadless実行中にタイムアウトしたため、
保護を迂回せず未完了として残した。

外部操作として、push、PR作成、merge、publish、リモートCI、Cloudflareアカウントの確認、preview・deploy、
DNS操作、CMSへの書込み、インフラの変更は行っていない。

## 実行記録

### 作業対象

- 日付：2026-09-05
- リポジトリ：`/home/hermes/projects/thinaticsystem.com`
- ブランチ：`chore/modernization-local`
- 検証した候補コミット：`da9b15c48190d5759e605aebcba649f37258a3f5`
- 承認済みの比較基準：`33b4ef4e8d21276130127a61aede6f0a8e1c47cb`

### コマンドと終了コード

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

### ブラウザの実行条件

`test:e2e` は、次の条件で3回反復した。

- Chromium：`140.0.7339.16`
- 実行ファイル：`/home/hermes/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`
- デスクトップ：`1280x900`
- モバイル：`375x812`
- モーション設定：`reducedMotion=reduce`
- データ：CMS/APIの応答を差し替えるテスト用データ

記録した操作経路はhome、theme toggle、blog list、article、back、discography、mobile menu/blog。

### 初期アセットの比較

`perf:check` では、基準版と同じgzip level9/mtime0、Brotli quality11で比較した。

| 初期アセット | 基準版から候補版への変化（bytes） | 差分（bytes） |
|---|---|---:|
| raw | `531195 -> 433060` | `-98135` |
| gzip | `155551 -> 127352` | `-28199` |
| Brotli | `136693 -> 112405` | `-24288` |

### ローカル配信の検査項目

- `/blog` と `/blog/article/1` への直接アクセス
- アプリに未登録の画面URLへの応答
- `/workers/patrons` のGET：JSON 200
- 同APIのPOST：JSON 405
- 未知のAPI：JSON 404
- 存在しないアセット：404

### 必須検査の実施状態

以下のチェック状態は、当時の記録を示す。

- [x] frozen install
- [x] TypeScriptの型検査
- [x] Angular lint
- [x] 単体・コンポーネントテスト
- [x] 厳格な既知不具合の判定処理と異常系のテストケース
- [x] 本番ビルド
- [x] 警告なしのTypeDoc生成
- [x] Playwrightによる役割や名前で特定した要素の操作と、ブラウザ・アクセシビリティ・キーボード・モバイルの検証記録
- [x] 比較可能なサイズ・リクエスト数・ルート別時間の証拠
- [x] 自前のローカルHTTPサーバーでのビルド成果物・画面URLへの直接アクセス・API・静的ファイルの検査
- [x] `.github/workflows/ci.yml` の最小権限・SHA固定のGitHub Actionsワークフロー
- [ ] リモートGitHub Actionsの実行（未実施、PASSとは報告しない）
- [ ] 人による見た目とスクリーンリーダーの確認
- [ ] Cloudflareのアカウント・プロジェクト・ブランチ紐付け・preview・本番デプロイの検証
- [ ] 最小構成の `AGENTS.md`（保護ファイルの書込み承認を取得できず）
