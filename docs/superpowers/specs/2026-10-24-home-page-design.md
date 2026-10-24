# Home page: valuation multiples comparison

Date: 2026-10-24. Status: design approved in conversation, pending written-spec review.

## Goal

Replace the demo home page with a tool for comparing valuation multiples from the NYU Stern (Damodaran) industry datasets. A visitor picks 1-4 multiples, 1-4 regions and 1-4 industries and sees grouped bar charts. The target is a desktop browser. A phone layout is out of scope.

## Decisions

| Topic | Decision |
|---|---|
| Core flow | Compare industries across multiples and regions, up to 4 of each |
| Chart layout | One panel per multiple, x axis = industry, colour = region (default), with a pivot control to reassign the three roles |
| Data source | Fetch the NYU `.xls` workbooks on the server and cache them |
| State | All selections live in the URL, so a view can be shared and bookmarked |
| Rendering | Hand-written SVG in Svelte, no chart library |
| Data flow | A SvelteKit `+page.server.ts` `load` function, with the URL as the source of truth |

## Data source facts (verified 2026-10-24)

- Workbooks are legacy binary `.xls`, published at `https://pages.stern.nyu.edu/~adamodar/pc/datasets/<name>.xls`.
- There are 32 files: 4 families times 8 regions. All were reachable and parsed.
- The data is updated about once a year. The files checked carry the update date 2026-01-05 (Excel serial 46027 in cell B1 of the "Industry Averages" sheet).
- Each workbook has two sheets: "Variables & FAQ" and "Industry Averages". The second holds the data.
- The header row is the row whose first cell is `Industry Name`. Its position varies (row 8, 9 or 10, one-based), so it must be located, not hardcoded.
- Each file has 96 data rows: 94 industries plus two aggregate rows, `Total Market` and `Total Market (without financials)`. Industry names are identical across all 32 files, with one exception: in `peEurope`, `pbvEurope` and `psEurope` the first aggregate row is called `Grand Total`. The parser aliases `Grand Total` to `Total Market`.
- Missing values are the text `NA`. Some industries have few firms (for example Japan, Aerospace/Defense: 5).

### File names

| Region id | Label (as stated in the workbook) | Suffix |
|---|---|---|
| `us` | US companies | none; the family uses `vebitda`, `pedata`, `pbvdata`, `psdata` |
| `europe` | Europe | `Europe` |
| `global` | Global | `Global` |
| `japan` | Japan | `Japan` |
| `india` | India | `India` |
| `china` | China | `China` |
| `emerging` | Emerging Markets | `emerg` |
| `anz-canada` | Australia, NZ and Canada | `Rest` |

For every region except US the file name is `<prefix><suffix>` with prefixes `vebitda`, `pe`, `pbv`, `ps`, for example `peEurope.xls`, `vebitdaemerg.xls`.

### Multiples catalog

| Id | Label | Family | Column header in the sheet |
|---|---|---|---|
| `ev_ebitda` | EV/EBITDA | `vebitda` | `EV/EBITDA`, within the "Only positive EBITDA firms" group |
| `ev_ebit` | EV/EBIT | `vebitda` | `EV/EBIT`, within the "Only positive EBITDA firms" group |
| `pe_trailing` | P/E (trailing) | `pe` | `Trailing PE` |
| `pe_forward` | P/E (forward) | `pe` | `Forward PE` |
| `pe_current` | P/E (current) | `pe` | `Current PE` |
| `pbv` | P/B | `pbv` | `PBV` |
| `ev_ic` | EV/Invested Capital | `pbv` | `EV/ Invested Capital` |
| `ps` | P/S | `ps` | `Price/Sales` |
| `ev_sales` | EV/Sales | `ps` | `EV/Sales` |

`vebitda` files have a two-level header: a group row (`Only positive EBITDA firms`, `All firms`) above the column row. The first matching column at or after the first group marker is used. Header text is whitespace-normalised before comparing. The column labels above are taken from the 2026 files and are the main thing to re-check each January (see `check:data` below).

## Architecture

### Files

| File | Purpose |
|---|---|
| `src/lib/catalog.ts` | Static config: multiples, regions, limit of 4. Shared by server and client |
| `src/lib/params.ts` | Parse and validate URL params. Unknown ids dropped, duplicates removed, each list capped at 4, defaults applied |
| `src/lib/layout.ts` | Pure function. Reshapes the comparison result and the pivot choice into panels, categories, series and a value matrix |
| `src/lib/chart.ts` | `niceTicks` and scale helpers |
| `src/lib/server/nyu.ts` | `getWorkbook(family, region)`: download with a 10 s timeout, parse with SheetJS, locate the header row, map `NA` to `null`, convert the update date |
| `src/lib/server/cache.ts` | In-memory cache, 24 h expiry, shared in-flight downloads, stale copy served if a refresh fails |
| `src/lib/server/compare.ts` | `getComparison({multiples, regions, industries})`: work out the distinct workbooks (at most 16), fetch in parallel, return `multiple -> region -> industry -> {value, firms}` |
| `src/lib/components/GroupedBarChart.svelte` | One SVG panel |
| `src/routes/+page.server.ts` | Load function and cache headers |
| `src/routes/+page.svelte` | Selectors, pivot control, legend, panel grid, data tables |
| `src/lib/server/nyu.live.ts` | Live check behind `npm run check:data`: fetch the real files and confirm every catalog column still resolves |
| `src/lib/server/testing/make-workbook.ts` | Test helper that builds small `.xls` fixtures with SheetJS |

