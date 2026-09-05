# Repository guide

## Read only what the change needs
- Start at `src/app/app.routes.ts`; follow the affected feature's component and colocated tests.
- Shared behavior belongs behind a small, application-independent contract only when it is genuinely reusable. Avoid speculative layers or splitting functions merely by length.
- See `docs/architecture.md` for boundaries and `docs/quality.md` for test/debt policy. Tool versions and commands live in `package.json`, `pnpm-lock.yaml`, and the Nix flake; do not duplicate version numbers here.

## Development and verification
- Install: `corepack pnpm install --frozen-lockfile`. Develop: `corepack pnpm start`.
- Core checks: `corepack pnpm run check`; production build: `corepack pnpm run build`.
- Additional checks: `docs:check`, `test:e2e`, `perf:check`, `deploy:check` via `corepack pnpm run`. Build before artifact/browser checks; produce fresh browser evidence before performance checks.
- Production output is `dist/app/browser/`; generated evidence/docs belong in ignored `.artifacts/`.
- A script's successful exit proves only the contract it actually checks. Report unavailable Nix, browser, remote CI, deployment, or manual accessibility verification separately.

## Behavior and tests
- Preserve public URLs, content, navigation, and performance. Keep framework/compiler/runtime versions within their documented compatibility intersection.
- Derive tests from intended observable behavior; include relevant failure, boundary, and repeated-action cases. Prefer role and accessible name for UI actions and assertions.
- Start accessibility work with native HTML and verify keyboard/focus behavior; axe alone does not establish screen-reader usability.
- Keep pre-existing defects as real failing requirements in the named debt suite unless their repair is authorized. Never mask unknown failures, runner errors, missing tests, or unexpected passes as known debt.
- Use deterministic external fixtures in automated tests; do not write to the live CMS or treat a mock API as deployment evidence.
- Document non-obvious contracts, guarantees, and tradeoffs rather than restating parameter names. Keep this guide short; details belong next to their owner.
