# Test boundary remediation report

## Scope

This is the approved successor correction for the executable-requirements test boundary. Product components, services, templates, styles, runtime configuration, Nix, CI, deployment, and live services were not changed. The candidate implementation commit is `f9a33d0f8b325dbf09d3b4685fd0e597ce0b1bf3` on `chore/modernization-local`.

## Mechanism correction

- `scripts/known-defect-reporter.mjs` is a small Vitest 4 reporter using the supported `onHookStart`, `onHookEnd`, and `onTestRunEnd` lifecycle. It emits assertion identity, error name, origin, source location, structured runner errors, unhandled errors, and file/describe suite counters.
- `scripts/known-defect-contract.mjs` now requires the authoritative reporter schema, empty runner/unhandled error collections, an `AssertionError` from the test body, and the exact manifest assertion source line. Error text alone cannot satisfy the gate.
- Real runner probes execute assertion failure, test-body `TypeError`, `beforeEach` `TypeError`, `afterEach` `TypeError`, and unhandled asynchronous `TypeError` fixtures. Each probe must produce its expected structured origin; all five currently reject as runner failures.
- `requirements.debt.spec.ts` no longer installs a module-level `process.on('uncaughtException')` handler. Expected RxJS fixture errors are captured by a scoped `rxjs.config.onUnhandledError` boundary using object identity, deterministic timer flushing, `finally` restoration, and an `afterEach` no-leak assertion.
- Discography image failure now uses a required accessible-role locator after Angular stability/rendering; absent fixture output is an infrastructure failure, not an accepted optional dispatch.
- Requirement wording no longer claims failure reporting for the blog loading case or an actual browser clipboard journey for the synthetic clipboard event. The route transition debt includes an observable article-content assertion.

## Verification evidence

| Command | Exit | Observed result |
|---|---:|---|
| `corepack pnpm run check` | 0 | Typecheck PASS; lint PASS; ordinary Vitest 17 files / 23 tests PASS; contract fixtures and real runner probes PASS; strict known-defect gate PASS |
| `node scripts/verify-known-defects-fixtures.mjs` | 0 | Poisoned TypeError report, wrong status, signal, runner error, malformed report, counter, identity, unexpected assertion, and unexpected pass fixtures rejected |
| `node scripts/verify-known-defect-runner-probes.mjs` | 0 | 5/5 real runner probes classified with expected origin/name |
| `corepack pnpm run test:known-defects` | 0 | Supported report schema; raw child status 1; 4/4 failed suites; 9/9 failed registered assertions; 0 passed, pending, todo, unhandled, or runner errors |
| `corepack pnpm exec tsc -p tsconfig.spec.json --noEmit` | 0 | TypeScript verification PASS |
| `git diff --check` | 0 | No whitespace errors |

The raw and structured known-defect artifacts are retained at `.artifacts/known-defects.raw.log`, `.artifacts/known-defects-report.json`, and `.artifacts/known-defects-result.json`. Earlier evidence reports under `/home/hermes/.hermes/work/thinaticsystem-modernization/` were not modified.

## Requirement disposition

| ID | Status | Evidence |
|---|---|---|
| `blog-card-nested-anchor` | expectedFAIL | Semantic anchor/focus assertion at `src/known-defects/blog-card.nested-anchor.spec.ts:26` |
| `blog-http-error-loading` | expectedFAIL | Scoped RxJS identity capture; loading assertion at `src/known-defects/requirements.debt.spec.ts:96` |
| `blog-concurrent-page-order` | expectedFAIL | Late older response assertion at `src/known-defects/requirements.debt.spec.ts:115` |
| `article-route-parameter-transition` | expectedFAIL | New article-content assertion at `src/known-defects/requirements.debt.spec.ts:136` |
| `article-404-loading-cleanup` | expectedFAIL | Redirect/loading assertion at `src/known-defects/requirements.debt.spec.ts:154` |
| `notification-replacement-lifetime` | expectedFAIL | Replacement timer assertion at `src/known-defects/requirements.debt.spec.ts:166` |
| `discography-empty-loading` | expectedFAIL | Empty-result loading assertion at `src/known-defects/requirements.debt.spec.ts:178` |
| `discography-image-error-loading` | expectedFAIL | Required semantic image locator/error assertion at `src/known-defects/requirements.debt.spec.ts:193` |
| `unsafe-html-content` | expectedFAIL / security review | Unsafe-content assertion at `src/known-defects/requirements.debt.spec.ts:200`; no security remediation claimed |

## Finding disposition

Resolved test-boundary findings: `TB-001-authoritative-error-kind-and-origin`, `TB-002-scoped-rxjs-error-lifetime`, `TB-003-required-semantic-image-fixture`, `TB-004-calibrated-requirement-claims`.

Unresolved product/policy findings intentionally retained: `DEBT-blog-http-error-loading`, `DEBT-blog-concurrent-page-order`, `DEBT-article-route-parameter-transition`, `DEBT-article-404-loading-cleanup`, `DEBT-notification-replacement-lifetime`, `DEBT-discography-loading`, `SEC-unsafe-html-boundary`, and `POLICY-provider-specific-iframe-allowlist`. These remain explicit debt or undefined policy; this task did not fix or accept them.

## Protected-source check

The 75 tracked product-source files in `src/` at `a21dba1` (excluding known-defect specs and all `*.spec.*` files) have zero changed paths and therefore zero byte mismatches against the candidate. No product source file was added. The only `src/` change is the allowed test-only `src/known-defects/requirements.debt.spec.ts`.

Nix, remote CI, Cloudflare/live CMS, deployment, visual inspection, screen-reader operation, and product remediation remain out of scope.
