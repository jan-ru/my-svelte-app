# Releasing

`my-svelte-app` deploys every merge to `main` on Vercel, so a release does not ship code. A release is a **dated, curated record**: a changelog section, an overview PDF built at the tag (with the quality figures measured there) and `metrics.json`. It follows the release process of `finance-tools`, scaled down to one app. Which workflows run before a merge, which deploy and what a tag does not trigger: [docs/workflows.md](docs/workflows.md).

Versions are **CalVer `YYYY.0M.0D`** (for example `2026.11.08`), the date the release was cut. There is no version to bump in `package.json`; the tag is the version. Cut a release when there is something worth recording, aiming for about once a week. Skipping a week is normal, and an empty release is noise.

## Steps

### 1. Curate the changelog

In [CHANGELOG.md](CHANGELOG.md), rename `## [Unreleased]` to `## [YYYY.0M.0D] — YYYY-MM-DD` and add a fresh, empty `## [Unreleased]` above it. The section is curated highlights grouped by area, with PR numbers, not a commit list. Open it with one line: the number of PRs and the through-line of the release. That line is also the release's row on the PDF's history page.

```sh
prev=$(git describe --tags --abbrev=0)      # the previous release
git log "$prev"..HEAD --oneline
```

### 2. Curate the overview

Read [docs/overview.md](docs/overview.md) against what changed. It holds only the curated parts of the PDF: §1, the opening paragraph of each page, the history from before the first release and the roadmap's *Later*. When a new ADR is accepted, give it a theme in `ADR_THEMES` (`src/lib/overview/adr.ts`); `npm test` fails until it has one. Give every open issue and every PR merged since the last tag a `lane:*` label (a PR also takes the lane of a labelled issue it closes); one without shows under *Unsorted* and the build warns.

### 3. PR it

Commit on a branch named `release/YYYY.0M.0D`, open a PR and merge it once CI is green. The PR runs `release-assets.yml`, which builds a preview of the PDF (quality "not measured") as the `release-assets` artifact: read it before merging. `main` requires a PR and a passing `test` check on a branch that is up to date with `main`.

### 4. Tag it

Tag the merge commit on `main` and push the tag. This is the one outward step:

```sh
git switch main && git pull --ff-only
git tag -a YYYY.0M.0D -m "YYYY.0M.0D"
git push origin YYYY.0M.0D
```

The tag runs `release-assets.yml`. It creates the GitHub **pre-release** with the changelog section as its notes (`node scripts/release-notes.ts YYYY.0M.0D` prints them), runs the checks and tests at the tag, and attaches `my-svelte-app-overview-YYYY.0M.0D.pdf` and `metrics.json`. A red check or test at the tag does not stop the PDF: it shows on the quality page. If the build fails, the release still stands. A manual re-run with `dry_run` off uses the tag's own scripts and lockfile, so it only helps when the cause is outside the tag (a `gh` outage, a label, the workflow file). A fix to the script, the parsers or a dependency needs a new tag (`YYYY.0M.0D.1`), because a published tag is never moved. The tag also runs `docs.yml` (step 5).

### 5. The API reference

Pushing the tag runs `docs.yml`, which builds the API reference and deploys it to Cloudflare Pages at
<https://my-svelte-app-docs.pages.dev/>. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, as in finance-tools.

## Conventions

- **One release per day.** If a second is really needed, append a counter (`2026.11.08.1`); never move a published tag.
- **Pre-release.** The app is under active development with no supported older versions.
- **Generated data is not part of a release.** `src/lib/data/*.json` is rebuilt in its own PR when its source changes (`docs/crosswalk.md`, `docs/size.md`).
