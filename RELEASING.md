# Releasing

`my-svelte-app` deploys every merge to `main` on Vercel, so a release does not ship code. A release is a **dated, curated record**: a changelog section, a refreshed quality snapshot and an overview that matches the code at that tag. It follows the release process of `finance-tools`, scaled down to one app.

Versions are **CalVer `YYYY.0M.0D`** (for example `2026.11.08`), the date the release was cut. There is no version to bump in `package.json`; the tag is the version. Cut a release when there is something worth recording, aiming for about once a week. Skipping a week is normal, and an empty release is noise.

## Steps

### 1. Curate the changelog

In [CHANGELOG.md](CHANGELOG.md), rename `## [Unreleased]` to `## [YYYY.0M.0D] — YYYY-MM-DD` and add a fresh, empty `## [Unreleased]` above it. The section is curated highlights grouped by area, with PR numbers, not a commit list. Open it with one line: the number of PRs and the through-line of the release.

```sh
prev=$(git describe --tags --abbrev=0)      # the previous release
git log "$prev"..HEAD --oneline
```

### 2. Refresh the quality snapshot

Update the dated block in [docs/quality/README.md](docs/quality/README.md): run `npm run test:coverage`, `npm run lint` and `npm audit --omit=dev`, and copy the figures in, with today's date and the commit.

### 3. Curate the overview

Read [docs/overview.md](docs/overview.md) against what changed. Add a line to *Release history*, move roadmap items that landed, and add a decision when a new ADR was accepted. If nothing else changed, only the release named at the top moves.

### 4. PR it

Commit `CHANGELOG.md`, `docs/quality/` and `docs/overview.md` on a branch named `release/YYYY.0M.0D`, open a PR and merge it once CI is green. `main` requires a PR and a passing `test` check.

### 5. Tag it

Tag the merge commit on `main` and push the tag. This is the one outward step:

```sh
git switch main && git pull --ff-only
git tag -a YYYY.0M.0D -m "YYYY.0M.0D"
git push origin YYYY.0M.0D
```

Then create the GitHub release from the tag as a **pre-release**, with the changelog section as its notes:

```sh
gh release create YYYY.0M.0D --verify-tag --prerelease --title YYYY.0M.0D --notes-file <(awk '/^## \[YYYY.0M.0D\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md)
```

## Conventions

- **One release per day.** If a second is really needed, append a counter (`2026.11.08.1`); never move a published tag.
- **Pre-release.** The app is under active development with no supported older versions.
- **Generated data is not part of a release.** `src/lib/data/*.json` is rebuilt in its own PR when its source changes (`docs/crosswalk.md`, `docs/size.md`).
