# /financials and the valuation page

First how to use the `/financials` page and the valuation page: what they show, where the data comes from and what its limits are. After that, the detail behind the `/financials` rules in `AGENTS.md`: how the pieces fit. The hard rules (privacy, secrets, no source mixing) stay in `AGENTS.md`.

## Using the financials page

Environment variables, the login and caching are in [configuration.md](configuration.md).

### Data sources

The password-protected `/financials` page shows the annual income statement, balance sheet and cash flow statement for the last 5 fiscal years of a company, looked up by ticker (for example `AAPL` or `ABN.AS`). The data comes from [Financial Modeling Prep](https://site.financialmodelingprep.com) (FMP), Yahoo Finance or [Eulerpool](https://eulerpool.com). Each view uses one data source: FMP for US tickers (the default) or Yahoo Finance (a switch on the page, and the default for tickers with an exchange suffix such as ABN.AS). Eulerpool is never chosen automatically: pick it with the switch (`source=eulerpool`) and it serves any ticker, US or not. It offers annual statements, the company profile, daily prices and the Supply chain tab; its News, Ratios, Estimates, Earnings and Peers tabs say so, and TTM is not offered (its trailing figures mix units). Its statements include analyst forecasts, which are left out, and some years have two rows a few days apart (such as 27 and 30 September), of which the fuller one is kept. Prices are approximated from daily quotes and can differ slightly from the official close, and there is no volume. Check its figures before relying on them: its totals are summed from components and can be incomplete or inconsistent, mostly in the newest year (Toyota's 2026 total assets, ASML's 2025 totals), and its EPS is net income over average shares, not the reported EPS. Yahoo data comes from the unofficial yahoo-finance2 package, may be delayed and can break without notice. TTM is not available with FMP on the current plan and is grayed out there; it works with Yahoo. The page is server-rendered and works without JavaScript.

### The tabs

The page has a vertical "Company" menu with the tabs Financials, Ratios, Estimates, Earnings, Peers (these four are FMP only; the tab says so for another source), Supply chain, News, Stock Price and Company Data, and a last entry, Valuation, that opens the valuation page for the same ticker. Under Financials there are tabs for the income statement, balance sheet and cash flow statement plus a Latest 5 years / TTM toggle. The choices live in the URL (`tab`, `statement`, `period`, next to `symbol`), so a view can be bookmarked or shared. Supply chain (marked "test" in the tab and on the page: an experiment that may change or go away; Eulerpool only; the tab says so for any other source) lists the companies Eulerpool links to the ticker as suppliers, customers or both, by name, with country, industry and two share-price correlations, and links each to its own financials. Treat it as a list of leads: it holds genuine suppliers and customers (for Apple, Hon Hai, Broadcom, Qualcomm, Best Buy, T-Mobile) next to unrelated companies, misses real ones (TSMC, Micron, Nvidia), gives no size for any relationship, and its correlations do not separate the real ones from the rest, so it is not ranked. It covers few companies outside the US (ASML.AS has none). Company Data shows the company profile from the active source (cached 24 h) and News the latest 20 articles for the ticker (cached 15 min); links to articles and websites open in a new tab and only http(s) URLs are linked. Stock Price shows the last close, day change, 52-week high and low and volume (end-of-day, not live) with a line chart of the last year of daily closes, from one call to the active source, cached for 1 h. TTM is only available with Yahoo (grayed out with FMP); the TTM balance sheet is the latest annual balance sheet. News on Yahoo is matched by company name and is looser than FMP's.

### Limits and terms

`/financials` is never cached publicly (`Cache-Control: private, no-store`). Limits: one shared password cannot tell users apart or revoke one person; which tickers work depends on your FMP plan (unsupported ones get a message); FMP's terms may restrict sharing its data; Yahoo's terms target personal use, and Eulerpool's free tier is for personal, non-commercial use and asks for a "Data by Eulerpool" credit wherever its data is shown publicly (the page carries one when Eulerpool is the source; its terms do not say whether the free tier may cache, and the app caches in memory per instance), so check all three before giving anyone the password and do not redistribute the data.

## Using the valuation page

The valuation page values one company with multiples, the way the football-field slides in a valuation report do. It sits under `/financials`, so it uses the same password and is never cached publicly, and it shows the same "Company" menu, so switching between a company's tabs and its valuation keeps the ticker.

- **Company:** a listed ticker (figures from FMP or Yahoo, the same source rules as `/financials`; forward multiples use FMP analyst estimates) or a private company uploaded from an Excel template. *Download the template* gives an .xlsx with Company, Currency, Net debt, a Year row, a Type row (Actual or Forecast) and one row per figure (Revenue, EBITDA, EBIT, Net income, Book equity, Invested capital). Labels may also be Dutch (Omzet, Eigen vermogen, Realisatie, Prognose). The file is read once and never stored; its figures travel in the page URL (`co`), so they end up in the browser history and the server's request logs.
- **Peers:** picked by hand, up to 8. FMP's peer list is only offered as suggestions. A peer's multiples are computed from its market cap, net debt and figures, so Yahoo peers (tickers with a dot) work too.
- **Eulerpool's view:** when `EULERPOOL_API_KEY` is set, a listed company also gets a panel with Eulerpool's fair value per share (income, revenue and dividend based, against the last price) and its AAQS quality score (1 to 10) with the figures behind it. It is Eulerpool's own model and its method is not published, so the panel is labelled as such, carries the "Data by Eulerpool" credit, and does not feed the calculation: the figures and peers still come from one source. Amounts are in the currency Eulerpool prices the listing in, which can differ from the company's reporting currency (HSBA.L is in USD). The score is built for operating companies and says little about banks. Both are cached for a day per ticker (three Eulerpool calls the first time). A failure or a missing part shows a message and never hides the valuation. A private company, or a deployment without the key, shows no panel.
- **Multiples:** up to 4 from the same list as the home page.
- **Sector:** a Damodaran region and industry, whose value is shown as a separate row and marker.

The page shows the company's figures, a table of each peer's multiples with the peers' 25th percentile, median, 75th percentile and the sector value, a football-field chart and a table of equity values. Each method's range is the company figure times the peers' P25 to P75 (the median is the midpoint), minus net debt for EV multiples. *Manual bands* replace the peer range with a low and high multiple you type in (for example 3x to 5x). The average line is the mean of the midpoints. Values are in the company's own currency, and zero or negative multiples are left out of the percentiles.

All choices live in the URL: `symbol` or `co`, `peer` (repeated), `m` (repeated), `region`, `industry`, `lo.<multiple>` and `hi.<multiple>`, and `source`. A DCF valuation is planned as a separate page.

## Access and environment

- `/financials` is password protected. Never cache it publicly, never log or return the FMP URL or key, and keep `$app/env/private` reads in `hooks.server.ts`, `src/routes/financials/` and `src/routes/login/`.
- The one exception is the four `process.env.ISR_BYPASS_TOKEN` reads in the public routes' `config` exports, which run at build time.
- Environment variables are declared in `src/env.ts`; `$env/dynamic/private` is deprecated and sees nothing without that declaration.
- Page state (`tab`, `statement`, `period`) is parsed by `src/lib/financials-nav.ts`; only the selected statement is fetched. The ticker form carries all of it, the chosen `source` included, so typing another ticker keeps the view's settings (a decision, #33); a source that does not serve the new ticker falls back through `resolveSource`.

## Sources

- The set of fetchers per source (`SourceFetchers`: FMP, Yahoo, Eulerpool), their caches, `fetchersOf` and `keyOf` are in `src/lib/server/financial-sources.ts`; the tab loaders are in `src/lib/server/financials.ts`.
- Profile, news and prices go through the shared `fmpGet` in `src/lib/server/fmp.ts`. Links from API data must pass `safeUrl`.
- A view never mixes data sources: `src/lib/source.ts` decides the source per ticker (a dot suffix means Yahoo only) and whether a period exists for it (`FMP_SUPPORTS_TTM`).
- Yahoo goes through `src/lib/server/yahoo.ts` (injectable client) and `yahoo-parse.ts`. Never log Yahoo error text to visitors. Only Yahoo's own not-found wording (a plain `Error`, see `NOT_FOUND`) becomes an empty result; any other failure, an `HTTPError` included, is a `SourceError`, because an empty result is cached for a day. If Yahoo changes that wording, a real not-found shows as "unavailable" until `NOT_FOUND` is updated.
- `readCapped` and the size and time limits are in `src/lib/server/http.ts`.
- The shapes both sources produce (`Statement`, `Profile`, `NewsItem`, `PricePoint`) live in `src/lib/source-data.ts`. Failures are a `SourceError` (`src/lib/server/source-error.ts`).
- A source module imports those and never another source's module (`source-boundary.test.ts` enforces it, for FMP, Yahoo and Eulerpool).

## Eulerpool

- It goes through `eulerpool.ts` (I/O, key in an `Authorization` header and never in a URL, fixed error messages) and `eulerpool-parse.ts` (pure). `EULERPOOL_API_KEY` is read in the same places as the FMP key.
- It is chosen only when asked for (`resolveSource`). It serves annual statements, profile, prices and the Supply chain tab.
- The Supply chain tab is labelled "test" on purpose, an experiment. `supplyChain` is a `SourceFetchers` member only Eulerpool has. The list is by name and unranked on purpose, since its correlations do not rank real suppliers first.
- It has no TTM, news, ratios, estimates, earnings or peers. A `SourceFetchers` member that is absent makes the view say so.
- Its statements are in millions, include forecast rows (`2031-09-30e`) and sometimes two rows for one year; `eulerpool-parse.ts` handles all three.

## Condensed balance sheet

The Balance Sheet tab shows about 20 lines by default and every line with `?detail=full` (`Detail` in `src/lib/financials-nav.ts`, the toggle is `detailSegments` in `src/lib/segments.ts`). Income statement and cash flow have no such toggle. The mapping is `src/lib/condensed.ts`, a pure function over a `Statement`, so it works the same for every source:

- Each condensed line lists the names the sources give it (`from`); the first name with a figure in any year is used for the whole row. A line no source name matches is left out, and a statement none of whose lines match is shown in full instead.
- The four **Other** lines (other current assets, other non-current assets, other current liabilities, other non-current liabilities) are not copied from the source but worked out for each year as what is left of the subtotal: for example other current assets = total current assets − cash − receivables − inventory. That makes the rows add up to their subtotals, whatever the source leaves out. When a subtotal is missing for a year, the source's own "other" figure is used instead, and the row may not add up.
- Equity is shown as one total. The sheet is not forced to balance: total liabilities and total equity can differ from total assets by minority interest, depending on the source.
- A new source name for a line goes into `from`; a new line goes into `CONDENSED_BALANCE` in the order it should appear, with a test in `condensed.test.ts`.

## Adding a tab

- One entry in `TABS` plus one loader in `TAB_LOADERS` (`src/lib/server/financials.ts`) and, if it needs new markup, a component in `src/lib/components/` that `+page.svelte` renders.
- Components get a render test: Vitest compiles `.svelte` files through the plugin in `vitest.config.ts` and `svelte/server`'s `render` turns a component into HTML (see `financials-views.test.ts`). There is no DOM library.

## Valuation page (`/financials/valuation`)

- It sits under `/financials`, so it shares the login, the private caching and the env rule above.
- Its state is the URL (`valuation/nav.ts`), the maths is pure (`valuation/valuation.ts`, `valuation/figures.ts`) and loading is in `src/lib/server/valuation.ts`, which reuses the `/financials` fetchers and the Damodaran `getComparison`.
- Peers are picked by hand; FMP's list is only a suggestion.
- A private company comes from an uploaded Excel template (`valuation/template.ts`, read in `server/valuation-template.ts`). The file is never stored and its figures travel in the URL as `co` (`valuation/company.ts`).
- Beside the valuation, a listed company gets Eulerpool's fair value and AAQS quality score (`insight.ts` types and formatting, `server/insight.ts` loader cached for a day, `InsightPanel.svelte`). They come from Eulerpool whichever source the figures use, are labelled as its own model and never enter the calculation, so the view does not mix sources in any figure. Each part may fail or be missing on its own and the panel then says why.
