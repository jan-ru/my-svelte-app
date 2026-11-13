# Development

Getting started, scripts, the project layout, the tech stack and the checks CI runs. The rules for contributors and agents are in `AGENTS.md` (`CLAUDE.md` is a symlink to it); the design is in [overview.md](overview.md); what runs in CI, and when, is in [workflows.md](workflows.md).

## Getting started

Prerequisites: [Node.js](https://nodejs.org) 24.x (pinned in `package.json` under `engines`, and in `.nvmrc`, so `nvm use` picks it) and npm. The project stays on one Node LTS line; moving to the next one means changing `engines`, `.nvmrc`, the CI workflows and `@types/node` together (a test checks they agree).

```sh
git clone https://github.com/jan-ru/my-svelte-app.git
cd my-svelte-app
npm install
npm run dev
```

The dev server runs at <http://localhost:5173>.

## Scripts

| Command                                       | Description                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                                 | Start the Vite dev server                                                         |
| `npm run build`                               | Create a production build                                                         |
| `npm run preview`                             | Preview the production build locally                                              |
| `npm test`                                    | Run the unit tests (no network)                                                   |
| `npm run test:coverage`                       | Run the tests with a coverage report; fails below the floor in `vitest.config.ts` |
| `npm run test:e2e`                            | Browser tests with Playwright; run `npm run build` first                          |
| `npm run check`                               | Type-check the code with svelte-check (strict)                                    |
| `npm run lint`                                | ESLint (typescript-eslint strict, eslint-plugin-svelte)                           |
| `npm run format` / `format:check`             | Prettier: rewrite the files, or only check them                                   |
| `npm run check:ts-only`                       | Fail if the repository contains JavaScript source                                 |
| `npm run build:crosswalk` / `build:companies` | Regenerate the data files (see `docs/crosswalk.md`)                               |
| `npm run build:tokens`                        | Regenerate the Horizon CSS from the Figma exports (see `docs/horizon-tokens.md`)  |
| `npm run build:gdp`                           | Regenerate `gdp.json` and `macro.json` from the World Bank (see `docs/size.md`)   |
| `npm run check:data`                          | Fetch the real NYU files and confirm every multiple still resolves                |
| `npm run docs`                                | Build the TypeDoc reference of `src/lib` into `docs/api` (git-ignored)            |

`npm run check:data` also runs monthly in GitHub Actions (`.github/workflows/check-data.yml`); a failed run emails the repo owner. Run it by hand after NYU publishes new data (each January). If NYU renames a column, update the matching entry in `src/lib/catalog.ts`.

## Project structure

```
src/
  lib/
    catalog.ts          Multiples, regions, file names
    params.ts           URL parameters
    layout.ts           Reshapes data into chart panels
    chart.ts            Scales and formatting
    crosswalk.ts        SBI 2025 to Damodaran lookup, both directions
    companies.ts        Company list filtering, paging, filter links and the anonymous preview
    source.ts           FMP, Yahoo or Eulerpool: the choice per ticker and period
    source-data.ts      The shapes every source produces (Statement, Profile, NewsItem, PricePoint)
    financials-nav.ts   URL state of /financials (tab, statement, period)
    statements.ts       Builds and formats the statement tables
    company-menu.ts     The Company side menu shared by Financials and Valuation
    yahoo.ts            Capital IQ to Yahoo ticker mapping
    return-path.ts      Allow-list of pages the login may return to
    nav.ts              Explore links and the About sections
    icons.ts            The inline SVG icons
    size/               size.ts (shares of the global total, rest of world, cross cell), treemap.ts (squarified
                        treemap layout), nav.ts (URL state, SIZE_PARAMS), view.ts (view models of the size pages)
    gdp.ts, gdp-match.ts, macro.ts  World Bank GDP and macro data, and country-name matching
    valuation/          Valuation page: valuation.ts (calculation), figures, nav (URL state), template, company, format
    football-field.ts   Model of the football-field chart
    insight.ts          Eulerpool's fair value and quality score: types and formatting
    tokens-build.ts     Turns the Figma exports into CSS (pure); tokens-tables.ts holds its data tables
    styles/             Global CSS and the grid helper; generated/ holds the Horizon tokens
    data/               Generated crosswalk.json, companies.json, gdp.json and macro.json
    components/         Charts, tables, menus (SideMenu, SideLayout), Icon and the login prompt
    server/             Workbook download, parsing, cache, comparison; the FMP, Yahoo and Eulerpool clients and
                        parsers; financial-sources.ts and financials.ts (fetcher sets and tab loaders); session
                        auth; access rules (ISR, interactive)
  env.ts                Declares the private environment variables
  hooks.server.ts       Security headers, session and interactive flag, cache header
  routes/
    +page.server.ts     Load function
    +page.svelte        Home page (Multiples)
    (explore)/          Pages with the Explore side menu:
      classification/   SBI 2025 to Damodaran industry lookup
      companies/        Company list with industry, region, sector, SIC and country filters
      countries/        Country size versus global (companies or GDP)
      industries/       Industry and sector size versus global
    financials/         Password-protected financial statements (FMP, Yahoo or Eulerpool)
      valuation/        Valuation versus peers and sector, template download and upload
    login/              The login page and its login and logout actions
    about/              About page with an "On this page" menu
    +layout.*           Menubar with Log in / Log out, passes the interactive flag
e2e/                    Playwright browser tests
design/horizon/         Figma token exports (Morning, Evening, two high-contrast themes)
scripts/                Builds the generated data (crosswalk, companies, GDP) and the Horizon CSS
docs/                   Overview, pages, configuration, development, workflows, design decisions (adr/), quality review, crosswalk, size, financials and token notes, specs and plans
```

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) 3 with [Svelte](https://svelte.dev) 5 (runes)
- [Vite](https://vite.dev) 8 and TypeScript 6
- [Vitest](https://vitest.dev) for tests
- [`@sveltejs/adapter-vercel`](https://svelte.dev/docs/kit/adapter-vercel) for deployment
- [Playwright](https://playwright.dev) for the browser tests (`npm run test:e2e`, with axe accessibility checks), [ESLint](https://eslint.org) with typescript-eslint and [Prettier](https://prettier.io) for lint and format, [TypeDoc](https://typedoc.org) for the API reference (`npm run docs`)
- SAP Horizon design tokens, exported from Figma (see [pages.md](pages.md#look-and-navigation))
- SheetJS `xlsx` 0.20.3, installed from `https://cdn.sheetjs.com` (the npm registry copy is unmaintained). Dependabot cannot update it; check for new releases now and then.

## Conventions and checks

The code is TypeScript only (`.ts` files and `<script lang="ts">`), type-checked in strict mode. `npm run check`, `npm run lint`, `npm run format:check` and `npm run check:ts-only` run in CI. The same rules for contributors and agents are in `AGENTS.md` (`CLAUDE.md` is a symlink to it, for tools that look for that name).

Internal imports use the `#lib/...` subpath alias declared under `imports` in `package.json`, which replaces the old `$lib` alias.

CI also enforces a coverage floor on `src/lib` (`npm run test:coverage`), runs the browser tests (`npm run test:e2e`: every page must load without page errors, CSP blocks or serious axe violations) and runs `npm audit --omit=dev --audit-level=high` on runtime dependencies. A separate, non-required `lighthouse` job audits the public pages (home, classification, companies, countries, industries, about) on the production build with Lighthouse CI (`lighthouserc.json`): accessibility, best practices and SEO must score at least 0.9 for the job to pass, performance at least 0.8 as a warning. The `is-crawlable` audit is skipped (`skipAudits` in `lighthouserc.json`) because `robots.txt` deliberately disallows all crawlers, which would otherwise fail the SEO score.
