# Renovateによる依存関係の更新

依存パッケージの更新は、Renovateの更新PRをCIとレビューで確認してから採用する  
更新先は`develop`に限定し、自動マージは行わない

`renovate.json`は、ホスト型のRenovate GitHub Appに更新方針を指定する設定ファイル  
Appの有効化と動作確認は別途必要で、現在の稼働状況は未確認

## 更新方針

通常のPRは、月曜00:00–05:59 Asia/Tokyoに作成を許可する  
未完了PRは最大3件、新規PRは1時間に2件までとし、実際の実行時刻はホストサービス側のスケジュールに従う

major更新は、PR作成前にDependency Dashboardで承認する  
その後、更新内容をCIとレビューで確認してマージする

Appがセキュリティアラートを取得できる場合は、Renovateの脆弱性対応を利用する  
通常の時間帯やPR数の制限を迂回する場合があり、定期更新のスケジュールとは別に対応状況を確認する

| 更新対象 | 方針 |
| --- | --- |
| npm依存関係とpnpm | npm managerを使用し、integrityで固定したpnpmの`packageManager`も更新対象とする。通常のnpmリリースは7日待つ |
| Angular関連パッケージ | framework・build・template-lintを同じグループにまとめ、major/minorはRenovate標準の規則で分ける |
| TypeScript ESLint | Angularとは別グループにまとめる |
| GitHub Actions | SHA digest固定を維持する |
| 設定のvalidator | `.github/workflows/renovate-config.yml`内のバージョンを、対象を絞った正規表現で検出する。アプリの依存関係とは分けて管理する |
| lockfile maintenance | 毎月1日00:00–05:59 JSTを実施時間帯とし、Dashboardで承認する |
| Nixのinput/lock | 更新前に承認し、マージ時にもレビューする |

pnpmのpeer、engine、build-script、release-ageチェックを維持する  
release-ageの除外設定は自動追加せず、グループ化した更新もfrozen installとテストで互換性を確認する

## バージョンの互換性

Renovateの更新範囲には、フレームワークや描画との互換性を保つための制限を設けている  
フレームワークの変更時と定期的な依存関係の保守時に、次の条件を確認して見直す

| 依存関係 | 許可する範囲 | 制限を見直すときの確認 |
| --- | --- | --- |
| TypeScript | `>=6.0.0 <6.1.0` | Angularのcompiler/buildとTypeDocのpeer範囲 |
| Vitest | `>=4.0.8 <5.0.0` | Angular buildのpeer範囲を確認し、テストランナーの契約テストを再実行する |
| KaTeX | `>=0.16.0 <0.17.0` | ngx-markdownのpeer範囲と数式の描画 |
| Tailwind | `>=3.0.0 <4.0.0` | 表示と性能の移行を別途完了する |
| `@types/node` | `>=24.0.0 <25.0.0` | 実際の変更版で使う実行環境との一致 |

制限によってセキュリティ修正が保留になる場合は、関係する依存パッケージの更新を調整して対処する

### NodeとNixの更新

npmの`engines.node`だけを自動更新しないよう、その更新を無効にしている  
ロック済みのflakeは、変更版（candidate）のNodeを`.node-version`と、
比較元（baseline）のNodeを`.baseline-node-version`と照合する

NixのPRでは、実際に提供される両方のNodeを確認し、必要に応じてバージョンファイルとenginesを合わせる  
lockの再生成だけで済ませず、次のコマンドと既存のインストール、チェック、ビルド、ペア比較テストを実行する

```sh
nix develop -c node --version
```

比較元は性能測定の基準として固定しているため、変更には別途レビューが必要になる

## Appの有効化

GitHubのデフォルトブランチは`master`で、Renovateは通常ここから設定を読む  
設定の読み取り元は`master`、更新PRの反映先は`develop`として分けて扱う

1. **対象リポジトリへのAppアクセスを確認**

   既存のインストールを確認し、必要な場合のみ[Mend Renovate][renovate-app]を
   `ThinaticSystem/thinaticsystem.com`だけにインストールする  
   リポジトリまたは組織の管理者による承認が必要な場合がある

   アクセス権はこのリポジトリに限定し、PATは追加しない  
   Appのsecretはリポジトリやブラウザーのバンドルに置かない

2. **`master`の設定をレビュー**

   `master`にも`renovate.json`を配置し、
   `baseBranchPatterns: ["develop"]`と`useBaseBranchConfig: "merge"`を維持する  
   フレームワーク固有の方針は、対応するモダナイゼーションが`develop`に入った後に有効化する

   設定だけの変更でも、`master`への反映が既存サイトのデプロイを起動するかを確認してから承認する

3. **最初の更新PRで動作を確認**

   Appのonboarding PR、Dependency Dashboard、最初の実更新PRを確認する  
   更新先が`develop`で自動マージが無効になっていること、
   lockfileの生成が成功し、アプリケーションCIが実行されることを確かめる

## 設定の検証

`Renovate configuration` workflowは、バージョンを固定した公式validatorで設定を検証する  
Appの稼働確認は、上記の有効化手順で行う

workflowで固定したバージョンを使い、次のコマンドで設定の検証を再現できる

```sh
npm_config_ignore_scripts=true npm exec --yes --package=renovate@44.103.7 -- renovate-config-validator --strict --no-global renovate.json
```

依存関係の抽出を確認する場合は、隔離したコピーで同じRenovateバージョンを使い、
`--platform=local --dry-run=extract`を指定する  
これは抽出のみの実行で、ブランチやPRの作成、lockfileの再生成は行わない

Appの権限や実際の更新先は、最初の更新PRで確認する

## 公式資料

- [設定](https://docs.renovatebot.com/configuration-options/)
- [Nix manager](https://docs.renovatebot.com/modules/manager/nix/)
- [onboarding](https://docs.renovatebot.com/getting-started/installing-onboarding/)
- [検証](https://docs.renovatebot.com/config-validation/)

[renovate-app]: https://github.com/apps/renovate
