# Changelog

Curated highlights per release, not a per-commit list. Each release section becomes the GitHub release notes word for word; see [RELEASING.md](RELEASING.md). Versions are CalVer `YYYY.0M.0D`, the date the release was cut.

## [Unreleased]

### Releases

- A release tag now deploys production: `release-assets.yml` builds the PDF and `metrics.json` at the tag, calls jan-ru/.github's shared release workflow for a full release, then deploys the app to Vercel and the API reference to Cloudflare Pages. Vercel no longer deploys every merge to `main`.

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
