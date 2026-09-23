# 旧方式の性能予算

`perf:budget`は、旧方式の`perf:paired`で取得した測定結果に、機能別のサイズ上限を適用するコマンド  
既存の記録を読み、サイズ・リクエスト数・時間を分けて判定する

現在のCIで使う比較テストは[`perf:current`](current-performance.md)を参照

## 実行方法

入力には、旧方式で取得した欠測のないペア比較1回分と、その実行記録を指定する

```sh
corepack pnpm run perf:budget --paired-run .artifacts/paired-ci/run-EXACT \
  --paired-exit .artifacts/OWNED/paired-once.exit.json
```

`run-EXACT`と`OWNED`は、実際に取得した記録のパスに置き換える  
このコマンド自体はブラウザーでの測定を行わない

`paired-exit`には、`runOwnedCommand`の実行結果に、実行ファイル・引数・作業ディレクトリを付けたJSONを使う  
対象コマンドは`corepack pnpm run perf:paired`で、同じ接頭辞の`.supervision.json`と`.stdout.log`も必要になる

結果は、新しい`.artifacts/functional-budget/run-*/result.json`へ保存する  
入力記録の形式と照合方法は[`functional-budget-evidence.mjs`](../scripts/functional-budget-evidence.mjs)を参照

## サイズ上限

上限は[`test/functional-budget-v1.json`](../test/functional-budget-v1.json)で管理する  
初期表示、各操作、全出力をそれぞれ判定する

| 対象 | 上限 |
| --- | --- |
| 初期JS/CSS | raw 458,752 B・gzip 131,072 B・Brotli 114,688 B |
| ブログ一覧で追加するJS/CSS | 展開後20,480 B |
| 記事で追加するJS/CSS | 展開後7,168 B |
| 作品一覧で追加するJS/CSS | 展開後5,120 B |
| 作品詳細コンポーネントのチャンク | 16,384 B |
| 全出力JS/CSS | 819,200 B |

作品詳細の上限はコンポーネント単体に適用するもので、画面全体の読み込み量とは異なる  
全出力は、同じ内容のファイルがあってもファイルごとに数える

そのほかの操作、リクエスト数、リソースの件数には、設定済みの上限と測定した旧版の上限の両方を使う  
時間はABBA・BAABで各版4回測った中央値を比較し、20%の条件で判定する

## 結果の読み方

| 出力項目 | 内容 |
| --- | --- |
| `size` | サイズ上限の判定 |
| `requests` | リクエスト数とリソース件数の判定 |
| `timing` | 時間の比較 |
| `historicalRaw` | 旧方式による失敗結果 |
| `coverage` | 測定範囲の不足を示す`BLOCKED` |
| `releaseAuthorization` | 公開の許可を含まないことを示す`NOT_GRANTED` |

v1では、記事・作品詳細の初回表示と、作品一覧から詳細への遷移全体に対する予算が未確定  
サイズの判定にかかわらずCLIの終了コードは1になり、測定範囲の不足を含めて結果を残す

## 判定処理の変更

サイズの上限と対象アプリの構成を固定し、ファイルの移動によって集計から漏れないように照合する  
作品詳細のチャンクもファイル名ではなく、Angularのコンポーネントから特定する

アプリの入力を変更すると、同じ上限でも構成と集計範囲の再確認が必要になる  
数値の変更と、比較に使うファイル・構成の更新は分けてレビューする

判定処理は[`scripts/functional-budget.mjs`](../scripts/functional-budget.mjs)と関連モジュールに実装している  
変更後は、次のテストでサイズの集計と入力記録の検証を確認する

```sh
corepack pnpm run test:budget-contract
```
