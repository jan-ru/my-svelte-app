# Macro / meso / micro size flow (countries, industries, companies versus global)

Date: 2026-10-28. Status: draft, pending owner review.
Source: the owner's handover `handover-macro-meso-micro-v2.md` (reduced scope), refined in conversation. Builds on `2026-10-27-static-public-site-design.md` (anonymous static, interactive after login) and on `companies.json`, which already has regions, sectors and sub groups (#38).

## Goal

Show the absolute number and the percentage of one, several or all countries and industries versus the global total, as a drill-down with a treemap as the main graphic. There is no company level: with equal tiles (every company counts 1) a treemap says nothing, so it waits until there is a value per company (market cap). The order of selection is free: country then industry, or industry then country; both give the same view and the same URL.

## Decisions

| Topic | Decision |
|---|---|
| Data | Only what we have: the NYU company list (`companies.json`, 48,156 companies) plus World Bank GDP. No FMP, no Yahoo, no market cap, no Damodaran aggregates. |
| Who sees what | Anonymous visitors see the default view of each page (cached, as the other public pages). The drill-down (selection, measure toggle, company level) needs the login. Same rule as the rest of the site: `locals.interactive`, `pageParams`, ISR. |
| Links | Rows and tiles link to other pages with query strings (`/companies?country=...&industry=...`) only when interactive; the list of companies behind a tile is the existing Companies page. Anonymous pages contain no link to a query variant. |
| Treemap | Hand-drawn SVG with a squarified layout in a pure, tested function. No `d3` dependency. |
| Measures | Country: companies or GDP (toggle). Sector, industry, region: companies only. The measure is labelled on every chart; industries never show dollars. |
| Pages | `/countries` (macro) and `/industries` (meso). No company (micro) level for now; a tile links to the Companies page for that selection. |
| Process | Spec, plan, then the PRs below, each reviewed; no merge without the owner's word. |

## Data

### Company counts

`companies.json`: 48,156 companies, 132 countries, 94 industries, 11 primary sectors, 5 regions (`groups`), 12 sub groups. Every company counts 1; counts are only ever shown as totals per group. Counts per country, industry, sector, region and the cross counts are computed on the server from the committed file (cheap; cache the aggregate in memory). The handover's two extra columns (Primary Sector, Sub Group) are already in the file (#38); nothing to add there.

### GDP (`scripts/build-gdp.ts` → `src/lib/data/gdp.json`)

World Bank indicator `NY.GDP.MKTP.CD` (GDP, current US$), most recent non-empty value per country. Checked against the live API on 2026-10-28:

- The indicator call (`https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=20000&mrnev=1`) returns 262 rows (countries and aggregates together) **without a region field**. The handover's way of dropping aggregates (`region.id == "NA"`) therefore needs a second call to `https://api.worldbank.org/v2/country?format=json&per_page=400`, which has `region.id` per entry (aggregates have `NA`). The script joins both on ISO3: 217 countries, 79 aggregates.
- The world total is the row `WLD` (US$ 118.35 trillion, 2025). The 214 countries with a value sum to 99.1 % of it, so shares use `WLD` as the denominator and "rest of world" is `WLD` minus the selection, not a sum over countries.
- The year differs per country (2011 to 2025). `gdp.json` stores the year per country; charts show the range ("GDP, current US$, latest year per country, 2011–2025") and the table shows each year.
- Three World Bank countries have no value (Gibraltar, North Korea, British Virgin Islands): stored as absent.
- 22 of the 132 NYU country names do not match a World Bank name exactly and need the manual table: South Korea, Hong Kong, Turkey, Vietnam, Taiwan, Jersey, Czech Republic, Ivory Coast, Egypt, Venezuela, Palestinian Authority, Trinidad & Tobago, Saint Lucia, Guernsey, Curaçao, Bahamas, Macau, Slovakia, Macedonia, Russia, Martinique, Turks & Caicos Islands. Some have no World Bank counterpart (Taiwan, Martinique, probably Jersey and Guernsey under the Channel Islands, Palestinian Authority as West Bank and Gaza): the script prints every NYU country without a match and every World Bank country not used; the unmatched NYU countries are listed in `docs/size.md` and show GDP "n/a" (they keep their company counts).
- Licence: CC BY 4.0, so the pages carry an attribution line ("World Bank, GDP (current US$)") and `docs/size.md` records source, retrieval date and licence. Rebuild once a year, like the crosswalk.

## Share maths (`src/lib/size.ts`, pure)

For a measure, a global total `G` and a selection `S` of items with values `v`:

