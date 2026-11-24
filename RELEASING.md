# Releasing

A release is **what runs in production**: the app and the API reference are deployed only from a release tag, never from a push to `main` ([jan-ru/.github ADR-0001](https://github.com/jan-ru/.github/blob/main/docs/adr/0001-releases-from-one-shared-workflow.md), the release standard of every jan-ru repository with production software). A release also carries a curated changelog section, an overview PDF built at the tag (with the quality figures measured there) and `metrics.json`. Which workflows run before a merge, which deploy and what a tag does not trigger: [docs/workflows.md](docs/workflows.md).

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

Everything after that runs by itself.

## What the tag does

The tag runs `release-assets.yml`:

1. **`scorecard`** runs OpenSSF Scorecard against the repository as it is then, and **`build`** runs the checks and tests at the tag and builds `my-svelte-app-overview-YYYY.0M.0D.pdf` and `metrics.json`, with Scorecard's result as `security.scorecard`. A red check or test does not stop them: it shows on the PDF's quality page and in `metrics.json`. A Scorecard failure is a warning and leaves the field out. To move to a new Scorecard version, change `SCORECARD_VERSION` and `SCORECARD_SHA256` together (the hash is the `linux_amd64` line of the release's `scorecard_checksums.txt`).
2. **`release`** calls the shared release workflow. It refuses the tag unless its commit is on `main` and is the merge of a PR that passed `test`, takes the notes from the tag's section of `CHANGELOG.md` (a missing or empty section is refused; `node scripts/release-notes.ts YYYY.0M.0D` prints what it will find), creates a **full release** and attaches the PDF and `metrics.json`.
3. **`deploy`** deploys the tag to Vercel production. Vercel builds it with its production environment variables. It needs the repository secret `VERCEL_TOKEN` and the variables `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`.
4. **`api-docs`** runs `docs.yml` for the tag, which builds the API reference and deploys it to Cloudflare Pages at <https://my-svelte-app-docs.pages.dev/>. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, as in finance-tools.

A refused tag, or a failed `build`, gets no release and deploys nothing. A manual run (Actions → Release assets → Run workflow, the tag, `dry_run` off) uses the tag's own scripts and lockfile, so it helps only when the cause is outside the tag (a `gh` or Vercel outage, a label, a secret). Otherwise delete the unreleased tag (`git push origin :refs/tags/YYYY.0M.0D`), fix the cause in a PR, and tag again. A tag that has a release is never moved.

**Rollback:** Vercel's Instant Rollback to an earlier release's deployment, or a manual run of `release-assets.yml` for that release's tag with `dry_run` off, which deploys it again.

## Conventions

- **One release per day.** The shared workflow accepts `YYYY.0M.0D` only, so a second release waits for the next day.
- **Full releases.** A release is what is deployed, so it is never marked as a pre-release. The releases before this change were, and stay so as history.
- **Generated data is not part of a release.** `src/lib/data/*.json` is rebuilt in its own PR when its source changes (`docs/crosswalk.md`, `docs/size.md`).
