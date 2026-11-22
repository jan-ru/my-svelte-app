# A release overview PDF at each tag

**Date:** 2026-11-22 · **Status:** design approved in chat, spec under review

## Goal

Every release carries an A4 PDF, `my-svelte-app-overview-<tag>.pdf`, with content like the finance overview that `finance-tools` attaches to its releases (`ft-overview build`, `release-assets.yml`): a cover, the design at a glance, design decisions, release history, quality and roadmap. Pushing a release tag creates the GitHub pre-release and attaches the PDF and `metrics.json`, with no other manual step. This is the *Later* item "Build the overview at each tag automatically, as `finance-tools` does" in `docs/overview.md`.

## Non-goals

- Porting `ft-overview` (Python, ReportLab). This repo stays TypeScript only. The PDF is HTML printed by Chromium, which Playwright already provides.
- System fiches (appendix pages) and an example-output page. They can be added later as sections.
- Rebuilding or redeploying the app at a tag. Vercel deploys `main`, and that does not change.

## Content

| # | Page | Source | Generated or curated |
|---|---|---|---|
| 0 | Cover and contents | Tag, tag date, short commit, the list of sources | Generated |
| 1 | Design at a glance | §1 of `docs/overview.md`: the one sentence, the two mermaid diagrams, the layers table and the principles | Curated |
| 2 | Design decisions | `docs/adr/*.md` frontmatter (`status`, `date`) and the `# ADR-NNN: Title` heading. A count line: "N ADRs: a accepted, s superseded". The accepted ones are grouped by theme from `ADR_THEMES`. The superseded ones are listed as "ADR-010 → ADR-011" | Generated, plus a curated intro |
| 3 | Release history | Each `## [YYYY.0M.0D] — YYYY-MM-DD` section of `CHANGELOG.md`: date, its opening line (the through-line), and the number of merged PRs between the previous tag and this one (from `git log --merges` and the `(#NNN)` squash subjects) | Generated, plus a curated intro and the curated pre-release rows |
| 4 | Quality | The reports of a run at the tag, through `buildMetrics` (`src/lib/metrics.ts`): test counts, Playwright count, coverage of `src/lib` against the floor, lint and audit result. Beside them, the *Health at a glance* table of `docs/quality/README.md` | Generated, plus curated |
| 5 | Roadmap | Lanes come from the GitHub labels `lane:valuation`, `lane:financials`, `lane:reference`, `lane:design-system` and `lane:releases`. *Landed* is the PRs merged between the previous tag and this one, *Next* is the open issues, and *Later* comes from `overview.md` | Generated, plus curated *Later* |

The curated parts stay in `docs/overview.md`, which becomes the source for the PDF's prose. They are §1, an intro paragraph per generated page, the history rows from before the first release, and the *Later* column per lane. Its hand-written decisions table, release-history table (from the first release on) and roadmap *Now*/*Next* columns are removed, so each fact has one copy. `overview.md` links to the latest release PDF in their place.

How the curated parts are found in `overview.md`: by heading. The parser takes the sections `## 1. The design at a glance`, `## 2. Design decisions` and the others by number, and fails if one is missing. Inside a section, the parser reads the opening paragraph as the intro, and two tables by their header row: `| When | Theme |` (pre-release history) and `| Lane | Later |`.

### Roadmap rules