### Dependencies

- `xlsx` 0.20.3 from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. The npm registry copy (0.18.5) is unmaintained and has known advisories. Server only; it must not reach the client bundle. Dependabot cannot update a tarball URL dependency, so SheetJS upgrades are manual: check https://cdn.sheetjs.com for new releases occasionally.
- `vitest` as a dev dependency.

### Data flow

1. The URL carries `m` (multiples), `r` (regions), `i` (industries), and the layout roles `p` (panels), `x` (x axis), `c` (colour). Lists use repeated parameters (`m=ev_ebitda&m=pe_trailing`), not commas, because industry names are free text. A parameter that is present but empty (`m=`) means the visitor cleared that list; an absent parameter means "use the default". A parameter holding only unknown values is treated as absent.
2. `load` parses the URL with `params.ts`. If any dimension is empty it returns the catalog and no data. Otherwise it calls `getComparison`.
3. `load` returns the values, the industry list (from any one workbook), and the data update date. It sets `Cache-Control: public, s-maxage=86400, stale-while-revalidate` so Vercel's CDN caches each distinct view.
4. `layout.ts` reshapes the result for the chosen roles. `+page.svelte` renders one `GroupedBarChart` per panel.

## UI

### Selectors

- Multiples and regions: checkboxes.
- Industries: a search box over the 96 rows, selected items shown as chips.
- At 4 selected in a dimension the unchecked options are disabled with a "max 4" hint.
- The selectors are a `<form method="get">`, so they work without JavaScript. With JavaScript, changes submit automatically via `goto` with `replaceState`, `keepFocus` and `noScroll`.

### Pivot control

Three dropdowns, one each for panels, x axis and colour. The defaults are multiples, industries and regions. Choosing a dimension that another dropdown already uses swaps the two, so the assignment is always a valid permutation.

### Default view

A visit with no parameters opens a ready comparison: `ev_ebitda` and `pe_trailing`; `us` and `europe`; and the industries `Software (System & Application)`, `Retail (General)` and `Total Market`.

If a dimension is cleared, the charts are replaced by a message: "Pick at least one multiple, region and industry".

### Header

"Source: NYU Stern, data updated <date>", linking to the dataset page.

## Charts

- Hand-written SVG, scaling with its container. Panels sit in a CSS grid of one or two columns.
- Every panel has its own y scale starting at 0, with ticks from `niceTicks`. Negative values extend below the baseline. Multiples are never forced onto one scale.
- Colours: four colour-blind-safe colours, assigned by position in the selection so a colour stays with an item. One shared legend above the grid.
- An `NA` value draws no bar and shows a small "n/a" at the baseline.
- A bar based on fewer than 10 firms is drawn hatched, with a footnote.
- Each bar has a native SVG `<title>` tooltip with the exact value and firm count.
- Each chart has a text summary for screen readers. A collapsible "Show data" section holds real HTML tables of the numbers.

## Error handling

| Case | Behaviour |
|---|---|
| Invalid or unknown URL params | Ignored; defaults fill the gaps |
| Download times out (10 s) | Counts as a failed fetch for that workbook |
| One workbook fails | Only the affected cells show "data unavailable"; the page still renders |
| A catalog column is not found | That multiple shows "data unavailable" with the reason; wrong numbers are never shown |
| NYU unreachable and nothing cached | Inline message with a retry link, not a 500 |
| Refresh fails but a cached copy exists | The stale copy is served |

## Testing

Vitest. No test touches the network.

- `params.ts`: unknown ids, duplicates, the cap of 4, defaults.
- `nyu.ts`: fixtures generated inside the test with SheetJS (no binary files committed). Cover the header row at different positions, the two-level `vebitda` header, `NA` becoming `null`, the date conversion, and a missing column.
- `cache.ts`: expiry, shared in-flight downloads, stale-on-error, using fake timers.
- `layout.ts`: every pivot permutation and the swap rule.
- `chart.ts`: `niceTicks`, including negative values and all-zero data.

`npm run check:data` is not part of the test suite. It runs `src/lib/server/nyu.live.ts` through a separate Vitest config (`vitest.live.config.ts`), fetches the real files and confirms all 9 multiples resolve in all 8 regions with at least 20 industries holding a numeric value (the lowest observed in 2026 is 79). Run it each January after NYU updates the data.

## CI

Add `.github/workflows/ci.yml`, running on push and pull request: `npm ci`, `npm test`, `npm run build`, on Node 24 (matching `engines`).

## Delivery

Work on `feat/home-page` in separate commits: data layer, layout and chart, page, CI. Check the Vercel preview before any merge. Nothing is merged to `main` without explicit approval.

## Out of scope

Outlier clipping, CSV export, historical years, other NYU datasets, a company valuation calculator, dark mode, a phone layout, internationalisation.

## Open items

- None blocking. The first-January check (`check:data`) and the choice of default industries can be revisited after the first version ships.
