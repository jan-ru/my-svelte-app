# Financials page: Stock Price tab

Date: 2026-10-26. Status: design and spec approved by the owner.
Builds on `2026-10-26-financials-tabs-design.md` (tabs, URL state), `2026-10-26-company-and-news-tabs-design.md` (shared `fmpGet`, `fmp-info.ts` pattern) and `2026-10-25-financials-page-design.md` (auth and key rules).

## Goal

Replace the "Coming soon" placeholder on the **Stock Price** tab of `/financials` with a summary of the latest price and a line chart of the last year of daily closes.

## Decisions

| Topic | Decision |
|---|---|
| Data | One FMP call: end-of-day history, `historical-price-eod/full?symbol=SYMBOL&from=<today-1y>&to=<today>`. No separate quote call. |
| Figures | End-of-day, not live. The tab says "Last close, <date>". |
| Summary | Last close with date; day change (amount and percent) against the previous close; 52-week high and low (highest and lowest close in the window); volume of the last day. All computed from the series. |
| Chart | Line chart of daily closes, hand-written SVG (no library), y axis with round ticks that does NOT include 0, x axis month labels, native `<title>` tooltip per point (date and close). |
| Range | 1 year only now. A range switch (`range=` in the URL) is a later add-on. |
| Accessibility / no-JS | Text summary for screen readers; collapsible "Show data" table with the closes. Server-rendered. |
| Cache | 1 hour per symbol (profile 24 h and news 15 min stay as they are). Failures never cached as results. |
| Auth / headers | Unchanged: enforcement inside `loadFinancials`, `private, no-store`. |
| Shared FMP code | Request goes through `fmpGet`; parser lives in `src/lib/server/fmp-info.ts`. |

## Components

- `src/lib/server/fmp-info.ts`: `interface PricePoint { date: string; close: number; volume: number | null }`; `parsePrices(body): PricePoint[]` (array required, else `unavailable`; records without an ISO `date` or a finite numeric `close` dropped; sorted oldest first; `volume` numeric or null); `fetchPrices(symbol, apiKey, from, to, fetchFn?)` using `fmpGet('historical-price-eod/full', {symbol, from, to}, ...)`.
- `src/lib/prices.ts` (new, pure): `summarise(points): PriceSummary | null` returning `{ date, close, change, changePct, high, low, volume }` (change against the previous point; `null` change fields when there is only one point; `null` result for no points); `oneYearWindow(today: Date): { from: string; to: string }`; `formatPrice`, `formatSigned`.
- `src/lib/chart.ts`: add `priceTicks(min, max, count = 5): { ticks: number[]; min: number; max: number }` (round ticks covering [min, max] with a padded non-zero baseline; flat series handled) and `monthTicks(points): { index: number; label: string }[]` (first point of each month, thinned to at most 12).
- `src/lib/components/LineChart.svelte` (new): props `points: PricePoint[]`; one SVG polyline, ticks, month labels, a small invisible-hit circle with `<title>` per point only when there are at most ~260 points, text summary via `aria-label`/`<desc>`.
- `src/lib/server/financials.ts`: `FinancialsView` gains `{ state: 'price'; symbol: string; points: PricePoint[]; message: string | null }`; `loadFinancials` for `tab === 'price'` fetches via a new `cachedPrices` (1 h) after the usual locked, unconfigured, idle and invalid checks; `price` no longer returns `soon`, so the `soon` state and its page branch are removed (no tab uses it).
- `src/routes/financials/+page.svelte`: summary row, `LineChart`, collapsible data table; README and CLAUDE.md lines updated.

## Behaviour

- No ticker / invalid ticker / missing key: same messages as the other tabs.
- Empty history: "No price history found for SYMBOL."
- Plan, rate-limit and unavailable errors use the existing `messageFor`.
- One data point: summary shows the close without a change; the chart shows a single marker.

## Testing

Vitest, no network:
- `parsePrices`: normal body; bad records dropped; sorting; non-array -> `unavailable`; FMP error body mapped.
- `fetchPrices`: path `historical-price-eod/full`, parameters `symbol`, `from`, `to`; key never leaks (same cases as the other fetchers).
- `summarise`: change and percent, 52-week range, single point, empty; `oneYearWindow` around a leap day and year boundaries.
- `priceTicks` (does not force 0, flat series, negative-free), `monthTicks` (month boundaries, thinning).
- `loadFinancials`: price tab fetches only prices; auth first; the guards; cache lifetime 1 h and key separation (fake timers, as in `financials-info-cache.test.ts`).
- Existing tests keep passing; `svelte-check`, build and `check:ts-only` stay green.

## Open items

- Confirm on the preview, with the real key, that `historical-price-eod/full` returns `date`, `close` and `volume` on the owner's plan. If the field names differ, the change is confined to `parsePrices`.
- Prices are end-of-day (last close). A live quote can be added later on top.

## Out of scope

Range switch, intraday charts, comparing tickers, candlesticks, volume bars, dividend/split adjustment choices, a live quote.

## Delivery

Branch `feat/price-tab`, separate commits, preview check by the owner, no merge to `main` without explicit approval.
