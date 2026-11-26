# Changelog

Curated highlights per release, not a per-commit list. Each release section becomes the GitHub release notes word for word; see [RELEASING.md](RELEASING.md). Versions are CalVer `YYYY.0M.0D`, the date the release was cut.

## [Unreleased]

## [2026.11.26] — 2026-11-26

19 merged PRs (#160, #164, #166 to #174, #176 to #183). The through-line is **typed failures in the data sources, a release that measures itself, and a login per person**: the three financial sources now run on Effect behind their unchanged promise interfaces, a release's `metrics.json` gains Lighthouse, OpenSSF Scorecard and a secret count, and Sign in with Google replaces the shared password.

### Financials: the data sources on Effect

- Effect v4 was piloted inside the Yahoo source (#168, #171, ADR-012), then extended to FMP (#174) and Eulerpool (#176) (#173, ADR-013, which supersedes ADR-012). Every exported fetcher keeps its promise signature, and the existing tests are the contract and pass unchanged. The failure kinds are part of each function's type, so leaving one unhandled, or passing a raw error on, does not compile.
- The three sources share one set of tagged failures and one boundary to `SourceError` in `http.ts`. FMP and Eulerpool already shared their fetch steps there in plain TypeScript (#172).
- A parser bug no longer reaches the caller as a raw error. It reaches the caller as "<source> is unavailable", and the log `detail` holds only the error's class name, never its text, which can carry a URL or a key.
- Why Effect: an experiment seeded the same mistakes into the plain and the Effect versions of each source. The compiler or lint caught 12 of 23 before the tests with Effect, against 7 of 23 in plain TypeScript. It also found gaps in the existing tests, now closed: FMP's error body against the status, the error's text in the log detail, and a failed Eulerpool currency lookup.
- Cost: the server function is 17,444 KiB, up from 13,732, of which `effect` is about 3.7 MiB, and it loads only on the `/financials` pages. On a preview, their cold start measured 357 to 377 ms against 306 ms for a public page (#177).

### Releases and security

- A release's `metrics.json` again has `performance.lighthouse`, now measured at the tag (#166), and gains `security.scorecard`, the OpenSSF Scorecard result (#167).
- gitleaks scans each pull request's commits in the `test` check, and counts the tree at the tag (#169, system-health ADR-0011). A false positive goes into `.gitleaks.toml` with a description, and output is always redacted.
- `SECURITY.md` says how to report a vulnerability, through GitHub's private reporting (#170).
- The shared release workflow's version is named beside its pinned commit (#164).

### Access

- Sign in with Google replaces the shared password (#180, ADR-014). Only the Google addresses on `ALLOWED_EMAILS` get in, checked again on every request, so one person's access can be withdrawn. The login runs on Web Crypto and `oauth4webapi`, so it works on Vercel, Cloudflare and a Node server alike. Previews have no login. Everyone logs in once more after the release.
- The design was written down first (#179), and ADR-014 was accepted after the first working sign-in (#181).

### Development

- `.env` files stay out of git (#182), and Claude Code runs the read-only checks without asking (#183).
- Prettier 3.10 (#160).

## [2026.11.23] — 2026-11-23

5 merged PRs (#156 to #161, without #160). The through-line is **a release is what runs in production**: each release now carries an overview PDF and `metrics.json` built at its tag, and it is the only way the app and the API reference reach production. This is the first full release; the two before it were pre-releases.

### Releases

- A release tag now deploys production (#161): `release-assets.yml` builds the PDF and `metrics.json` at the tag, calls jan-ru/.github's shared release workflow for a full release ([ADR-0001](https://github.com/jan-ru/.github/blob/main/docs/adr/0001-releases-from-one-shared-workflow.md)), then deploys the app to Vercel and the API reference to Cloudflare Pages. Vercel no longer deploys every merge to `main`, and a tag is `YYYY.0M.0D` only, so a second release waits a day.
- Every release carries `my-svelte-app-overview-<tag>.pdf` (#156): the design at a glance, the decisions grouped by theme, the release history, the quality figures measured at the tag and the roadmap by `lane:*` label. A release PR builds a preview of it. Its links point at the release's own files on GitHub (#159), and the data-flow heading stays with its diagram (#158, #157).

## [2026.11.20] — 2026-11-20

14 merged PRs here (#140 to #154, without #145), plus #7, #9, #10 and #11 of the archived working copy `jan-ru/my-svelte-app-dev`, whose commits came back with #147. The through-line is **one repository, a readable size page and a tighter toolchain**: a one-day detour through a private working copy, undone with its history kept; treemaps that zoom to the small countries and industries; and the dependency and lint updates that piled up meanwhile.

### Countries and Industries

- The treemaps zoom through the ranking (#154). Values span about five orders of magnitude, so the treemap shows one band of similar-sized items at a time (largest at most 25 times the smallest, 5 to 30 items), with the rest as a grey "more" strip on the right that opens the next band, and ◀ Larger / Smaller ▶ above it. Percentages stay shares of the global total, and the "Show data" table lists every item in every band.
- The band is in the URL (`band=2`) and is the one parameter anonymous visitors follow, so zooming works without logging in and without JavaScript, each band cached on its own (ADR-003, dated clarification).

### Repository and delivery

- Development moved to a private working copy that published snapshots to this repository (#7, #9, #10, #11, #146, ADR-010) and came back the same day (#147, ADR-011): this repository is again the only one, with the copy's commits merged in and its pull requests archived. Vercel, Dependabot and the API reference run from here again.
- The API reference is published to Cloudflare Pages at a release tag or by hand (<https://my-svelte-app-docs.pages.dev/>), no longer to GitHub Pages at every merge.
- CI publishes `metrics.json` for `jan-ru/system-health` on every push to `main` (#152).
- Docs: the workflows sorted by stage (#142), the strict required check on `main` (#143), and a shorter README with the detail in `docs/` (#144).

### Toolchain and dependencies

- ESLint 10 with typescript-eslint 8.73 and eslint-plugin-svelte 3.24 (#151). Its new `no-unsafe-class-instance-assignment` rule caught a mistyped test table in `yahoo.test.ts`.
- `max-statements` caps a function at 40 statements (#153); the largest today has 33.
- `actions/setup-node` 7.1.0 (#150), `@playwright/test` 1.65.1 and `@vercel/speed-insights` 2.1.0 (#149), `yahoo-finance2` 4.0.6 (#148), `hono` and `@hono/node-server` (#140, #141).

## [2026.11.12] — 2026-11-12

First release. Everything since the app was rebuilt on SvelteKit 3, from 2026-10-24 to 2026-11-12: 109 merged PRs (#7 to #138), plus the commits of the first day. It is published as a pre-release, because there is no earlier tag to compare it with. The through-line is **from one comparison page to a private valuation tool**: public reference pages that cost almost nothing to serve, and behind the login, a company's financials and a valuation against picked peers, all on one design system.

### Multiples and reference data

- **Home page** compares 1-4 multiples across regions and industries as grouped bar charts, from NYU workbooks read live with a 24 h cache and stale fallback (2026-10-24, ADR-001). Every selection is in the URL (ADR-002).
- **Find industry** maps SBI 2025 codes through NACE, ISIC, NAICS and SIC to the Damodaran industries, both ways (#18). **Companies** lists the companies behind an industry with region, sector, SIC and country filters (#19, #38 to #40) and links them to FMP or Yahoo (#21, #22, #31).
- **Countries and Industries** show each one's share of the global total as a treemap and ranked bars, by company count or GDP (#46 to #57). Inflation and real GDP growth for the selected countries (#92, #98); treemap tiles can be clicked to select again, and the selector's lists are sorted (#93, #94).

### Public site, login and layout

- Public pages are a cached static view for anonymous visitors, interactive after login (#43, #45, ADR-003). One `/login` page serves every "Log in" link and returns the visitor to where they were (#85).
- CAP Tools design tokens and global styles (#35); an Explore menu, a side menu and a footer with sources (#37, #55, #60 to #62). The menubar wraps on a phone instead of scrolling the page sideways (#109). Vercel Web Analytics and Speed Insights (#63, #65).
- The About page follows the README, with an "On this page" side menu (#83, #121).

### Financials (`/financials`)

- Password-protected statements for the last 5 years from FMP (#25, ADR-004), with statement tabs and TTM (#27), company profile and news (#28), and a stock price tab with a one-year chart (#29). A condensed balance sheet (#131).
- Yahoo Finance as a second source, one source per view (#32, #34, ADR-005). Ratios, Estimates, Earnings and Peers tabs (#64). Follow-ups from its review (#123); only Yahoo's own not-found answer becomes a cached empty result, so a transient failure is no longer remembered for a day (#138).
- Eulerpool as a third source, used only when asked for (#99), with its fair value and quality score beside the valuation (#100) and a Supply chain tab marked as a test (#101).
- One registry of tab loaders and one component per view, with render tests (#67, #69, #70). A shared Company side menu on Financials and Valuation (#122).

### Valuation (`/financials/valuation`)

- Values one company with multiples against peers picked by hand and its Damodaran sector, with a football-field chart and manual bands (#75 to #77, ADR-008).
- A private company from an uploaded Excel template, read once and never stored (#78).

### Design system and Horizon

- Horizon theme tokens generated from the Figma exports (#104), with Horizon's shadows and spacing (#105), a grid helper with Home on the grid (#106), the focus colour and width (#113) and the shell tokens for the header bar (#114). Render tests for the grid (#111, #112).
- Shared components replace repeated markup: Icon (#115), Callout for errors, notices and caveats (#125), SegmentedNav for the period and source switches (#126), AppHeader for the menubar (#127), Status and DataTable (#128). Seven more tables moved to DataTable, with the site tested without JavaScript (#137). One global `.sr-only` instead of four copies (#116).

### Quality and housekeeping

- TypeScript only, strict, with a no-JavaScript guard (#20); coverage floor, `npm audit` and Lighthouse CI (#30); CSP and security headers (2026-10-25).
- The six-point TypeScript review: readonly data shapes, typed JSON imports and type guards instead of casts (#81); `noUncheckedIndexedAccess`, the `at()`/`get()` and `attempt()` helpers, typescript-eslint `strictTypeChecked` and Prettier, all in CI (#82, ADR-007).
- Node 24 LTS pinned in one tested place (#59, ADR-009). TypeDoc API reference published to GitHub Pages (#71, #73, #80).
- Second review round (#84): a site error page and `handleError` that logs unexpected errors with a reference; Playwright smoke tests with axe in CI, which found and fixed a Vercel Analytics crash under SvelteKit 3 and link colours below WCAG AA contrast; actions pinned by commit SHA and watched by Dependabot; capped FMP body reads, an early upload size check and bounded in-memory caches; the home and classification pages split into components.
- Refactors: size and valuation modules grouped in folders (#117), data tables split out of the token build and fetcher sets out of financials (#119), link and label logic moved out of three page components (#120), one shared source-failure message (#96).
- Documentation: the design at a glance as a landscape and a data flow (#95, #124), CLAUDE.md slimmed with the `/financials` detail in `docs/financials.md` (#118), AGENTS.md as the single instruction file (#129), and Svelte MCP setup (#130).
- Dependabot updates to the GitHub Actions and Playwright (#86 to #91).
