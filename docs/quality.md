# テストと検証

このサイトでは、コードの検査とブラウザー上の動作確認を組み合わせてテストする  
画面の表示や操作に加え、性能とローカル配信の応答も確認する

## 開発中のチェック

通常の開発では、依存パッケージをインストールした後に`check`を実行する

```sh
corepack pnpm run check
```

型検査、lint、単体テストをまとめて実行するコマンド  
既知不具合の登録内容とテスト結果の照合、性能予算の判定処理のテストも含む

個別に確認したい場合は、次のコマンドを使う

| コマンド | 対象 |
| --- | --- |
| `corepack pnpm run typecheck` | TypeScriptの型 |
| `corepack pnpm run lint` | TypeScriptとAngularテンプレートのコード規約 |
| `corepack pnpm run test` | コンポーネントと共通処理 |
| `corepack pnpm run test:known-defects` | 既知不具合の登録内容とテスト結果 |
| `corepack pnpm run test:known-defects:contract` | テスト結果の判定処理 |
| `corepack pnpm run test:budget-contract` | 性能予算の判定処理 |

修正済みの不具合は、`test/product-repairs.json`から対応するテストを確認できる  
既知不具合の検査は、登録した不具合による失敗と、テスト自体の実行エラーを分けて扱う

## ブラウザーでの動作確認

ブラウザーテストは、ビルドしたサイトをChromiumで開いて操作する  
CMSと支援者APIにはテスト用の応答を使い、同じデータで画面を確認する

```sh
corepack pnpm run build
corepack pnpm run test:e2e
```

- **画面遷移と操作**

  ブログや作品一覧への移動、記事の閲覧、戻る操作を確認する  
  テーマ切替、モバイルメニュー、キーボード操作とフォーカスも対象

- **画面幅とモーション設定**

  モバイル表示での折り返しや、動きを減らす設定での表示を確認する

- **アクセシビリティと実行時エラー**

  axeによる自動検査を行い、コンソール・ページ・通信のエラーを記録する

スクリーンリーダーの使い勝手や、外部プレーヤーの実際の再生は手動で確認する

## 性能の比較

`perf:current`は、固定した旧版と変更後の版をビルドし、表示や操作にかかる時間と読み込むファイルの量を比較する

```sh
corepack pnpm run perf:current
```

測定条件と結果の読み方は[性能比較テスト]を参照

## ローカル配信の確認

`deploy:check`は、ビルド済みのサイトをローカルのNodeサーバーで配信して応答を確認する

```sh
corepack pnpm run build
corepack pnpm run deploy:check
```

ページへの直接アクセス、APIのJSON応答、存在しないアセットの404を検査する  
APIに対してSPAのHTMLが返らないことも確認する

Cloudflareのランタイムは使わないため、実際のAPIと配信設定は配信先で別に確認する

## 文書生成とテスト結果

コードの説明はTypeDocでHTMLとして生成する  
出力対象と生成先は`typedoc.json`で管理する

```sh
corepack pnpm run docs:check
```

生成した文書とテスト結果は、Git管理対象外の`.artifacts/`へ保存する  
CIでは、性能比較が失敗した場合も文書生成とローカル配信の検査を実行する

[性能比較テスト]: current-performance.md
