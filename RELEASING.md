# Releasing

**A release is what ships.** Production, the app on Vercel and the API reference, is deployed only from a release, never from a merge to `main` ([jan-ru/.github ADR-0001](https://github.com/jan-ru/.github/blob/main/docs/adr/0001-releases-from-one-shared-workflow.md)). A release is a full GitHub release with a curated changelog section, an overview PDF built at the tag (with the quality figures measured there) and `metrics.json`. The release itself is made by the shared release workflow in `jan-ru/.github`, the same one cap-tools uses. Which workflows run before a merge, which deploy and what a tag does not trigger: [docs/workflows.md](docs/workflows.md).

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

The tag runs `release-assets.yml`, in this order:

1. **Build:** the checks and tests at the tag, then `metrics.json` and `my-svelte-app-overview-YYYY.0M.0D.pdf`. A red check or test does not stop them: it shows on the quality page and in `metrics.json`.
2. **Release:** the shared workflow's guard refuses a tag that is not CalVer, is not on `main`, or is not the merge of a PR whose head passed `test`. Then it creates the **full** release with the tag's changelog section as its notes (`node scripts/release-notes.ts YYYY.0M.0D` previews them) and attaches both files.
3. **Production:** `deploy.yml` deploys the tag's code to Vercel production, and `docs.yml` publishes the API reference (step 6). Neither runs if the release was refused.

A manual run of `release-assets.yml` with `dry_run` off releases the tag again (an existing release keeps its notes; the assets are uploaded again) and deploys it. It uses the tag's own scripts and lockfile, so it only helps when the cause is outside the tag (a `gh` or Vercel outage, a label, a workflow file). A fix to the code needs a new release, because a published tag is never moved.

### 5. Rolling back

Run `deploy.yml` by hand (Actions → App production deploy → Run workflow) and name the earlier release's tag. It refuses a tag that has no full release. `docs.yml` takes a tag the same way for the API reference. The releases up to 2026.11.20 are pre-releases, so they cannot be rolled back to this way.

### 6. The API reference

Once the release exists, `release-assets.yml` runs `docs.yml`, which builds the API reference at the tag and deploys it to Cloudflare Pages at
<https://my-svelte-app-docs.pages.dev/>. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, as in finance-tools.

## Conventions

- **One release per day.** The shared workflow accepts only `YYYY.0M.0D`, with no counter, so a second release on the same day waits for the next day. Never move a published tag.
- **Full releases, never pre-releases.** A release is what production runs, and GitHub defines a pre-release as not ready for production (ADR-0001 part 5).
- **The deploy needs three repository secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. Without them `deploy.yml` refuses and says so.
- **Generated data is not part of a release.** `src/lib/data/*.json` is rebuilt in its own PR when its source changes (`docs/crosswalk.md`, `docs/size.md`).
