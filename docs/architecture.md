# アプリの構成

ThinaticSystem.comは、CMSのコンテンツをブラウザーで表示するAngularアプリ  
画面の切り替えと表示をアプリが担当し、コンテンツの管理と取得先はCMSに分けている

## 画面とデータ

- **ページの表示と切り替え**

  トップページからブログや作品一覧へ移動できる構成  
  ルーティング設定に従って必要なページを読み込み、ブラウザー内で画面を切り替える

- **記事と作品情報の取得**

  各ページがCMSから必要なデータを取得する  
  記事のMarkdownは表示時にHTMLへ変換し、音楽・動画の埋め込みは専用の処理で扱う

- **支援者情報の取得**

  トップページは`/workers/patrons`へ問い合わせ、取得した支援者の名前を表示する  
  CMSの記事・作品取得とは別のAPIで、画面側は返された情報を使う

APIのサーバー側の実装と配信設定は、このリポジトリには含まれていない

ページの入口は`src/app/app.routes.ts`、CMSの取得先は`cms.thinaticsystem.com`  
CMSとの通信やMarkdownの変換処理は、各機能またはproviderに配置する

埋め込みで許可するサービスと入力の検証方法は、[メディアの埋め込み]を参照

## ビルドと配信

Angular application builderで、ブラウザー向けの静的ファイルを生成する  
出力先は`dist/app/browser`。初期表示後の描画や画面遷移はブラウザー側で処理する

配信時は、ページへの直接アクセスとAPIへのリクエストを区別する必要がある  
`thinaticsystem.com/workers/*`を、SPAのHTMLへフォールバックさせない

ローカルの配信テストで確認する範囲は[テストと検証]を参照

## ソースコードの見方

このアプリは、standalone構成の単一プロジェクトとして保守する  
画面の処理を調べるときは、ルート設定から該当ページのコンポーネントへ進む

| 入口 | 担当 |
| --- | --- |
| `src/app/app.routes.ts` | 各画面へのルーティング |
| `src/app/index/index.component.ts` | トップページと支援者情報の取得 |
| `src/app/blog/` | 記事一覧と本文の表示 |
| `src/app/discography/` | 作品一覧と作品詳細の表示 |
| `src/app/discography/embed/` | 音楽・動画プレーヤーの埋め込み |

コードの説明はTypeDocでも確認できる

<details>
<summary>TypeDocの出力対象</summary>

TypeDocの対象は`typedoc.json`で管理し、生成HTMLを`.artifacts/`へ出力する  
entrypointは、公開を意図した次のコードに限定する

- 設定
- route
- interface
- pipe
- provider
- service

</details>

<details>
<summary>今回の移行に含めない構成</summary>

今回の移行では、次の共通基盤を導入していない

- ドメイン固有の巨大な抽象repository
- 共通の状態管理基盤
- monorepo

次の機能や運用変更も、この移行とは別に扱う

- SSR/SSG
- RSS
- CMS更新worker
- Cloudflare本番設定の変更
- 外部feed向けの先行設計

将来追加する際も、ページの処理とAPIの役割を分けたまま実装する

</details>

[メディアの埋め込み]: media-embed.md
[テストと検証]: quality.md
