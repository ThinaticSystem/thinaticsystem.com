# Quality gates

## Local command contract

`pnpm run check`はfrozen install後のbaseline quality gate（typecheck、lint、unit、known-defect contract、known-defect raw gate）を順に実行する。`pnpm run docs:check`はTypeDocを生成し、`pnpm run test:e2e`はowned synthetic fixtureを使う実Chromiumのsemantic/a11y/browser smoke、`pnpm run perf:check`は同じbrowser結果と凍結baselineのsize/request/lazy-route bytes/timing記録を検査し、`pnpm run deploy:check`はCloudflare-compatible static servingのHTTP契約を検査する

## Known defect semantics

`test/known-defects.json`に登録されたnested interactive anchorだけが意図されたassertion failureである。`pnpm run test:known-defects`はraw runner outputとVitestのJSON reportを保存・表示し、contract checkerは構造化reportの登録case identity/outcome、status=1、failure数、setup/import/discovery failure、unexpected passを検査する。未知failure、未実行、skip、duplicate、runner crashはFAILであり、`continue-on-error`や`|| true`で隠さない。人間向けconsole出力は判定の権威にしない

したがってCI greenは「通常suiteとknown-defect contractを満たした」という意味であり、全製品要求が解決済みという意味ではない。登録defectは明示レビューなしに増やさない

## Browser and accessibility

`test:e2e`はCMS/patronのlive endpointへ接続せず、Chromiumでhome、theme toggle、mobile menu、blog list/article/back、discographyを通る。role/nameまたはvisible textのsemantic locator、keyboard operation、focus、mobile `375x812`、reduced motion、reflow、axe scan、console/page/request error inventoryを記録する。axe passだけではscreen reader usabilityの証明にならないため、代表screen readerでの手動確認は未実施ならpendingである

## Performance

比較baselineはapproved SHA `33b4ef4e8d21276130127a61aede6f0a8e1c47cb`のsynthetic fixtureとChromiumである。gzip(level9,mtime0)とBrotli(quality11)を同じ方式で計算し、initial artifact sizeとper-route request/lazy-route bytesを比較する。`browser-smoke`はreadiness完了までを計時し、axe scanとscreenshotをtimer外で実行する。timingは3 repeatのmedianを、baselineの固定20% noise/retest ruleで判定し、超過はPASSにせず`INCONCLUSIVE_OR_FAIL`としてgateを止める。local lab timingはfield UX保証ではない

Nix実行はflake lock固定のNode22 bridgeを使う。Node26は本作業で実行試験を行った際にVitest native double-freeが発生したため採用せず、Nix側の`install --frozen-lockfile`、typecheck/unit/debt、build、dev/browserは別々の再検証対象である。本remediation runではoffline `nix develop`がversion出力前にtimeoutしたためNix実行をPASS扱いしない。親の旧Node26結果は履歴証拠として残し、新しいreportで混同しない

## Delivery checks

`deploy:check`は`dist/app/browser`を127.0.0.1だけで配信し、deep-linkはHTML、既存API相当はJSON/status、missing assetはHTTP 404、未知APIはSPA HTML fallbackにならないことを検査する。Cloudflare account、branch binding、remote Actions、preview、本番deploy、DNS、CMS writeはこのローカルgateでは検証しない