- `absolute = v`, `percent = 100 * v / G` (of the global total).
- The "rest of world" item is `G - sum(v over S)`; it is omitted when the selection is everything. Shares of the selection plus the rest add up to 100 %.
- Companies: `G = 48,156`. GDP: `G` = World Bank `WLD` value.
- Cross selections (country and industry together): the value is the number of companies in both; `percent` stays of the global total; the table also shows the share within the selected country and within the selected industry.
- Functions: `shareOfGlobal(values, selected, total)`, `crossCount`, `bySector`, with unit tests for the maths and for the country-name mapping.

## URL state (`src/lib/size-nav.ts`)

Parsed and validated like `financials-nav.ts`: `?measure=companies|gdp`, `country`, `industry`, `sector` (repeat a parameter for several). Unknown values are rejected (dropped), `measure=gdp` is only valid on `/countries` with no industry selected. `navHref` writes one canonical order, so country-then-industry and industry-then-country give the same URL and view.

Gotcha from #45: Vercel drops every query parameter that is not in `ISR_ALLOW_QUERY` before the function runs, also for logged-in requests, so the controls would silently do nothing. Add `measure` (the others, `country`, `industry`, `sector`, are already listed) and add a test that every parameter name `size-nav` can write is in `ISR_ALLOW_QUERY`.

## Pages and components

- `src/lib/components/Treemap.svelte` (props `items`, `selected`, `format`; keyboard focus per tile, text fallback table, `role="img"` summary like `LineChart`), `ShareBars.svelte` (ranked bars with absolute and % labels and a rest-of-world bar), `SizeSelector.svelte` (none, one, several or all; plain GET form like the other filters). Styled with the app's tokens. Tile colour for industries is the primary sector from a categorical palette that passes contrast in light and dark (use the `dataviz` guidance); countries use one hue.
- `src/lib/size-treemap.ts`: squarified layout as a pure function (`items → rectangles`), tested for area, order, no overlap and degenerate inputs (one item, zero values).
- `/countries`: treemap of all countries by companies or GDP, ranked bars for the selected few; selecting a country shows its industries as a second treemap (companies only); bonus chart: each country's share of global GDP next to its share of listed companies, among countries that have both (the rest are listed in the table).
- `/industries`: treemap of the 94 industries coloured by primary sector; sector → industry drill; selecting an industry shows its countries as a second treemap; the same bars. Country and industry selected together show one cell with its count and shares and a link to `/companies?country=...&industry=...` (interactive only).
- Anonymous view: the default treemap and bars (all countries by companies; all industries by sector), no controls, a `LoginPrompt` in place of the selector, no row links. Loaders use `pageParams(locals.interactive, url)`; both routes export `config = isrConfig(...)`.
- Nav: Countries and Industries added to `+layout.svelte`; About gets a note on what each measure means and the GDP caveats.

## Testing

Vitest, no network: share maths (including rest of world and 100 % total), treemap layout, `size-nav` parse/round trip/canonical order/rejection, the country mapping (every mapped name exists in the World Bank fixture; the unmatched list equals the documented one), `ISR_ALLOW_QUERY` coverage, loader tests for anonymous (query ignored, default view) and interactive. Coverage floor stays. The GDP script is run by hand; a trimmed World Bank fixture drives its tests.

## PR plan, checked against the handover's six

| Handover | Here |
|---|---|
| 1. Data + logic | PR 1: `build-gdp.ts` (two calls), `gdp.json`, `docs/size.md`, `size.ts`, `size-treemap.ts`, tests. The extra columns are already done (#38). |
| 2. Components | PR 2: `Treemap`, `ShareBars`, `SizeSelector`, `size-nav.ts` (+ `measure` in `ISR_ALLOW_QUERY` and its test). |
| 3. `/countries` | PR 3, including ISR config, anonymous default view, login prompt, nav entry. |
| 4. `/industries` | PR 4, same pattern. |
| 5. Company level | Dropped (no value per company yet). |
| 6. Nav + polish | Nav folded into PRs 3 and 4; PR 5 holds the About text, README and CLAUDE.md. |

## Risks and open points

- GDP years differ per country; labelled, not hidden.
- Some countries lack GDP; they stay in the company view and show "n/a" for GDP.
- Companies per country is a count of NYU-listed companies, not economic size; the measure label says so.

## Out of scope

A company-level treemap (needs market cap or another value per company; the 1,500-tile limit would then need a grouping rule), Damodaran industry aggregates, industry × country in dollars, anonymous drill-down (client-side), a `d3` dependency.
