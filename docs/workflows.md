# Workflows

What runs automatically, grouped by the stage it belongs to. Each GitHub workflow carries its stage in its name: **CI (merge gate)**, **API docs (deploy)**, **Release assets (deploy)** and **NYU data check (scheduled)**. This page is read from `.github/workflows/`, `.github/dependabot.yml`, `vercel.json` and the repository rulesets; Vercel's dashboard settings are not covered.

## The four stages

| Stage | What runs | Defined in | Trigger | Blocks a merge? |
|---|---|---|---|---|
| **Development** (feedback while a branch is open) | `lighthouse` | `ci.yml` | PR, and push to `main` | No, on purpose: scores wobble on shared runners |
| | API docs build (TypeDoc warnings) | `docs.yml`, `build` job | PR that touches `src/lib/**` or the docs config | No |
| | Vercel preview deployment | Vercel Git integration | Every PR | No |
| | The same commands on your machine | `package.json` scripts | You | n/a |
| **Merge gate** (must be green to merge) | `test` | `ci.yml` | PR, and again on push to `main` | **Yes**, the only required check |
| **Deployment** (publishes a release) | Release: the tag, by hand ([RELEASING.md](../RELEASING.md)); then the overview PDF and `metrics.json` at the tag, and the full release through jan-ru/.github's shared workflow | `release-assets.yml`, `build` and `release` jobs | A release tag, or by hand for a tag (`dry_run` on by default) | n/a |
| | Production deploy of the app to Vercel | `release-assets.yml`, `deploy` job; `vercel.json` turns off Vercel's deploys of `main` | After the release | n/a |
| | API reference to Cloudflare Pages | `docs.yml`, called by `release-assets.yml` | After the release, or by hand | n/a |
| | Overview PDF preview | `release-assets.yml`, `build` job | PR that touches the overview's inputs | No |
| | `metrics.json` for jan-ru/system-health | `ci.yml`, `metrics` job | Every push to `main`, after `test` and `lighthouse` | n/a |
| **Scheduled** (runs on a clock, not on a change) | NYU data check | `check-data.yml` | Monthly on the 1st at 06:00 UTC, or by hand | n/a |
| | Dependency updates (npm and GitHub Actions) | `dependabot.yml` | Weekly, Mondays | n/a |

## The merge gate

The ruleset `Protect_main` requires a pull request and a passing `test` check, and the check is strict: the branch must be up to date with `main` before it can merge (switched on 2026-11-13). It asks for no approvals. Repository admins can bypass the ruleset (bypass mode "always"). A second ruleset, `Basic_Rules`, forbids deleting or force-pushing any branch.

Because the check is strict, the tree that merges is the tree `test` passed on. When another PR lands first, the branch has to be updated (the "Update branch" button, or `@dependabot rebase` on a Dependabot PR) and `test` runs again, about 2 minutes.

The `test` job runs these commands in order, and the same ones work locally:

```sh
npm run check          # svelte-check, strict
npm run lint           # typescript-eslint strictTypeChecked, eslint-plugin-svelte
npm run format:check   # Prettier
npm run check:ts-only  # no .js, .mjs, .cjs or .jsx
npm run test:coverage  # Vitest, with the coverage floor on src/lib
npm run build
npx playwright install --with-deps chromium
npm run test:e2e       # every page in Chromium, with and without JavaScript, and axe
npm audit --omit=dev --audit-level=high
```

A failed run uploads the Playwright report as an artifact for 7 days.

## Deployment

Where each part goes:

```mermaid
flowchart LR
  DB[Dependabot] --> PR[Pull request]
  PR -->|merge once test is green| MAIN[main]
  MAIN --> TAG[Release tag]

  PR -->|every push| VP[Vercel preview]
  TAG -->|release-assets.yml| REL[Full release<br/>PDF and metrics.json]
  REL -->|deploy| VPROD[Vercel production<br/>the app]
  REL -->|docs.yml| CF[Cloudflare Pages<br/>API reference]
```

