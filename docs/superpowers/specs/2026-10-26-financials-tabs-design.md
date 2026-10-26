# Financials page: tabs and TTM

Date: 2026-10-26. Status: design approved in conversation, pending written-spec review.
Builds on `2026-10-25-financials-page-design.md` (auth, FMP client, cache stay as specified there).

## Goal

Give `/financials` a left-hand vertical tab list (Financials, News, Stock Price, Company Data). Under Financials, horizontal tabs for Income Statement, Balance Sheet and Cash Flow, and a toggle between the latest 5 years and trailing twelve months (TTM).

## Decisions

| Topic | Decision |
|---|---|
| Scope now | Vertical tabs and the full Financials tab. News, Stock Price and Company Data show a "Coming soon" note. |
| Later content | Stock Price: latest quote plus 1-year daily-close line chart. Company Data: FMP company profile. News: undecided. Each gets its own spec and PR. |
| State | URL is the source of truth: `/financials?symbol=AAPL&tab=financials&statement=balance&period=ttm`. |
| Defaults | `tab=financials`, `statement=income`, `period=annual`. Unknown values fall back to the default. |
| Links | Tabs and toggle are plain links that keep `symbol`; work without JavaScript. Current item has `aria-current`. |
| Fetching | Only the selected statement is fetched (one FMP call per view, was three). |
| TTM source | FMP stable `income-statement-ttm`, `balance-sheet-statement-ttm`, `cash-flow-statement-ttm` (`symbol`, `limit=1`). Same parser and table as annual; one column labelled "TTM". |
| TTM balance sheet | A balance sheet is a point in time. Under TTM it shows the latest balance sheet, labelled "Latest balance sheet". |
| Cache | Annual key `kind:SYMBOL` (unchanged); TTM key `kind:SYMBOL:ttm`. 24 h. |
| Auth/headers | Unchanged. All of `/financials*` stays `private, no-store`; enforcement stays inside the loader. |

## Components

- `src/lib/financials-nav.ts` (new, pure): `parseNav(searchParams)` returns `{tab, statement, period}` with defaults; `navHref(nav, symbol)` builds links. Types `Tab`, `StatementId`, `Period`.
- `src/lib/server/fmp.ts`: `fetchStatement(kind, symbol, apiKey, period, fetchFn)`; `period 'ttm'` uses the `-ttm` endpoint with `limit=1` and omits `period=annual`. `parseStatement` is reused; the TTM row has no `fiscalYear`, so the column label falls back to "TTM".
- `src/lib/server/financials.ts`: `loadFinancials` takes `nav`; for `tab=financials` it fetches the one selected statement and returns `{state:'ready', symbol, nav, table|message}`; other tabs return `ready` without fetching.
- `src/lib/statements.ts`: `buildTable` accepts the period so the header shows "TTM" and the title notes "Latest balance sheet" where it applies.
- `src/routes/financials/+page.server.ts`: parses nav from `url.searchParams` and passes it on.
- `src/routes/financials/+page.svelte`: two-column layout (vertical tabs left, content right; stacks above content under 40rem), horizontal statement tabs, period toggle.

## Behaviour

- No symbol: tabs render; content says to enter a ticker (as today).
- News / Stock Price / Company Data: heading plus "Coming soon", no FMP call.
- Same error messages as today per failure kind.
- A TTM request the plan does not cover shows the existing "not available on your plan" message for that statement only.

## Testing

Vitest, no network:
- `parseNav`: defaults, unknown values, each valid value; `navHref` keeps symbol and round-trips.
- `fetchStatement`: annual URL unchanged; TTM URL uses the `-ttm` path and `limit=1`; key still redacted.
- `loadFinancials`: only the selected kind is fetched; other tabs fetch nothing; TTM cache key separate; error mapping unchanged.
- `buildTable`: TTM column label.
Existing tests move to the one-statement shape. `svelte-check`, build and `check-no-js` stay green.

## Open item

The TTM endpoints are listed in FMP's stable API (balance sheet and cash flow confirmed in FMP's docs; income statement from a third-party guide). Confirm all three against FMP with the real key on the preview before merge.

## Out of scope

Quarterly periods, other symbols' comparison, CSV export, building News / Stock Price / Company Data content.

## Delivery

Branch `feat/financials-tabs`, separate commits, preview check by the user, no merge to `main` without explicit approval.
