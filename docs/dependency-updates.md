# Renovateによる依存関係の更新

`renovate.json`は、ホスト型のRenovate GitHub Appを設定する。次の操作は行わない。

- Appのインストール
- セルフホストbotの実行
- PRのマージ
- サイトのデプロイ

## 更新方針

### PRの作成とレビュー

- **更新先は`develop`**

  本番用の`master`は対象にしない。`baseBranchPatterns`を明示したままにする。

- **通常PRの作成枠**

  月曜00:00–05:59 Asia/Tokyoに限定し、未完了PRは最大3件、新規PRは1時間に2件までとする。  
  実際の実行時刻はホストサービス側のスケジュールで決まる。この枠は作成を許可する時間帯で、開始時刻の保証ではない。

- **自動マージなし**

  既存のアプリケーションCIとレビューを必須とする。  
  major更新は、PR作成前にDependency Dashboardでの承認を必要とする。

- **脆弱性対応の例外**

  Appが依存関係のセキュリティアラートを取得できる場合は、Renovateの脆弱性処理を使う。  
  通常のスケジュールやPR数の制限を迂回する場合があるため、定期更新を脆弱性対応のSLAと見なさない。

### 更新対象ごとの扱い

- **npmとpnpm**

  npm依存関係と、integrityで固定したpnpmの`packageManager`には、Renovateのnpm managerを使う。  
  通常のnpmリリースは7日待つ。pnpmの次の既存チェックは維持する。

  - peer
  - engine
  - build-script
  - release-age

  lock更新を通すために、release-ageの除外設定を自動追加しない。

- **パッケージのグループ化**

  Angularのframework・build・template-lintパッケージをまとめる。  
  major更新はRenovate標準のmajor/minor分離に従い、TypeScript ESLintパッケージは別グループにする。

  グループ化だけではpeer依存関係の互換性を証明できない。frozen installとテストで判断する。

- **GitHub Actionsとvalidator**

  GitHub ActionsのSHA digest固定を維持する。  
  `.github/workflows/renovate-config.yml`内のvalidatorバージョンも、対象を絞った正規表現で検出できるようにする。

  このvalidatorはアプリケーションの依存関係ではない。

- **lockfileとNix**

  月次のlockfile maintenanceは毎月1日00:00–05:59 JSTに行い、Dashboardでの承認を必要とする。  
  Nixのinput/lock更新も承認を必要とする。これらの承認はマージの許可を兼ねない。

## 互換性のための更新制限

次の制限は、移行時の検証結果に基づいて意図的に設けている。今後の保守を不要にするものではない。

| 依存関係 | 現在許可する範囲 | 制限を外す条件 |
| --- | --- | --- |
| TypeScript | `>=6.0.0 <6.1.0` | Angularのcompiler/buildとTypeDocのpeer範囲を合わせて確認する |
| Vitest | `>=4.0.8 <5.0.0` | Angular buildのpeer範囲を確認し、test-runnerの契約テストを再実行する |
| KaTeX | `>=0.16.0 <0.17.0` | ngx-markdownのpeer範囲と数式の描画を確認する |
| Tailwind | `>=3.0.0 <4.0.0` | 表示と性能の移行を別途完了する。過去のv4回帰の証拠は保持する |
| `@types/node` | `>=24.0.0 <25.0.0` | 実際のcandidate runtimeと合わせて更新する |

Renovateは、これらの互換性制約をすべてpeer依存関係から推定するわけではない。  
frameworkの変更時と定期的な依存関係の保守時に制限を見直す。

制限によってセキュリティ修正が保留になる場合は、関係する更新を明示的に調整して対処する。黙って抑制しない。

### NodeとNixの更新

npmの`engines.node`更新は意図的に無効化している。  
lock済みのflakeは、candidate Nodeを`.node-version`と照合し、過去のbaseline Nodeを`.baseline-node-version`と照合する。

engineだけの更新や、内容を確認しないNix lockの再生成は、有効なruntime更新とは扱わない。  
NixのPRでは、次の順で確認する。

1. **両方のNodeバージョンを確認**

   提供されるcandidateとbaselineのNodeを確認し、必要に応じてバージョンファイルとenginesを合わせて更新する。

2. **既存の検証を実行**

   `nix develop -c node --version`に加え、既存のinstall/check/build/paired testsを実行する。

assertionの失敗は更新を止める理由で、チェックを削除する理由にはならない。

過去のbaselineを変更する場合は、別途レビューを必要とする。  
PASSを作るために、過去の証拠やcontrol hashを書き換えない。

## インストールと有効化の境界

GitHubのデフォルトブランチは現在`master`。  
Renovateは、更新先が別ブランチでも、通常はデフォルトブランチから設定を読む。

モダナイゼーションPRの対象は`develop`で、この作業では自動マージしない。  
設定を`develop`だけにマージしても、Renovateが有効になったとは確認できない。

1. **既存のAppインストールを確認**

   必要な場合のみ、[Mend Renovate][renovate-app]を**ThinaticSystem/thinaticsystem.comだけ**にインストールする。  
   全リポジトリへのアクセス権を付与せず、このリポジトリにPATを追加しない。

2. **設定のみの変更を別途レビュー**

   `master`にも同名の`renovate.json`を配置する。  
   `baseBranchPatterns: ["develop"]`と`useBaseBranchConfig: "merge"`を維持する。  
   framework固有の方針は、対応するモダナイゼーションが`develop`に入った後にのみ有効化する。

   `master`の設定変更が既存サイトのデプロイを起動するかを確認してから、その変更を承認する。

3. **Appの実際の動作を確認**

   Appのonboarding PR、Dependency Dashboard、最初の実更新PRを確認し、次の条件を確かめる。

   - baseは`develop`
   - automergeは無効
   - lockfileの生成は成功
   - アプリケーションCIが実行される

   取得できないApp/CIの証拠は、そのまま未確認として記録する。近道として広範な書き込み権限を有効にしない。

Appのインストールだけでも、ローカルで設定が妥当と判定されただけでも、botの稼働を証明できない。  
リポジトリまたは組織の管理者によるAppアクセスの承認が必要な場合がある。

Appのsecretは、ブラウザbundleにもリポジトリにも置かない。

## 設定の検証

独立した`Renovate configuration` workflowで、バージョンを固定した公式validatorを使う。  
このworkflowはbotを実行せず、次の条件で設定だけを検証する。

- リポジトリ権限は読み取り専用
- checkout credentialsは無効
- npm install scriptsは不使用
- 依存関係はアプリケーションの`node_modules`の外に取得
- アプリケーションのlockfileは変更なし

workflowで固定したバージョンを使い、次のコマンドで再現できる。

```sh
npm_config_ignore_scripts=true npm exec --yes --package=renovate@44.103.7 -- renovate-config-validator --strict --no-global renovate.json
```

### 抽出だけを確認する場合

隔離したコピーで同じRenovateバージョンを使い、`--platform=local --dry-run=extract`を指定する。  
この実行はブランチやPRを作成せず、次の項目も検証しない。

- Appの権限
- ホストサービスのスケジュール
- ブランチの選択
- 実際のlockfile再生成

ログはコミット対象のソースに含めない。

## 公式資料

- [設定](https://docs.renovatebot.com/configuration-options/)
- [Nix manager](https://docs.renovatebot.com/modules/manager/nix/)
- [onboarding](https://docs.renovatebot.com/getting-started/installing-onboarding/)
- [検証](https://docs.renovatebot.com/config-validation/)

[renovate-app]: https://github.com/apps/renovate
