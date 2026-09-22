# アプリの構成と境界

ThinaticSystem.comは、standalone構成の単一Angularアプリとして動作する  
`src/app/app.routes.ts`の遅延ルートから各機能のページを読み込む

CMS/APIとの通信やMarkdownの変換は、利用する機能またはproviderで扱う  
将来の用途を見越した大きな共通基盤は導入しない

## 実行時の責務

- **ブラウザー向けアプリのビルド**

  Angular application builderがCSR成果物を`dist/app/browser`へ出力

- **CMSデータの取得**

  `cms.thinaticsystem.com`のJSONを、各機能のHTTP境界で利用  
  CIとブラウザー検査では、実CMSではなくテスト用データを使う

- **既存APIの配信**

  `thinaticsystem.com/workers/*`は、SPAの静的HTMLへのフォールバックと分離

## 生成文書の範囲

TypeDocは、公開を意図したコードの境界を説明するために使う  
`typedoc.json`のentrypointを次の対象に限定し、生成HTMLを`.artifacts/`へ出力する

- 設定
- route
- interface
- pipe
- provider
- service

## 導入しない共通基盤

今回のアプリの規模と責務に合わせ、次の構成は導入しない

- ドメイン固有の巨大な抽象repository
- 共通の状態管理基盤
- monorepo

## 今回の移行に含めない機能

次の機能や運用変更は、この移行とは別に扱う  
将来追加するときも、既存のrouteとAPIの責務を分けたまま実装する

- SSR/SSG
- RSS
- CMS更新worker
- Cloudflare本番設定の変更
- 外部feed向けの先行設計
