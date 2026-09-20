# ThinaticSystem.com

しなちくシステムのサイト。Angular22のstandalone application builderとpnpmを使用する

## 開発

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm start
```

Nixを使う場合は、ホストのNode/pnpmを混ぜずに同じコマンドを`nix develop -c`から実行する。NixのNodeはAngular22の対応範囲内のNode24で、`.node-version`とflake lockの実バージョン一致をassertする。裸の`pnpm`もCorepack経由のpackageManager pinへ統一する。

```sh
nix develop -c corepack pnpm install --frozen-lockfile
nix develop -c corepack pnpm run check
```

Nix bridgeの実行成否はhost側の`pnpm run check`とは別に記録する。旧remediationのoffline Nix timeout記録は履歴として保持する。現candidateはNixのNode24でinstall/check/build/browserを再検証し、依存更新の制約を`docs/quality.md`へ記録する

開発serverは`http://localhost:4200/`で起動する。通常のproduction artifactは`dist/app/browser/`へ出力される

## 品質コマンド

| Command | Purpose |
|---|---|
| `pnpm run typecheck` | TypeScript compiler check |
| `pnpm run lint` | Angular template/TypeScript lint |
| `pnpm run test` | 通常のVitest unit/component suite |
| `pnpm run test:known-defects:contract` | known-defect checkerのpositive/negative fixture |
| `pnpm run test:known-defects` | 未修正caseの不存在と修正済みsecurity regressionのauthoritative実行 |
| `pnpm run build` | production build |
| `pnpm run docs:check` | TypeDoc生成とentrypoint検査 |
| `pnpm run test:e2e` | synthetic fixtureのChromium/a11y/keyboard/mobile smoke |
| `pnpm run test:paired-contract` | paired計測器のpositive/negative fixture |
| `pnpm run perf:paired` | 同一runnerでhistorical baselineとcandidateをfresh計測・比較 |
| `pnpm run test:budget-contract` | 承認済み性能予算の判定器・証跡検証fixture |
| `pnpm run deploy:check` | Nodeのfixture serverによるHTTP契約検査（Cloudflare実行ではない） |
| `pnpm run check` | typecheck、lint、unit、known-defect・性能予算contract gate |

ブラウザーを手動指定する場合は`BROWSER_EXECUTABLE_PATH=/path/to/chrome`を設定する。e2eはlive CMS、patron API、外部サイトへ接続しない。生成された検査成果物は`.artifacts/`に置かれる

`perf:paired`の旧readinessは旧loading画像を前提にしたhistorical comparisonであり、現行のicon-only feedbackのpending・装飾的exitの完了を証明しない。旧controlとraw結果は書き換えず、[品質契約](docs/quality.md)に未解決の最終検証条件を分離する。`perf:check`単体の既定baselineは歴史資料であり、現版の受入には使わない

## ブランチと配信の事実

- `master`: 本番としてREADMEに記載されているbranch
- `develop`: beta/PR先としてREADMEに記載されているbranch
- このmigrationの基準SHAは`33b4ef4e8d21276130127a61aede6f0a8e1c47cb`である
- Cloudflare account、branch binding、remote Actions実行、本番deploy、DNS変更はこのrepositoryのlocal checkでは確認しない

既存の配信責務`/workers/*`はSPA fallbackと別のAPIである。`docs/quality.md`、`docs/architecture.md`、`typedoc.json`に品質契約と境界を記録している

## 依存関係の自動更新

Renovateの対象・互換性制約・App有効化手順は[依存更新方針](docs/dependency-updates.md)を参照する。自動マージは行わない。
