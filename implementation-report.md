# Implementation report: Angular 22 / Vitest / requirements / a11y milestone

Date: 2026-09-05
Task: `t_a044fe90` (B+C)
Repository: `/home/hermes/projects/thinaticsystem.com`
Branch: `chore/modernization-local`
Base evidence: `/home/hermes/.hermes/work/thinaticsystem-modernization/baseline-report.md` and `baseline.json`

## Baseline reconstruction

The frozen baseline was read before candidate verification. Its source identity is SHA `33b4ef4e8d21276130127a61aede6f0a8e1c47cb`, tracked diff empty, and its recorded initial asset total is 531,195 raw / 155,551 gzip / 136,693 Brotli bytes. The baseline browser evidence uses the fixed synthetic fixture, Chromium `/home/hermes/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`, desktop 1280x900, mobile 375x812, and three repeats. Baseline legacy tests were 18 executed / 4 passed / 14 failed; those failures were retained as historical scaffold/setup debt and were not used as a product-pass claim.

## Implemented scope

- Retained the existing reviewed Angular 19/20 migration work and completed the candidate toolchain at Angular 22.1.5 / CLI and build 22.1.7 / TypeScript 6.0.3 / Vitest 4.1.11.
- Migrated the Angular application and unit-test target to the official application and unit-test builders, removing Karma/Jasmine bootstrap files and adding isolated provider/setup files.
- Added the ngx-markdown-supported `marked-katex-extension@5.1.12` and `katex@0.16.47` peer pair. This closes the Vite dynamic-import resolution failure without suppressing Vite errors.
- Fixed the zoneless loading overlay regression with a signal-backed `LoadingService` getter/setter, preserving existing call sites and adding a focused regression test.
- Updated Angular 22 date patterns from week-based `YYYY` to calendar-year `yyyy` in blog and discography templates. This removes the runtime `NG02300` error observed in the browser journey.
- Applied semantic navigation/a11y changes already present in the candidate migration: native router links for navigation, explicit accessible names/alt text, theme `aria-pressed`, mobile navigation `aria-controls`/`aria-expanded`, navigation landmark, and external-link `rel` attributes.
- Replaced the full global `animate.css` payload with the four actually used animation contracts (`animated`, `fadeIn`, `slideInRight`, `slideOutRight`) plus reduced-motion handling. This preserves the existing visual behavior used by the app while removing an observed initial-bundle regression.
- Reworked the nested-anchor known-defect assertion to use Testing Library role semantics; no `querySelector*`, XPath, test-id, or CSS UI locator remains in `src`.
- Added `test/known-defects.json`, a fail-closed known-defect contract checker, and executable negative fixtures covering setup/import failure, missing execution, unexpected pass, and duplicate execution.
- Added the minimal `flake.nix`/`flake.lock` development shell pinned to nixpkgs `801bef6abd86b91e51083066b83fb354a11fc640` (2026-09-04), Node 26.8.1 and pnpm 10.17.1 as exposed by the shell.
- Added `scripts/dev-browser-smoke.mjs` for a local synthetic-fixture dev journey; it does not contact live CMS data.

## Verification commands and actual results

All commands below were run locally; no remote CI result is implied.

| Command | Runtime | Exit/result |
|---|---|---:|
| `corepack pnpm install --frozen-lockfile --offline --reporter=append-only` | Node 22.22.3 / pnpm 10.17.1 | 0 |
| `nix develop -c pnpm install --frozen-lockfile --offline --reporter=append-only` | Nix Node 26.8.1 / pnpm 10.17.1 | 0 |
| `pnpm exec tsc -p tsconfig.spec.json --noEmit` | Node 22.22.3 | 0 |
| `pnpm run lint` | Node 22.22.3 | 0, all files pass |
| `pnpm run test` | Node 22.22.3 | 0, 17 files / 19 tests passed |
| `pnpm run test:known-defects:contract` | Node 22.22.3 | 0, negative fixtures passed |
| `pnpm run test:known-defects` | Node 22.22.3 | 0 gate exit; raw child is 1 registered assertion failure and no runner/setup failure |
| `NG_BUILD_MAX_WORKERS=2 nix develop -c pnpm run build` | Nix Node 26.8.1 | 0, output `dist/app/browser` |
| `node scripts/dev-browser-smoke.mjs` | Node 22.22.3 + cached Chromium | 0, home -> blog list -> readable article; zero console/page/request errors |
| candidate production browser harness, three sequential repeats | Node 22.22.3 + cached Chromium | 0 each; zero fatal/console/page/request errors each |
| `git diff --check` | git | 0 |

The Nix Node 26 Vitest run terminated with native `double free or corruption (out)` before test results, and Nix Node 26 `ng serve` terminated with SIGSEGV during dev-server startup. These are recorded as localized runtime gaps; the same supported lock/source paths were verified on Node 22.22.3, which is the approved Angular bridge runtime. The Nix production builder itself passed on Node 26.8.1.

## Performance and browser comparison

Candidate initial files from the final production build:

- raw: 432,891 bytes
- gzip level 9, mtime 0: 127,385 bytes
- Brotli quality 11: 112,482 bytes

Frozen baseline was 531,195 / 155,551 / 136,693 bytes respectively. Candidate therefore decreased all three measured initial totals. Candidate production static resource timing was identical across three repeats: 12 local entries, 556,951 transfer bytes and 553,951 decoded bytes. Baseline was 13 entries, 708,019 transfer bytes and 704,719 decoded bytes.

Median journey values, same synthetic fixture and browser substrate:

| Journey | Baseline median ms | Candidate final repeats ms |
|---|---:|---:|
| desktop.home | 301.50 | 369.55 / 265.30 / 382.73 |
| desktop.theme-toggle | 884.79 | 373.83 / 878.78 / 369.67 |
| desktop.blog-list | 1101.17 | 877.44 / 502.07 / 784.60 |
| desktop.blog-article | 106.36 | 137.10 / 96.92 / 93.33 |
| desktop.blog-back | 26.55 | 52.97 / 45.18 / 44.86 |
| desktop.discography | 966.85 | 76.67 / 84.34 / 77.93 |
| mobile.menu-blog | 2328.96 | 1442.30 / 1458.92 / 1443.90 |

Timing is evidence under the fixed local fixture, not a field UX guarantee. Raw artifacts are retained at `/home/hermes/.hermes/work/thinaticsystem-modernization/candidate-browser-final-1.json` through `candidate-browser-final-3.json`; baseline artifacts remain untouched.

## Debt and remaining gates

- The nested interactive-anchor product defect remains intentionally unfixed. Its semantic known-defect test must fail; the contract gate accepts exactly this registered assertion and rejects unknown/setup/missing/unexpected outcomes.
- Human visual and screen-reader inspection remains a separate pending gate.
- Remote GitHub Actions execution, PR, push, Cloudflare deployment, DNS, CMS writes, and live infrastructure changes were not performed.
- CI workflow, TypeDoc, local Cloudflare artifact/deep-link/API smoke, final delivery documentation, and independent review remain owned by downstream task `t_4fca1804`.

## Local commit

The implementation is committed locally as `d2588f6` after this report was written; this SHA must not be interpreted as pushed or remotely reviewed.
