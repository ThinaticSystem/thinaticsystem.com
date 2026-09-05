# Quality gates

## Local command contract

`pnpm run check`はfrozen install後のbaseline quality gate（typecheck、lint、unit、known-defect contract、known-defect raw gate）を順に実行する。`pnpm run docs:check`はTypeDocを生成し、`pnpm run test:e2e`はowned synthetic fixtureを使う実Chromiumのsemantic/a11y/browser smoke、`pnpm run perf:check`は同じbrowser結果と凍結baselineのsize/request/per-route記録を検査し、`pnpm run deploy:check`はCloudflare-compatible static servingのHTTP契約を検査する

## Known defect semantics

`test/known-defects.json`に登録されたnested interactive anchorだけが意図されたassertion failureである。`pnpm run test:known-defects`はraw runner outputを保存・表示し、contract checkerは登録caseの実行がちょうど一回であること、failure数が一致すること、setup/import/discovery failureがないこと、unexpected passがないことを検査する。未知failure、未実行、skip、duplicate、runner crashはFAILであり、`continue-on-error`や`|| true`で隠さない

したがってCI greenは「通常suiteとknown-defect contractを満たした」という意味であり、全製品要求が解決済みという意味ではない。登録defectは明示レビューなしに増やさない

## Browser and accessibility

`test:e2e`はCMS/patronのlive endpointへ接続せず、Chromiumでhome、theme toggle、mobile menu、blog list/article/back、discographyを通る。role/nameまたはvisible textのsemantic locator、keyboard operation、focus、mobile `375x812`、reduced motion、reflow、axe scan、console/page/request error inventoryを記録する。axe passだけではscreen reader usabilityの証明にならないため、代表screen readerでの手動確認は未実施ならpendingである

## Performance

比較baselineはapproved SHA `33b4ef4e8d21276130127a61aede6f0a8e1c47cb`のsynthetic fixtureとcached Chromiumである。gzip(level9,mtime0)とBrotli(quality11)を同じ方式で計算し、initial artifact sizeとper-route request countを比較する。journey timingは3 repeatのmedianとして保存するが、local lab timingはfield UX保証ではない。timingのnoiseだけで性能優位を主張せず、追加測定が必要ならFAILではなく判定不能として記録する

## Delivery checks

`deploy:check`は`dist/app/browser`を127.0.0.1だけで配信し、deep-linkはHTML、既存API相当はJSON/status、missing assetはHTTP 404、未知APIはSPA HTML fallbackにならないことを検査する。Cloudflare account、branch binding、remote Actions、preview、本番deploy、DNS、CMS writeはこのローカルgateでは検証しない
