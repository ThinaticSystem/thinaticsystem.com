# Architecture notes

ThinaticSystem.comは単一のstandalone Angularアプリである。`src/app/app.routes.ts`のlazy routeからfeature pageへ進み、CMS/APIとMarkdownの境界はfeatureまたはproviderに置く。domain固有の巨大な抽象repository、状態管理基盤、monorepoは導入しない

## Runtime boundaries

- Angular application builderが`dist/app/browser`へCSR artifactを出力する
- `cms.thinaticsystem.com`のJSONはfeatureのHTTP境界で利用する。CIとbrowser smokeはsynthetic fixtureのみを使用する
- `thinaticsystem.com/workers/*`はSPA static fallbackとは別のAPI責務である
- `typedoc.json`のentrypointは公開意図のある設定、route、interface、pipe、provider、serviceに限定し、generated HTMLは`.artifacts/`へ出力する

## Deliberately not included

SSR/SSG、RSS、CMS更新worker、Cloudflare本番設定変更、外部feed向け先行architectureは今回のmigration scope外である。将来追加するときも既存のroute/API境界を越えて実装する
