# Dependency updates with Renovate

`renovate.json` configures the hosted Renovate GitHub App. It does not install an App, run a self-hosted bot, merge a PR, or deploy the site.

## Policy

- Updates target **develop**, not production `master`. Keep `baseBranchPatterns` explicit.
- Ordinary PR creation: Monday 00:00–05:59 Asia/Tokyo, at most 3 open PRs and 2 new PRs/hour. The hosted service's own schedule determines the actual run time; this is an allowed window, not a promised start time.
- No automerge. Existing application CI and review remain mandatory. Major updates require Dependency Dashboard approval before PR creation.
- npm dependencies and the integrity-pinned pnpm `packageManager` use Renovate's npm manager. Ordinary npm releases wait 7 days; pnpm's existing peer, engine, build-script and release-age checks remain intact. Do not append release-age exemptions automatically to force a lock update through.
- Angular framework/build/template-lint packages are grouped, with major updates separated by Renovate's default major/minor split. TypeScript ESLint packages are grouped separately. Grouping is not proof of compatible peer dependencies: frozen installation and tests decide.
- GitHub Actions retain SHA digest pins. A narrowly scoped regex also keeps this repository's validator version in `.github/workflows/renovate-config.yml` discoverable; the validator is not an application dependency.
- Monthly lockfile maintenance (first day, 00:00–05:59 JST) requires Dashboard approval. Nix input/lock updates also require approval. These checks do not authorize merging.
- Dependency security alerts, when available to the App, use Renovate's vulnerability handling and may bypass ordinary scheduling/PR limits. Do not assume scheduled updates are a vulnerability response SLA.

## Compatibility holds

These are deliberate holds from the migration evidence, not a substitute for future maintenance:

| Dependency | Current allowed line | Removal condition |
| --- | --- | --- |
| TypeScript | `>=6.0.0 <6.1.0` | Review Angular compiler/build and TypeDoc peer ranges together. |
| Vitest | `>=4.0.8 <5.0.0` | Review Angular build peer range and rerun test-runner contracts. |
| KaTeX | `>=0.16.0 <0.17.0` | Review ngx-markdown peer range and rendered math. |
| Tailwind | `>=3.0.0 <4.0.0` | Complete separate visual and performance migration; prior v4 regression evidence stays intact. |
| `@types/node` | `>=24.0.0 <25.0.0` | Move with the actual candidate runtime. |

The npm `engines.node` update is disabled deliberately. The locked flake asserts candidate Node against `.node-version` and historical baseline Node against `.baseline-node-version`. A standalone engine bump or blindly refreshed Nix lock is not a valid runtime upgrade. On a Nix PR, inspect both provided Node versions, coordinate version files/engines as appropriate, and run `nix develop -c node --version` plus the existing install/check/build/paired tests. A failed assertion is a blocker, not grounds to remove the check. Historical baseline changes need their own review; do not rewrite old evidence or control hashes to manufacture PASS.

Renovate does not infer all these compatibility constraints from peer dependencies. Review the holds whenever the framework changes and during regular dependency maintenance. Held security fixes require explicit coordinated remediation rather than silent suppression.

## Installation and activation boundary

1. Inspect the existing App installation first. If needed, install [Mend Renovate](https://github.com/apps/renovate) for **ThinaticSystem/thinaticsystem.com only**; do not grant all repositories or add a PAT to this repository.
2. The modernization PR targets `develop` and is not automatically merged by this work. The GitHub default branch is currently `master`. Renovate normally reads configuration from the default branch, even when updates target a different branch.
3. Therefore merging a config only to `develop` does **not** establish activation. In a separately reviewed configuration-only change, place the same `renovate.json` filename on `master`, retaining `baseBranchPatterns: ["develop"]` and `useBaseBranchConfig: "merge"`. The framework-specific policy must only become active once the corresponding modernization has landed on `develop`. Check whether a `master` configuration change triggers the existing site's deployment before authorizing that change.
4. Check the App's onboarding PR, Dependency Dashboard and first actual update PR: base is `develop`, automerge is off, lockfiles are produced successfully, and application CI executes. Record unavailable App/CI evidence honestly. Do not enable broad writes as a shortcut.

An App installation alone or a locally valid config is not proof the bot is active. Repository/organization administrators may need to authorize App access. No App secret belongs in the browser bundle or repository.

## Validation

The separate `Renovate configuration` workflow uses a version-pinned official validator, read-only repository permission, disabled checkout credentials, and no npm install scripts. It does not run the bot. Its dependencies are fetched outside application `node_modules`; it does not alter the application lockfile.

To reproduce using the version pinned in that workflow:

```sh
npm_config_ignore_scripts=true npm exec --yes --package=renovate@44.103.7 -- renovate-config-validator --strict --no-global renovate.json
```

For extraction-only inspection, use that same Renovate version with `--platform=local --dry-run=extract` in an isolated copy. This does not create branches/PRs or test App permissions, hosted scheduling, branch selection, or actual lockfile regeneration. Keep logs out of committed source.

Official references: [configuration](https://docs.renovatebot.com/configuration-options/), [Nix manager](https://docs.renovatebot.com/modules/manager/nix/), [onboarding](https://docs.renovatebot.com/getting-started/installing-onboarding/), [validation](https://docs.renovatebot.com/config-validation/).