- An issue's lane is its `lane:*` label. An open issue with no lane label goes in an **Unsorted** row, and the build prints a warning. An issue with two lane labels goes in the first lane, in the order above, and also gives a warning.
- *Landed* is exactly the PRs whose numbers appear as `(#NNN)` in `git log <previous tag>..<tag>` subjects; each is looked up with `gh pr view`. A PR's lane comes from the issues it closes (`closingIssuesReferences`), or from its own `lane:*` label. Otherwise it goes in **Unsorted**. Dependabot PRs (the `dependencies` label) are counted in one line, "n dependency updates", not listed.
- A lane with nothing in it shows "—".
- The labels are created once, by hand, with `gh label create`. Each of the 6 open issues (#108, #110, #132 to #135) gets one, in the same PR.

## Code

Pure code in `src/lib/overview/`, data in and data out, each part with Vitest tests and no network:

| File | Does |
|---|---|
| `adr.ts` | `parseAdr(fileName, text) → Adr` (number, title, status, `supersededBy`, date); `ADR_THEMES` (`as const`); `decisionsView(adrs)` |
| `changelog.ts` | `parseChangelog(text) → readonly ReleaseSection[]`; `releaseNotes(text, tag) → string` (replaces the `awk` in RELEASING.md) |
| `curated.ts` | `parseOverview(markdown) → Curated` (the sections and tables above), refusing a missing heading |
| `roadmap.ts` | `roadmapView(issues, prs, later) → readonly LaneRow[]` with the rules above |
| `quality.ts` | `qualityView(metrics, floor) → QualityView` |
| `document.ts` | `renderOverview(input) → string`, the whole HTML document with a print stylesheet (A4, the page footer "date · file name · n/N" through CSS `@page`), using `marked` for the curated Markdown |

Every type that an exported signature names is exported (TypeDoc warns otherwise). Data shapes are `readonly`. No function has more than 40 statements.

I/O lives in `scripts/build-overview.ts`, the only part that touches files, `git`, `gh` and the browser:

```sh
node scripts/build-overview.ts --release 2026.11.29 --reports reports/ --out my-svelte-app-overview-2026.11.29.pdf
```

It does the following:

1. Reads `docs/adr/`, `CHANGELOG.md`, `docs/overview.md` and `docs/quality/README.md` at the checked-out tag.
2. Runs `git` for the tag date, the commit, the previous tag and the merge subjects.
3. Runs `gh issue list --state open --json number,title,labels`, and `gh pr view <n> --json number,title,labels,closingIssuesReferences` for each PR number found in `git log <previous tag>..<tag>`.
4. Reads the report files `build-metrics.ts` reads.
5. Calls `renderOverview`.
6. Opens the HTML in `chromium` from `@playwright/test`, injects `node_modules/mermaid/dist/mermaid.min.js` with `addScriptTag` (no CDN), waits until every `.mermaid` block holds an `svg`, and calls `page.pdf({ format: 'A4', printBackground: true })`.

Without `--reports`, the quality page says "not measured", which is useful for a local preview. A missing input fails the build with a message naming it: an unparseable ADR or changelog section, or a missing `overview.md` section. A failed `gh` call fails it too.

New dev dependencies are `marked` and `mermaid`. An `npm run overview -- --release X --out f.pdf` script wraps it.

## Workflow: `.github/workflows/release-assets.yml`

The same shape as `finance-tools`' `release-assets.yml`, scaled down. Actions are pinned by SHA, as in `ci.yml` and `docs.yml`.

- **Triggers:**
  - a push of a tag matching `docs.yml`'s pattern;
  - `workflow_dispatch` with inputs `tag` (an existing tag) and `dry_run` (default `true`).
- **`plan`:** resolves the tag and `dry_run`. A tag push is never a dry run.
- **`release`** (`contents: write`, needs `plan`, skipped on a dry run):
  - checks out the tag;
  - writes the notes with `node scripts/release-notes.ts <tag>`, a thin wrapper around `releaseNotes`;
  - runs `gh release create <tag> --verify-tag --prerelease --title <tag> --notes-file …`, but only if `gh release view <tag>` fails. A re-run never rewrites notes.
- **`build`** (`contents: read`, `issues: read`, `pull-requests: read`, needs `plan`):
  - checkout of the tag with `fetch-depth: 0`, so the previous tag exists;
  - `npm ci`;
  - `npm run check` and `npm run lint` (their outcomes feed `metrics.json`, as in `ci.yml`);
  - `npm run test:coverage` with the json reporter;
  - `npm run build`;
  - `npx playwright install --with-deps chromium`;
  - `npm run test:e2e` with the json reporter;
  - `npm audit --omit=dev --json`.

  These test steps are `continue-on-error`: a red suite shows as such in the PDF and does not stop it. Then `build-metrics.ts` writes `metrics.json`, and `build-overview.ts` writes the PDF (`GH_TOKEN` is the workflow token). Both are uploaded as a workflow artifact.
- **`attach`** (`contents: write`, no checkout, needs `release` and `build`, skipped on a dry run): `gh release upload <tag> *.pdf metrics.json --clobber`.
- **Concurrency:** grouped per tag, so two runs never race on one release's assets.

A failed `build` cannot undo the release, because the release is created first. The fix is a re-run, or a `workflow_dispatch` with `dry_run: false`.

## Docs changed in the same PR

- `RELEASING.md`:
  - Step 2 (copy the figures into `docs/quality/README.md`) goes, because the PDF measures them at the tag. Its *Measured* block keeps the history and points to the release PDFs.
  - Step 3 is reduced to the curated parts of `overview.md`, plus giving new issues a `lane:*` label.
  - Step 5 becomes "push the tag": the workflow creates the release and attaches the PDF and `metrics.json`.
- `docs/workflows.md`: a row for `release-assets.yml`, and the diagram's tag node.
- `docs/overview.md`: reshaped as described under *Content*.
- `docs/quality/README.md`: the *Measured* note.

## Testing

- Unit tests for every function in `src/lib/overview/`, on small fixtures. There is also one test each over the real `docs/adr/`, `CHANGELOG.md` and `docs/overview.md`, so a future edit that breaks parsing fails `npm test`. Two of those tests check rules directly: every accepted ADR has an entry in `ADR_THEMES`, and every released changelog section has notes.
- `renderOverview` is tested on its HTML: the sections are present, the counts are right, and curated Markdown is escaped where it should be.
- The PDF itself is checked by hand once: a local `npm run overview` for `2026.11.20`, and a `workflow_dispatch` dry run on `2026.11.20` after the PR merges. CI does not compare PDFs byte for byte.

## Open risks

- Mermaid's layout in headless Chromium can differ slightly from GitHub's. That is acceptable, since the PDF is the record of what Chromium drew.
- The first release has no previous tag: its *Landed* column and PR count cover all history up to it, so they are long. The page caps *Landed* at 8 items per lane, with "+n more" as finance-tools does.

## Refinements during planning

1. `build-overview.ts` takes `--metrics <metrics.json>` (written by `build-metrics.ts`), not `--reports`: `buildMetrics` needs the `GITHUB_*` values the workflow sets.
2. Without `--release` the script builds a *preview* from `HEAD`: Landed since the newest release tag, quality "not measured". `release-assets.yml` builds it on a PR that touches the PDF's inputs, as an artifact, so a release PR shows its PDF before the tag.
3. The page footer comes from `page.pdf`'s `footerTemplate`, not CSS `@page`.
4. A tag cut before this workflow existed (`2026.11.12`, `2026.11.20`) cannot be rebuilt: its checkout has no script and its `overview.md` the old shape. The first PDF comes with the next release.
5. Modules in `src/lib/overview/` import each other relatively with `.ts`, because Node runs `scripts/build-overview.ts` directly and `#lib/*` resolves without an extension.
