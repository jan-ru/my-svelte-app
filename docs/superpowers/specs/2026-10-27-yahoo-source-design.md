# Financials page: Yahoo Finance as a second data source

Date: 2026-10-27. Status: design approved in conversation, pending written-spec review.
Builds on `2026-10-26-financials-tabs-design.md` (tabs, URL state), `2026-10-26-company-and-news-tabs-design.md` and `2026-10-26-price-tab-design.md` (view states, caches, `fmpGet` pattern) and `2026-10-25-financials-page-design.md` (auth and key rules).

## Goal

Let the `/financials` page show data from Yahoo Finance (via the `yahoo-finance2` npm package, the TypeScript counterpart of Python's yfinance) for tickers outside the US, such as `ABN.AS`, which the owner's FMP plan does not cover. For US tickers both sources are available behind a visible switch.

## Decisions

| Topic | Decision |
|---|---|
| Library | `yahoo-finance2` 4.0.5 (MIT, Node >= 22), server only. Not the Python yfinance: this repo is TypeScript only. |
| Source choice | `source=fmp` or `source=yahoo` in the URL. A visible FMP / Yahoo switch is shown for US tickers only. Non-US tickers always use Yahoo and show a "Source: Yahoo Finance" label instead of a switch. The default for US tickers is FMP. |
| What is "US" | A ticker without a dot suffix (`AAPL`, `BRK-B`). Share classes already use a dash, so any dot means an exchange suffix (`ABN.AS`, `SAP.DE`). |
| Tabs | All four tabs get a Yahoo version: Stock Price, Company Data, News, Financials. |
| Financials design | "Native lines, key lines first": the table shows Yahoo's own line items, with a fixed list of key lines sorted to the top. No mapping between FMP and Yahoo line items. |
| Companies page | Non-US rows get the Financials button where the existing Capital IQ to Yahoo ticker mapping (`src/lib/yahoo.ts`) yields a symbol; the link carries `source=yahoo`. |
| One source per view | Every figure on a page comes from the one effective source. There is no fallback and no mixing: a view is never FMP data with a Yahoo gap-filler, or the other way round. Helper calls (the Yahoo profile used for the currency and for the news search) are Yahoo calls too. |
| TTM | The owner's FMP licence does not give access to trailing-twelve-month data. With source FMP the **TTM** option of the period toggle is shown grayed out and cannot be selected, so the page never has to show a licence error for it. With source Yahoo, TTM is available. |
| Future | Comparing two tickers, or the same ticker from two sources, is a later feature. This design keeps the source in the URL and in cache keys so it can grow; it builds nothing for comparison now. |
| Auth / headers | Unchanged: enforcement inside `loadFinancials`, `private, no-store`. |

## What was checked against live Yahoo (2026-10-27, ABN.AS and AAPL, from a developer machine)

- `chart(symbol, {period1, interval: '1d'})` returns daily quotes with `date`, `close`, `volume` and `meta.currency` (EUR for ABN.AS).
- `quoteSummary(symbol, {modules: ['assetProfile','price']})` returns sector, industry, country, website, employees, description, `longName`, `currency`, `marketCap`.
- `fundamentalsTimeSeries(symbol, {period1, type, module})` is the statement source; the old `incomeStatementHistory` family returns almost nothing. Modules `financials`, `balance-sheet`, `cash-flow` with `type: 'annual'` give 4 to 5 years with 35 to 64 camelCase fields (`totalRevenue`, `netIncome`, `totalAssets`, `operatingCashFlow`, `freeCashFlow`, ...). `type: 'trailing'` works for `financials` and `cash-flow` and returns a series of TTM points (12 for ABN.AS), whose last point is the newest; it is rejected by the library's own result validation (`periodType: 'TTM'`), so it needs `validateResult: false` and our own parsing. `balance-sheet` has no trailing type. Annual rows carry `Date` objects; trailing rows carry epoch seconds.
- Values are raw currency units, not millions. The statement call does not return a currency; it comes from the price call.
- `search(query, {newsCount})` returns news but is a text search: `ABN.AS` returned none, `ABN AMRO` returned five; `AAPL` returned a story mainly about another company. News matching is loose.
- Not testable from here: whether Yahoo throttles or blocks Vercel's server IPs.

## Components

- `src/lib/source.ts` (new, pure): `type Source = 'fmp' | 'yahoo'`; `FMP_SUPPORTS_TTM = false` (one switch to flip if the FMP plan ever includes TTM); `periodAvailable(source, period)` and `effectivePeriod(source, period)` (TTM becomes `annual` when the source cannot serve it); `isUsListing(symbol)`; `parseSource(raw)`; `resolveSource(requested: Source | null, symbol): Source` (non-US forces `yahoo`; US uses the request or `fmp`); `sourceLabel(source)`.
- `src/lib/financials-nav.ts`: `Nav` gains `source: Source | null` (the requested one; `null` when absent); `parseNav` and `navHref` carry it (written only when present); `loginAction`/`afterLogin` keep it through login. The page resolves the effective source from the nav and the ticker.
- `src/lib/server/yahoo.ts` (new): one shared `YahooFinance` client (notices suppressed, silent logger) behind a small interface so tests inject a fake. Functions return the existing shapes: `fetchYahooPrices(symbol, from, to): PricePoint[]`, `fetchYahooProfile(symbol): Profile | null` (also returns the company name and currency for the other calls), `fetchYahooNews(symbol): NewsItem[]` (search by the company name from the profile, falling back to the ticker), `fetchYahooStatement(kind, symbol, period): Statement`. Pure parsers (`parseYahooPrices`, `parseYahooProfile`, `parseYahooNews`, `parseYahooStatement`) hold all the shaping and are what the tests drive. Errors map to the existing `FmpError` kinds (config is unused; plan/limit/unavailable), so `messageFor` and the page need no new cases. The error type keeps its name; renaming it is out of scope.
- Statements: `parseYahooStatement` turns the time series into the existing `Statement { lines, years }`. `lines` lists the key lines for that statement first (those present), then every other numeric field in Yahoo's order, excluding metadata (`TYPE`, `periodType`, `date`). Key lines: income `totalRevenue, grossProfit, operatingIncome, ebitda, netIncome, dilutedEPS`; balance `totalAssets, totalLiabilitiesNetMinorityInterest, stockholdersEquity, cashAndCashEquivalents, totalDebt`; cash flow `operatingCashFlow, investingCashFlow, financingCashFlow, capitalExpenditure, freeCashFlow`. `years` are newest first, like FMP's. TTM keeps only the newest trailing point; the TTM balance sheet is the latest annual one (as with FMP). `formatValue` treats keys ending in `EPS` like `eps*` (two decimals, not millions).
- `src/lib/server/financials.ts`: `loadFinancials` takes `source` and chooses the fetchers; caches key on `source:` plus the old key (statements 24 h, profile 24 h, news 15 min, prices 1 h; unchanged lifetimes). Check order unchanged: locked, unconfigured (only when the effective source is `fmp` and there is no key), idle, invalid, then the tab. Views carry the effective `source` so the page can label it.
- The period toggle: the TTM option is rendered as a non-link element (`aria-disabled="true"`, grayed, `title="Trailing twelve months is not available from FMP. Choose Yahoo."`) whenever the effective source is FMP; it is a normal link with Yahoo. The existing FMP TTM code (`-ttm` endpoints, TTM cache keys) stays but is unreachable while `FMP_SUPPORTS_TTM` is false.
- `src/routes/financials/+page.svelte`: source switch (links, `aria-current`) for US tickers; label for non-US; "Yahoo data is unofficial and may be delayed" note; News tab note "matched by company name" on Yahoo.
- `src/routes/companies/+page.svelte` + `src/lib/companies.ts`: `yahooSymbol(company)` for non-US rows via `yahooQuote`'s mapping (refactored into a shared symbol function in `src/lib/yahoo.ts`); button link `/financials?symbol=SYMBOL&source=yahoo`.
- `package.json`: add `yahoo-finance2` as a dependency. README and CLAUDE.md updated (sources, the unofficial-data caveat).

## Behaviour

- **TTM and the source:** `period=ttm` with an FMP source (requested or default) is treated as `annual`: the loader calls FMP's annual endpoints only, and the toggle shows "Latest 5 years" selected with TTM grayed. Switching the source from Yahoo to FMP while TTM is selected therefore lands on the annual view. A link or bookmark with `source=fmp&period=ttm` shows the same annual view; nothing errors.
- **Switching source keeps the rest of the page state** (ticker, tab, statement), except as above.

- US ticker, no `source`: FMP, with the switch showing FMP selected. Choosing Yahoo keeps tab, statement and period.
- Non-US ticker: Yahoo regardless of `source`; no switch. A non-US ticker with `source=fmp` is ignored, not an error.
- No FMP key configured: only matters when the effective source is `fmp`. Yahoo needs no key, so non-US tickers work without one.
- Messages for empty results and failures reuse the existing wording ("No price history found for SYMBOL.", "FMP is unavailable..." becomes "<source> is unavailable right now. Try again shortly." with the effective source name).
- The Yahoo client never receives or logs anything secret; there is no key. Error messages shown to the user contain no URLs.

## Testing

Vitest, no network:
- `source.ts`: `isUsListing` (AAPL, BRK-B yes; ABN.AS, SAP.DE, 7203.T no), `parseSource`, `resolveSource` for all combinations.
- `financials-nav`: `source` parsed, round-trips through `navHref`, `loginAction` and `afterLogin`.
- Yahoo parsers, from small fixtures trimmed from the live probe: prices (Date and epoch dates, null closes dropped, sorted, deduplicated by date), profile (sector, country, employees, website through `safeUrl`, nothing usable gives null), news (title, publisher, `link` through `safeUrl`, empty result), statements (key lines first then the rest, metadata excluded, newest first, TTM from the last trailing point with epoch dates, balance-sheet TTM equals latest annual, banks vs industrials field sets, currency).
- `yahoo.ts` with a fake client: the right module and options are requested, `validateResult: false` only for trailing, errors map to `FmpError` kinds, nothing leaks.
- `effectivePeriod`/`periodAvailable`: TTM unavailable for FMP, available for Yahoo, annual always; flipping `FMP_SUPPORTS_TTM` is the only change needed to re-enable FMP TTM.
- `loadFinancials`: FMP with `period=ttm` makes only annual calls and never a TTM call; Yahoo with `ttm` uses the trailing series; no code path mixes the two sources in one view; the source is chosen per ticker and request, FMP fetchers are not called for Yahoo and vice versa, cache entries are separate per source, auth still comes first, the missing FMP key does not block Yahoo.
- `fmpSymbol`/`yahooSymbol`: US rows get an FMP button only; non-US mappable rows get a Yahoo button; unmappable rows get none.
- Page: the TTM option is not a link and carries `aria-disabled` with FMP, and is a link with Yahoo (checked on a production build, as the login redirect was).
- Existing tests keep passing; `svelte-check`, build, coverage floor and `check:ts-only` stay green.

## Open items and risks

- **Yahoo from Vercel:** the owner must check on the preview that `ABN.AS` loads from Vercel's servers. If Yahoo blocks those IPs the client needs another host; that would be a separate design.
- Yahoo is unofficial and its terms target personal use. The page is password protected and personal; no redistribution of the data.
- `yahoo-finance2` brings extra server-side dependencies (zod, tough-cookie, others). Check the server bundle and cold start on the preview.
- News on Yahoo is matched by name and is looser than FMP's.

## Out of scope

Comparison of tickers or sources, a mapping of Yahoo to FMP line items, quarterly statements, intraday charts, a live quote, markets Yahoo lacks, running Python.

## Delivery

Branch `feat/yahoo-source`, separate commits, preview check by the owner (including `ABN.AS`), no merge to `main` without explicit approval.
