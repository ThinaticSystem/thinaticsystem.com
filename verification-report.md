# Verification report: CI・TypeDoc・配信検査・性能比較

Date: 2026-09-05
Repository: `/home/hermes/projects/thinaticsystem.com`
Branch: `chore/modernization-local`
Candidate verified commit: `da9b15c48190d5759e605aebcba649f37258a3f5`
Approved comparison base: `33b4ef4e8d21276130127a61aede6f0a8e1c47cb`

## Scope and authority

Mission Dのapproved scopeとしてCI workflow、TypeDoc、synthetic browser/a11y/keyboard/mobile evidence、size/request/per-route comparison、Cloudflare-compatible local HTTP smoke、README/quality/architecture docsを追加した。push、PR、merge、remote CI、Cloudflare account確認、preview/deploy、DNS、CMS writeは実施していない

`AGENTS.md`は追加を試みたが、agent-instruction protected fileへの書込み承認がheadless実行中にtimeoutしたため作成していない。保護を迂回せず、このreportでgapとして明記する

## Commands and exits

| Command | Exit | Evidence |
|---|---:|---|
| `corepack pnpm install --frozen-lockfile --offline --reporter=append-only` | 0 | `.artifacts/install.log` |
| `corepack pnpm run check` | 0 | `.artifacts/check.log` |
| `NG_BUILD_MAX_WORKERS=2 corepack pnpm run build` | 0 | `.artifacts/build.log`, `dist/app/browser/` |
| `corepack pnpm run docs:check` | 0 | `.artifacts/docs.log`, `.artifacts/typedoc/` |
| `corepack pnpm run test:e2e` | 0 | `.artifacts/e2e.log`, `.artifacts/browser-smoke.json`, `.artifacts/screenshots/` |
| `corepack pnpm run perf:check` | 0 | `.artifacts/perf.log`, `.artifacts/performance.json` |
| `corepack pnpm run deploy:check` | 0 | `.artifacts/deploy.log` |
| `git diff --check` | 0 | terminal verification |

`check`の通常suiteは17 test files / 19 tests PASS、known-defect contract fixture PASSである。known-defect raw runnerは登録済みnested interactive-anchor assertion 1件だけを実際にFAILし、gate自身はexit 0になった。runner/setup/import failureやunexpected passはない

## Browser/a11y evidence

`test:e2e`はChromium `140.0.7339.16`（`/home/hermes/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`）、desktop `1280x900`、mobile `375x812`、`reducedMotion=reduce`、synthetic CMS/API fixtureで3 repeat実行した。home、theme toggle、blog list、article、back、discography、mobile menu/blogの全journeyを完了し、各repeatでaxe violations、console error、page error、failed request、blocked external requestは0件だった。keyboard操作・focus・mobile reflow（scrollWidth=clientWidth=375）も記録した

手動visual inspectionと代表screen-reader操作は自動実行していないためpendingである。axe PASSをscreen-reader usabilityの証明とは扱わない

## Performance

`perf:check`はapproved baseの同じ圧縮条件（gzip level9/mtime0、Brotli quality11）でartifactを比較した

- initial raw: `531195 -> 433060` bytes（`-98135`）
- initial gzip: `155551 -> 127352` bytes（`-28199`）
- initial Brotli: `136693 -> 112405` bytes（`-24288`）
- all representative journey request countsはbase以下（home 12 vs 13、mobile menu 18 vs 19など）
- timingは3-repeat medianとして`.artifacts/performance.json`へ保存した。local lab timingはfield UX保証ではなく、noiseだけで性能優位を主張しない

## Local delivery smoke

`dist/app/browser`を127.0.0.1限定serverで配信し、`/blog`と`/blog/article/1`のdeep-link、未知SPA route、`/workers/patrons` GET JSON 200、同API POST JSON 405、unknown API JSON 404、missing asset 404を検査した。APIをSPA HTML fallbackへ混ぜず、deployは行っていない

## Required checks and remaining gaps

- [x] frozen install
- [x] TypeScript typecheck
- [x] Angular lint
- [x] unit/component tests
- [x] strict known-defect contract + negative fixtures
- [x] production build
- [x] TypeDoc generation without warnings
- [x] Playwright semantic/browser/a11y/keyboard/mobile evidence
- [x] comparable size/request/per-route timing evidence
- [x] Cloudflare-compatible local artifact/deep-link/API/asset smoke
- [x] least-privilege SHA-pinned GitHub Actions workflow at `.github/workflows/ci.yml`
- [ ] remote GitHub Actions execution (not run; no fake PASS claim)
- [ ] human visual and screen-reader inspection
- [ ] Cloudflare account/project/branch binding/preview/live deploy verification
- [ ] minimal `AGENTS.md` (protected-file approval unavailable)

No PR, push, merge, publish, deploy, DNS mutation, CMS write, or infrastructure mutation was performed
