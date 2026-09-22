# 性能検証の保守

性能ポリシーと観測ハーネスは同じ境界で管理する。`fixtures/` のポリシー、baseline、fixture入力は固定した観測条件の一部であり、実行結果に合わせて書き換えない。

`contract.mjs` は純粋な評価境界、`run.mjs` は実行と証跡のアダプター、`*.spec.test.mjs` は規範仕様、`*.regression.test.mjs` は具体的な回帰証人として分ける。Node、Chromium、fixture、readinessの識別子が一致しない観測は成功として扱わない。
