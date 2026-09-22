# 性能検証

## 役割

このディレクトリは、同じfixtureとharnessで候補版の性能変化を比較する検証を持つ。測定値は相対的な回帰検出のために使い、フィールドUXやSLOの成立を示すものではない。

## 構成

`contract.mjs` は入力を検証して固定ポリシーを評価する純粋な境界、`run.mjs` はブラウザ・ビルド・子プロセスをつなぐ実行側、`fixtures/` はポリシーとbaselineの固定値を持つ。規範仕様は `*.spec.test.mjs`、具体的な回帰証人は `*.regression.test.mjs` に置く。

## 必要な詳細

固定anchor、absolute cap、warm scopeのhashはreview済みの値として扱う。fixture、harness、readiness、browser、exit、cleanupのどれかがずれた観測は `INVALID_EVIDENCE` として保存する。
