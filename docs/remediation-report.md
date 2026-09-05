# Modernization remediation report

## Scope

This report records the remediation run for the independent modernization review. The run preserves the existing product defects as explicit debt unless they were already part of the approved migration contract; it does not turn unrelated bug fixes into migration success.

## Implemented and verified

- The known-defect contract now fails closed on missing/invalid manifest schema, duplicate case/spec identities, unsupported outcomes, runner start/signal/status failures, unexpected diagnostics, missing or malformed structured reports, runner-level errors, count mismatches, unexpected suites, duplicate suites, unexpected assertions, and unexpected passes
- Negative fixtures exercise those rejection paths, including a fatal signal after plausible test output and a valid-looking report with an unrelated stderr error
- The nested-anchor known-defect test asserts both destination identity and keyboard focus stops using semantic locators. The registered defect remains an intentional assertion failure
- Known-defect execution now writes `.artifacts/known-defects-result.json` alongside the raw log and Vitest report, preserving child status, signal, runner error, and validation errors
- Browser smoke uses the same semantic action sequence for baseline and candidate runs, with owned API fixtures, reduced motion, visual-readiness timing, and accessibility scanning after the timer stops
- Performance baseline data records the same browser-smoke v3 substrate used by the paired baseline run. Initial artifact, request-count, lazy-route byte, and three-repeat median timing checks remain fail-closed
- CI uses the pinned setup-node action and an explicit Node 22 bridge matching `.node-version`; delivery smoke is explicitly local-only and does not claim Cloudflare deployment
- Requirements inventory now distinguishes PASS, registered known failure, retained debt failure, manual pending work, and external validation that was not run

## Verification evidence

All commands below were run from the repository root on 2026-09-05.

| Command | Result | Evidence |
|---|---|---|
| `corepack pnpm run check` | PASS; 17 test files and 19 tests passed; known-defect gate observed exactly 1 registered assertion failure | `.artifacts/known-defects-report.json`, `.artifacts/known-defects-result.json`, `.artifacts/known-defects.raw.log` |
| `corepack pnpm run test:known-defects:contract` | PASS; negative fixtures passed | command output |
| `corepack pnpm run build` | PASS; initial total 433.06 kB raw / 112.64 kB estimated transfer | build output |
| `node scripts/browser-smoke.mjs` | PASS; Chromium 140.0.7339.16, 3 repeats, no console/page/request errors, no blocked external requests, axe violations empty for all recorded journeys | `.artifacts/browser-smoke.json`, `.artifacts/screenshots/` |
| `corepack pnpm run perf:check` | PASS; initial size and route/request counts did not regress; timing remained within the preset 20% lab rule | `.artifacts/performance.json` |
| `corepack pnpm run deploy:check` | PASS; local static artifact and explicit fixture API contract only | command output; external validation is `NOT_RUN` |
| `corepack pnpm run docs:check` | PASS | `.artifacts/typedoc/` |
| `git diff --check` | PASS | command output |

The paired baseline evidence used the same browser-smoke v3 harness, Chromium executable/version, synthetic fixture set, reduced-motion setting, loopback static server, readiness wait, semantic action sequence, and three-repeat aggregation. It is retained outside the repository at `/home/hermes/.hermes/work/thinaticsystem-modernization/paired-baseline-browser.json`; the candidate run is `.artifacts/browser-smoke.json`.

Candidate median timings in the final recorded run were: home 286.42 ms, theme toggle 696.53 ms, blog list 116.91 ms, article 94.09 ms, back 30.80 ms, discography 88.16 ms, and mobile menu/blog 1388.47 ms. These are local lab observations, not field UX guarantees.

## Nix and external boundaries

An actual bounded attempt to run `nix develop --offline --no-write-lock-file -c bash -lc 'node --version && corepack pnpm --version'` timed out after 300 seconds before version output. Therefore Nix install, typecheck, unit/debt, build, dev-server, and browser execution are **UNVERIFIED**, not PASS. Host-side checks above must not be conflated with Nix evidence.

Cloudflare account access, branch bindings, remote Actions, preview, production deployment, DNS, CMS writes, live patron data, and live CMS access were not run. Human visual inspection and representative screen-reader operation remain pending; axe output does not establish those guarantees.

## Residual debt

The following baseline product defects remain explicit `DEBT FAIL` or security-review items in `docs/requirements-tests.md`: blog HTTP failure handling, blog concurrent page response ordering, article route-parameter lifecycle, article 404/500 distinction, clipboard rejection handling, notification timer replacement, discography image-error and empty-result loading settlement, and the sanitizer bypass/iframe allowlist policy. They were not silently converted into green requirements or classified as migration success.
