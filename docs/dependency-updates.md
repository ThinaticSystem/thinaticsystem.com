# Renovateによる依存関係の更新

依存パッケージの更新は、Renovateが作成したPRをCIとレビューで確認してから採用する。
更新先は`develop`に限定し、自動マージは行わない。

`renovate.json`は、ホスト型のRenovate GitHub Appに更新方針を指定する設定ファイル。
この設定自体はAppのインストール、セルフホストbotの実行、PRのマージ、サイトのデプロイを行わない。

## 更新PRの扱い

通常のPRは月曜00:00–05:59 Asia/Tokyoに作成を許可し、未完了PRは最大3件、新規PRは1時間に2件までとする。
実際の実行時刻はホストサービス側のスケジュールで決まるため、この時間帯は開始時刻の保証ではない。
本番用の`master`へ更新PRを出さないよう、`baseBranchPatterns`を明示したままにする。

major更新は、PR作成前にDependency Dashboardでの承認を必要とする。
PR作成の承認とマージの承認は別で、更新内容はCIとレビューを通して確認する。

Appが依存関係のセキュリティアラートを取得できる場合は、Renovateの脆弱性処理を使う。
脆弱性対応は通常のスケジュールやPR数の制限を迂回する場合があるため、定期更新を脆弱性対応のSLAと見なさない。

### 更新対象ごとの方針

| 更新対象 | 扱い |
| --- | --- |
| npm依存関係とpnpm | Renovateのnpm managerを使用。integrityで固定したpnpmの`packageManager`も対象とし、通常のnpmリリースは7日待つ |
| Angular関連パッケージ | framework・build・template-lintを同じグループにまとめる。major更新はRenovate標準のmajor/minor分離に従う |
| TypeScript ESLint | Angularとは別グループにまとめる |
| GitHub Actions | SHA digest固定を維持する |
| 設定のvalidator | `.github/workflows/renovate-config.yml`内のバージョンを対象を絞った正規表現で検出する。アプリケーションの依存関係には含めない |
| lockfile maintenance | 毎月1日00:00–05:59 JSTに実施し、Dashboardでの承認を必要とする |
| Nixのinput/lock | 更新には承認を必要とする。マージの許可は兼ねない |

pnpmの既存のpeer、engine、build-script、release-ageチェックは維持する。
lockfileの更新を通すために、release-ageの除外設定を自動追加しない。
パッケージのグループ化だけではpeer依存関係の互換性を証明できないため、frozen installとテストで判断する。

### 互換性のための更新制限

次の制限は、移行時の検証結果に基づいて設けている。
Renovateがすべての互換性制約をpeer依存関係から推定するわけではないため、
フレームワークの変更時と定期的な依存関係の保守時に見直す。

| 依存関係 | 現在許可する範囲 | 制限を外す条件 |
| --- | --- | --- |
| TypeScript | `>=6.0.0 <6.1.0` | Angularのcompiler/buildとTypeDocのpeer範囲を合わせて確認する |
| Vitest | `>=4.0.8 <5.0.0` | Angular buildのpeer範囲を確認し、テストランナーの契約テストを再実行する |
| KaTeX | `>=0.16.0 <0.17.0` | ngx-markdownのpeer範囲と数式の描画を確認する |
| Tailwind | `>=3.0.0 <4.0.0` | 表示と性能の移行を別途完了する。過去のv4回帰の証拠は保持する |
| `@types/node` | `>=24.0.0 <25.0.0` | 実際の変更版の実行環境と合わせて更新する |

制限によってセキュリティ修正が保留になる場合は、関係する更新を明示的に調整して対処する。黙って抑制しない。

### NodeとNixの確認手順

npmの`engines.node`更新は意図的に無効化している。
ロック済みのflakeは、変更版（candidate）のNodeを`.node-version`と照合し、
過去の比較元（baseline）のNodeを`.baseline-node-version`と照合する。
engineだけの更新や、内容を確認しないNix lockの再生成は、有効な実行環境の更新とは扱わない。

NixのPRでは、次の順で確認する。

1. **両方のNodeバージョンを確認**

   提供されるcandidateとbaselineのNodeを確認し、必要に応じてバージョンファイルとenginesを合わせて更新する。

2. **既存の検証を実行**

   `nix develop -c node --version`に加え、既存のインストール、チェック、ビルド、ペア比較テストを実行する。

アサーションの失敗は更新を止める理由で、チェックを削除する理由にはならない。
過去のbaselineを変更する場合は、別途レビューを必要とする。
PASSを作るために、過去の証拠や比較条件を固定するcontrol hashを書き換えない。

## Appを有効化する手順

GitHubのデフォルトブランチは現在`master`。
Renovateは、更新先が別ブランチでも、通常はデフォルトブランチから設定を読む。
モダナイゼーションPRの対象は`develop`で、この作業では自動マージしない。
設定を`develop`だけにマージしても、Renovateが有効になったとは確認できない。

1. **既存のAppインストールを確認**

   必要な場合のみ、[Mend Renovate][renovate-app]を**ThinaticSystem/thinaticsystem.comだけ**にインストールする。
   全リポジトリへのアクセス権を付与せず、このリポジトリにPATを追加しない。
   リポジトリまたは組織の管理者によるAppアクセスの承認が必要な場合がある。

2. **設定のみの変更を別途レビュー**

   `master`にも同名の`renovate.json`を配置する。
   `baseBranchPatterns: ["develop"]`と`useBaseBranchConfig: "merge"`を維持する。
   フレームワーク固有の方針は、対応するモダナイゼーションが`develop`に入った後にのみ有効化する。

   `master`の設定変更が既存サイトのデプロイを起動するかを確認してから、その変更を承認する。

3. **Appの実際の動作を確認**

   Appのonboarding PR、Dependency Dashboard、最初の実更新PRを確認し、次の条件を確かめる。

   - 更新先のbaseは`develop`
   - automergeは無効
   - lockfileの生成は成功
   - アプリケーションCIの実行

   取得できないApp/CIの証拠は、そのまま未確認として記録する。
   確認を省くために広範な書き込み権限を有効にしない。

Appのインストールだけでも、ローカルで設定が妥当と判定されただけでも、botの稼働は確認できない。
Appのsecretは、ブラウザのバンドルにもリポジトリにも置かない。

## 設定を検証する方法

独立した`Renovate configuration` workflowで、バージョンを固定した公式validatorを使う。
このworkflowはbotを実行せず、設定だけを検証する。
リポジトリ権限は読み取り専用とし、checkout credentialsとnpm install scriptsは使わない。
依存関係はアプリケーションの`node_modules`の外に取得し、アプリケーションのlockfileは変更しない。

workflowで固定したバージョンを使い、次のコマンドで再現できる。

```sh
npm_config_ignore_scripts=true npm exec --yes --package=renovate@44.103.7 -- renovate-config-validator --strict --no-global renovate.json
```

依存関係の抽出だけを確認する場合は、隔離したコピーで同じRenovateバージョンを使い、
`--platform=local --dry-run=extract`を指定する。
この実行はブランチやPRを作成せず、Appの権限、ホストサービスのスケジュール、
ブランチの選択、実際のlockfile再生成も検証しない。ログはコミット対象のソースに含めない。

## 公式資料

- [設定](https://docs.renovatebot.com/configuration-options/)
- [Nix manager](https://docs.renovatebot.com/modules/manager/nix/)
- [onboarding](https://docs.renovatebot.com/getting-started/installing-onboarding/)
- [検証](https://docs.renovatebot.com/config-validation/)

[renovate-app]: https://github.com/apps/renovate
