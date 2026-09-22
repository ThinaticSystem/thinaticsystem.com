# ThinaticSystem.com

しなちくシステムのサイトを開発・保守するためのリポジトリ  
Angular 22のstandalone構成を使い、ブラウザー向けのアプリとして配信する

## 開発

Nodeとpnpmは、リポジトリで固定したバージョンを使う  
ホスト環境を使う場合は、`.node-version`と`package.json`を確認してから実行する

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm start
```

開発サーバーは`http://localhost:4200/`で起動する

### Nixを使う場合

ホストのNodeやpnpmを混ぜず、`nix develop -c`から実行する

```sh
nix develop -c corepack pnpm install --frozen-lockfile
nix develop -c corepack pnpm run check
```

Nix環境はAngular 22の対応範囲内のNode 24を使い、  
`.node-version`とflake lockが提供するバージョンの一致を検査する  
`pnpm`を直接呼ぶ場合も、Corepack経由で`packageManager`の固定版を使う

Nix環境とホスト環境の実行結果は分けて記録する  
過去のNix実行で起きたタイムアウトと、その後の再検証については[品質検証]を参照

## 検証

通常のチェックは、依存関係を固定どおりにインストールしてから実行する

```sh
corepack pnpm run check
corepack pnpm run build
```

ビルド結果は`dist/app/browser/`へ出力される  
ブラウザー検査と配信検査には、先にビルドした成果物を使う

### 開発中のチェック

| コマンド | 確認内容 |
|---|---|
| `pnpm run typecheck` | TypeScriptの型 |
| `pnpm run lint` | AngularテンプレートとTypeScriptのlint |
| `pnpm run test` | Vitestによる単体・コンポーネントテスト |
| `pnpm run test:known-defects:contract` | 既知不具合の判定器と異常系fixture |
| `pnpm run test:known-defects` | 未修正caseの不存在と修正済みsecurity regressionの実行 |
| `pnpm run test:budget-contract` | 性能予算の判定器と証拠検証fixture |
| `pnpm run check` | 型・lint・単体テストと上記の契約検査 |

### ビルド後の検証と文書生成

| コマンド | 確認内容 |
|---|---|
| `pnpm run build` | ブラウザー向けのproduction build |
| `pnpm run docs:check` | TypeDocの生成とentrypoint検査 |
| `pnpm run test:e2e` | テスト用データによるChromium上の画面操作・アクセシビリティ |
| `pnpm run perf:current` | 現行CIと同じ方式による性能比較 |
| `pnpm run deploy:check` | Nodeのテスト用サーバーによるHTTP契約検査 |

`test:e2e`は実CMSや支援者API、外部サイトへ接続しない  
ブラウザーを指定する場合は`BROWSER_EXECUTABLE_PATH=/path/to/chrome`を設定する

検査結果と生成文書は`.artifacts/`へ保存する  
これらの成功だけでは、実際のCloudflare配信や人手による操作確認の完了を意味しない

### 過去の性能比較を再現するコマンド

現行の性能検証は[現行性能検証]を参照  
次のコマンドは過去の計測方式を再現するために残している

| コマンド | 用途 |
|---|---|
| `pnpm run test:paired-contract` | 旧比較計測器の正常系・異常系fixture |
| `pnpm run perf:paired` | 同一実行環境で旧版と候補版を新たに測定 |
| `pnpm run perf:check` | 既存の観測結果に対する旧方式の比較 |

`perf:paired`は旧loading画像を前提とした表示完了条件を使うため、  
現在のアイコンだけの読み込み表示の開始・装飾的な終了を検証するものではない

`perf:check`単体の既定baselineも、過去の比較を再現するための資料に限る  
現版の受入には使わない

旧controlと生の測定結果は変更せず、  
現在の受入に必要な条件は[品質検証]で別に扱う

## ブランチと配信

- `master`：本番配信用のブランチ
- `develop`：beta・PRの反映先

ローカルの検査では、Cloudflareのアカウント設定やブランチの接続先を確認しない  
リモートCIの成功や本番への配信、DNS変更も、別途実環境での確認が必要

既存の`/workers/*`は、SPAのHTMLへのフォールバックとは別のAPIとして扱う  
アプリと配信の責務の分担は[構成と境界]を参照

## 依存関係の更新

Renovateは更新PRを提案するために使い、自動マージは行わない  
対象と互換性の制約、Appの有効化手順は[依存更新方針]を参照

## 関連文書

- [品質検証]
- [現行性能検証]
- [構成と境界]
- [依存更新方針]

TypeDocの出力対象は`typedoc.json`で管理する  
今回の移行の比較基準は`33b4ef4e8d21276130127a61aede6f0a8e1c47cb`

[品質検証]: docs/quality.md
[現行性能検証]: docs/current-performance.md
[構成と境界]: docs/architecture.md
[依存更新方針]: docs/dependency-updates.md
