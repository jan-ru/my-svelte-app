# Size pages

Two public pages show how big things are, always as a share of the global total:

- `/countries` shows countries as tiles and bars, by number of companies or by GDP.
- `/industries` shows industries, sectors and regions by number of companies, and crosses a country with an industry.

## Measures

| Dimension | Measures |
|---|---|
| Country | Companies or GDP |
| Sector, industry, region | Companies only |

Percent is always of the global total: 48,156 companies, or the World Bank world GDP (`WLD`). "Rest of world" is the total minus the selection. GDP is labelled "current US$, latest value per country" with the year range.

## Sources

- Companies: NYU Stern (Damodaran) `indname.xls`, through `src/lib/data/companies.json` (see `docs/crosswalk.md`).
- GDP: World Bank, indicator `NY.GDP.MKTP.CD` (GDP, current US$), licence CC BY 4.0. The pages carry an attribution line. The retrieval date is the `generated` field of `src/lib/data/gdp.json`.

## Rebuilding the GDP data

`npm run build:gdp` (Node 24, needs network) writes `src/lib/data/gdp.json`. Rebuild it yearly, together with the other data. Never edit the JSON by hand.

The script makes two API calls:

1. `/v2/country?format=json&per_page=400` lists countries and aggregates. Aggregates (World, income groups, regions) have region id `NA` only here, so this list is how they are left out.
2. `/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=20000&mrnev=1` returns the most recent non-empty value per country, and has no region field.

The world total (`WLD`) is the denominator. The countries with a value add up to about 99 % of it (99.1 % on 2026-10-28), so "rest of world" never reaches zero for GDP.

The year differs per country: the latest values range from 2011 to 2025 (as of 2026-10-28). The pages show the range.

NYU country names are matched to World Bank names exactly, then through `MANUAL_NAMES` in `src/lib/gdp-match.ts`. The script prints any manual target that no longer exists and exits with an error, and the matching refuses two NYU names for one World Bank country.

## Inflation and real growth

When countries are selected, `/countries` shows a table with their inflation and real GDP growth: the latest value and the average of the latest five years (no average with fewer than three values). Rates do not add up to a world total, so they are not a tile measure. The table is a sanity check for the long-term growth in a valuation: real growth plus inflation is roughly the nominal growth of the economy.

- Inflation: World Bank `FP.CPI.TOTL.ZG` (consumer prices, annual %).
- Real growth: World Bank `NY.GDP.MKTP.KD.ZG` (GDP growth, constant prices, annual %).

`npm run build:gdp` also writes `src/lib/data/macro.json`, with the same country list and NYU mapping as `gdp.json`. It asks for the last seven calendar years and keeps the latest five years per country, counting back from that country's newest value, so a gap in the data stays visible as fewer years. Values are rounded to two decimals. The logic is in `src/lib/macro.ts`.

## Colours

An industry takes the colour of the sector most of its companies belong to (alphabetical on a tie). Ten industries span several sectors; this is used for colour only. Fills are light so the dark label text keeps a 4.5:1 contrast.

## Countries without GDP

These NYU countries have no World Bank counterpart. They stay in the company counts and show GDP as "n/a":

- Taiwan: not a World Bank economy.
- Martinique: not a World Bank economy.
- Jersey and Guernsey: the World Bank reports them together as "Channel Islands" (`CHI`). Mapping both would count that GDP twice, so both are left unmapped on purpose.

Two further NYU countries map to a World Bank entry that has no GDP value, so they also show "n/a": Gibraltar and British Virgin Islands. North Korea also has no value at the World Bank, but NYU has no North Korea entry.
