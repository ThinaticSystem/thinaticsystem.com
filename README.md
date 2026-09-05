# ThinaticSystem.com

しなちくシステムのサイト。Angular22のstandalone application builderとpnpmを使用する

## 開発

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm start
```

開発serverは`http://localhost:4200/`で起動する。通常のproduction artifactは`dist/app/browser/`へ出力される

## 品質コマンド

| Command | Purpose |
|---|---|
| `pnpm run typecheck` | TypeScript compiler check |
| `pnpm run lint` | Angular template/TypeScript lint |
| `pnpm run test` | 通常のVitest unit/component suite |
| `pnpm run test:known-defects:contract` | known-defect checkerのpositive/negative fixture |
| `pnpm run test:known-defects` | 登録済みnested-anchor failureのraw実行とfail-closed gate |
| `pnpm run build` | production build |
| `pnpm run docs:check` | TypeDoc生成とentrypoint検査 |
| `pnpm run test:e2e` | synthetic fixtureのChromium/a11y/keyboard/mobile smoke |
| `pnpm run perf:check` | baselineとのartifact/request/route比較 |
| `pnpm run deploy:check` | Cloudflare相当のlocal HTTP serving検査 |
| `pnpm run check` | typecheck、lint、unit、known-defect gate |

ブラウザーを手動指定する場合は`BROWSER_EXECUTABLE_PATH=/path/to/chrome`を設定する。e2eはlive CMS、patron API、外部サイトへ接続しない。生成された検査成果物は`.artifacts/`に置かれる

## ブランチと配信の事実

- `master`: 本番としてREADMEに記載されているbranch
- `develop`: beta/PR先としてREADMEに記載されているbranch
- このmigrationの基準SHAは`33b4ef4e8d21276130127a61aede6f0a8e1c47cb`である
- Cloudflare account、branch binding、remote Actions実行、本番deploy、DNS変更はこのrepositoryのlocal checkでは確認しない

既存の配信責務`/workers/*`はSPA fallbackと別のAPIである。`docs/quality.md`、`docs/architecture.md`、`typedoc.json`に品質契約と境界を記録している。詳細なagent向け制約は`AGENTS.md`を参照する
