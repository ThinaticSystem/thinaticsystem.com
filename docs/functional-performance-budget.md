# 必要機能込みの性能予算 v1

## 承認と範囲

`test/functional-budget-v1.json`は、品地さんが承認した予算案v2の数値を固定した別基準である。`scripts/functional-budget-evidence.mjs`で内容hashを束縛する。旧`performance-check.mjs`・paired計測器・control・失敗記録を書き換えない。

- 初期JS/CSS: raw 458,752 B / gzip 131,072 B / Brotli 114,688 B、すべて同時に満たす
- 固定操作での追加JS/CSS decoded bytes: blog list 20,480 B、article 7,168 B、discography list 5,120 B
- 作品詳細component chunk単体: 16,384 B（画面全体ではない）
- 全出力JS/CSS: 819,200 B、重複contentでもファイルごとに数える
- その他の操作、全リクエスト数、資源entry数: 承認時上限とfresh baselineの上限の両方を維持
- 時間: 固定ABBA/BAAB・両側4観測のmedian、20%条件を変更しない

丸めた工学的配分であり、利用者の遅延SLOを実証した値ではない。ゼロ増分の旧比較は`historicalRaw`にそのまま残る。旧失敗の種類を生の完全な観測から再構成し、未知の失敗・欠測・signal・timeout・cleanup不明を診断だけに格下げしない。

## 実行

固定Nix環境内で通常の`corepack pnpm run check`を実行すると、新しい判定器のfixtureも走る。

```sh
corepack pnpm run test:budget-contract
corepack pnpm run perf:budget --paired-run .artifacts/paired-ci/run-EXACT \
  --paired-exit .artifacts/OWNED/paired-once.exit.json
```

`perf:budget`は再測定を開始せず、既存の**完全なfresh paired測定1回**を読み取る。`paired-exit`は`runOwnedCommand`の生結果に`executable: corepack`、`args: [pnpm, run, perf:paired]`、実cwdを付した親receiptである。同じ接頭辞の`.supervision.json`と`.stdout.log`も必須。stdoutの計測directoryと8観測・終了・source/build identityを照合する。測定値がよくなるまで再実行する用途ではない。

結果は毎回新しい`.artifacts/functional-budget/run-*/result.json`に保存する。旧PASSの再利用や上書きはしない。

## 判定の分離

- `size`: 承認した数値上限
- `requests`: リクエストと資源entry数
- `timing`: 変更していない時間規則
- `historicalRaw`: 旧比較の失敗を原文で保持
- `coverage`: 下記の未測定範囲が残るため`BLOCKED`
- `releaseAuthorization`: 常に`NOT_GRANTED`

**v1のCLI終了値は常に1**。サイズが合格しても、測定範囲が不足した全体を緑にしない。fixtureテストの成功とは別の意味である。既存CIの旧paired/performanceコマンドも置換しない。

## 読み込み先・表現の移動を数値だけで認めない

初期・各操作・全出力の制約を相殺しない。作品詳細はファイルhash名ではなく、固定されたAngular component selectorから一意に特定し、欠落・重複・initialへの移動を拒否する。indexをinert DOMとして読み、既存collectorの資源集合と照合する。未許可のinline script、外部script、query付きの分類抜け、Wasm/MJS/CJS、symlinkは自動合格しない。

さらに、承認済みアプリとビルド入力の正確なfile witnessを保持する。現版では**アプリ入力が変わると保守的にboundary再レビューを要求**する。将来の通常の修正でも該当することがある。入力変更を自動承認・hash更新しない。これは任意コードの意味をhashで証明したという主張ではなく、既にレビューした構成を黙って変えさせない入場条件である。将来の更新では、数値枠の変更と、同じ数値枠に対する新しいboundaryレビューを区別する。

## 残る公開条件

- 記事のcold direct access
- 作品詳細のcold direct access
- 作品一覧から詳細への遷移全体

これらはfirst-party JS/CSS、CMS・画像・font、外部player資源を分離して実測し、画面全体の上限を別途承認するまで未完了。16 KiBから全体の上限を推定・自動登録しない。

実provider再生、アカウント・cookie・fullscreen、hosting実装、代表screen reader等の既存gateは別途残す。この変更で公開・commit・push・CMS writeを行わない。
