# 性能検証

## 役割

このディレクトリは、同じfixtureとharnessで候補版の性能変化を比較する検証を持つ。測定値は相対的な回帰検出のために使い、フィールドUXやSLOの成立を示すものではない。

## 構成

`contract.mjs` は入力を検証して固定ポリシーを評価する純粋な境界、`run.mjs` はブラウザ・ビルド・子プロセスをつなぐ実行側、`fixtures/` はポリシーとbaselineの固定値を持つ。v2/v3は履歴契約として保持し、現行runnerはadditive v4を使う。規範仕様は `*.spec.test.mjs`、具体的な回帰証人は `*.regression.test.mjs` に置く。

## v4 noise decision

v4はraw range/MADを診断として全値出力し、A/Aのpaired medianまたはside median bias、固定2-pair blockの矛盾、paired/side aggregate signal mismatchだけをノイズ由来の `INCONCLUSIVE` とする。paired medianとside medianの両方が閾値を超える候補悪化は、raw varianceにかかわらず `REVIEW_REQUIRED` として保持する。固定cap、identity、receipt、cleanup、source invarianceは従来どおりfail closedである。

## 必要な詳細

固定anchor、absolute cap、warm scopeのhashはreview済みの値として扱う。fixture、harness、readiness、browser、exit、cleanupのどれかがずれた観測は `INVALID_EVIDENCE` として保存する。v4の実行結果は `.artifacts/performance-v4/` に保存し、過去のv2/v3結果を上書きしない。
