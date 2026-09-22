# ThinaticSystem.com

ブログや音楽作品を公開する、しなちくシステムのWebサイト  
Angularで画面を構成し、記事や作品の情報をCMSから読み込む

## 開発環境

Nodeとpnpmのバージョンは、リポジトリの設定に合わせる  
`.node-version`でNodeのバージョンを確認し、Corepack経由でpnpmを実行する

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm start
```

開発サーバーは`http://localhost:4200/`で起動する

Nixを使う場合は、同じ開発環境を次のコマンドで利用できる

```sh
nix develop -c corepack pnpm install --frozen-lockfile
nix develop -c corepack pnpm start
```

依存パッケージの更新条件は[依存関係の更新]を参照

## テストとビルド

変更後は、通常のチェックとビルドを実行する

```sh
corepack pnpm run check
corepack pnpm run build
```

`check`は、開発中に必要な検査をまとめて実行する  
ビルドしたサイトは`dist/app/browser/`へ出力される

ブラウザー上での操作や性能もCIで検証する  
各テストの実行方法と確認できる範囲は[テストと検証]を参照

## 配信

- `master`：本番配信用のブランチ
- `develop`：開発用のブランチ、PRの反映先

サイトはCloudflare Pagesで配信する  
ローカルのビルドやテストとは別に、配信先の設定と実際の動作を確認する

## 開発用ドキュメント

- **[アプリの構成]**

  画面・CMS・APIの役割と、それぞれのつながり

- **[テストと検証]**

  開発中に使うテストと、結果を判断するときの確認範囲

- **[依存関係の更新]**

  Renovateによる更新PRの運用と、バージョンの互換性

コードから生成するAPIドキュメントは、`corepack pnpm run docs:check`で出力できる

[アプリの構成]: docs/architecture.md
[テストと検証]: docs/quality.md
[依存関係の更新]: docs/dependency-updates.md
