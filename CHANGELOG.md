# Changelog

Curated highlights per release, not a per-commit list. Each release section becomes the GitHub release notes word for word; see [RELEASING.md](RELEASING.md). Versions are CalVer `YYYY.0M.0D`, the date the release was cut.

## [Unreleased]

Everything since the app was rebuilt on SvelteKit 3, from 2026-10-24 to 2026-11-01: 63 merged PRs (#7 to #82), plus the commits of the first day. No release has been tagged yet; the first cut renames this heading. The through-line is **from one comparison page to a private valuation tool**: public reference pages that cost almost nothing to serve, and behind the login, a company's financials and a valuation against picked peers.

### Multiples and reference data

- **Home page** compares 1-4 multiples across regions and industries as grouped bar charts, from NYU workbooks read live with a 24 h cache and stale fallback (2026-10-24, ADR-001). Every selection is in the URL (ADR-002).
- **Find industry** maps SBI 2025 codes through NACE, ISIC, NAICS and SIC to the Damodaran industries, both ways (#18). **Companies** lists the companies behind an industry with region, sector, SIC and country filters (#19, #38 to #40) and links them to FMP or Yahoo (#21, #22, #31).
- **Countries and Industries** show each one's share of the global total as a treemap and ranked bars, by company count or GDP (#46 to #57).

### Public site, login and layout

- Public pages are a cached static view for anonymous visitors, interactive after login (#43, #45, ADR-003).
- CAP Tools design tokens and global styles (#35); an Explore menu, a side menu and a footer with sources (#37, #55, #60 to #62). Vercel Web Analytics and Speed Insights (#63, #65).

### Financials (`/financials`)

- Password-protected statements for the last 5 years from FMP (#25, ADR-004), with statement tabs and TTM (#27), company profile and news (#28), and a stock price tab with a one-year chart (#29).
- Yahoo Finance as a second source, one source per view (#32, #34, ADR-005). Ratios, Estimates, Earnings and Peers tabs (#64).
- One registry of tab loaders and one component per view, with render tests (#67, #69, #70).

### Valuation (`/financials/valuation`)

- Values one company with multiples against peers picked by hand and its Damodaran sector, with a football-field chart and manual bands (#75 to #77, ADR-008).
- A private company from an uploaded Excel template, read once and never stored (#78).

### Quality and housekeeping

- TypeScript only, strict, with a no-JavaScript guard (#20); coverage floor, `npm audit` and Lighthouse CI (#30); CSP and security headers (2026-10-25).
- The six-point TypeScript review: readonly data shapes, typed JSON imports and type guards instead of casts (#81); `noUncheckedIndexedAccess`, the `at()`/`get()` and `attempt()` helpers, typescript-eslint `strictTypeChecked` and Prettier, all in CI (#82, ADR-007).
- Node 24 LTS pinned in one tested place (#59, ADR-009). TypeDoc API reference published to GitHub Pages (#71, #73, #80).
- Second review round: a site error page and `handleError` that logs unexpected errors with a reference; Playwright smoke tests with axe in CI, which found and fixed a Vercel Analytics crash under SvelteKit 3 and link colours below WCAG AA contrast; actions pinned by commit SHA and watched by Dependabot; capped FMP body reads, an early upload size check and bounded in-memory caches; the home and classification pages split into components.