- **The app** goes to production only from a release: `release-assets.yml` uploads the tag to Vercel, which builds it with its production environment variables ([jan-ru/.github ADR-0001](https://github.com/jan-ru/.github/blob/main/docs/adr/0001-releases-from-one-shared-workflow.md)). `vercel.json` turns off Vercel's own deploys of `main`; every PR still gets a preview. The Vercel checks appear on a PR, but none of them is required.
- **The API reference** goes to Cloudflare Pages (<https://my-svelte-app-docs.pages.dev/>) after a release, or by hand from `main` or a tag. A pull request that touches `src/lib/**`, `typedoc.json`, `tsconfig.json`, `package.json`, `package-lock.json` or `docs.yml` itself only builds it. Deployments run one at a time and a newer one waits for a running one.
- **A tag is the only way to production.** It builds the release assets, creates the release, then deploys the app and the API reference ([RELEASING.md](../RELEASING.md)).
- **One repository.** For one day (2026-11-19) development ran in a private copy that published snapshots here; that was undone the same day ([ADR-011](adr/0011-one-public-repository.md)).

## Metrics for system-health

jan-ru/system-health collects one `metrics.json` per repository (its ADR-0002: it pulls the file, nothing here pushes). Since 2026.11.23 it reads the file attached to each release (system-health #16), which `release-assets.yml` builds at the tag with the same script. On every push to `main`, the `metrics` job in `ci.yml` runs after `test` and `lighthouse`, whatever their result. `scripts/build-metrics.ts` builds the file from the reports those jobs kept, using `src/lib/metrics.ts`, and the job uploads it as the artifact `metrics` for 90 days. The format is system-health's `schema/metrics.v1.schema.json`. A field that was not measured is left out, never written as 0:

| Field | From |
|---|---|
| `quality.coverage_pct` | Vitest line coverage of `src/lib` (`coverage/coverage-summary.json`); left out when a unit test failed |
| `quality.tests` | Vitest plus Playwright; a test that passed on retry counts as passed |
| `quality.type_errors`, `quality.lint_errors` | `0` when `npm run check` or `npm run lint` passed (both fail on any error); left out when they failed |
| `security.vulnerabilities` | `npm audit --package-lock-only` over every dependency, the same scope cap-tools reports, so the counts compare. The `test` gate itself audits runtime dependencies only |
| `security.scorecard` | OpenSSF Scorecard of the repository during a release run: the `scorecard` job in `release-assets.yml` runs the command-line tool (pinned, checked against its SHA-256) in default mode with its read-only token and no checkout, and `build` adds the result (jan-ru/system-health ADR-0005 and ADR-0009). Each check scored `-1` is left out; the whole field is left out when Scorecard fails or decides nothing. Releases only, not the `main` file of `ci.yml` |
| `performance.lighthouse` | The Lighthouse scores of the home page `/`: from the `lighthouse` job on `main`, and from `lhci collect` over the tag's build in `release-assets.yml` for a release. Left out when Lighthouse failed |
| `gates` | `test`, the one required check |

The steps that keep reports and the `metrics` job run only in `jan-ru/my-svelte-app`, not in forks.

## Things to know

- A merge deploys nothing. Production follows a release, and the shared release workflow refuses a tag whose PR did not pass `test`. The run of `test` on `main` after a merge is a signal after the fact; with the check strict it should only fail for a reason the tree does not explain, such as a flaky test or a new advisory in `npm audit`.
- `npm audit` is part of `test` but its result depends on the day, not on the change: a new advisory in a runtime dependency fails every open PR until it is handled.
- The ruleset binds to the job name `test`. If the job is renamed or split, keep a final job called `test` or change the ruleset in the same PR, or every PR waits for a check that never reports.
- Changing `docs.yml` triggers the API docs workflow, because the file is in its own path filter.
- Actions are pinned by commit SHA with the version in a comment; Dependabot moves both together.
