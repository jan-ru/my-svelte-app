# /financials and the valuation page

The detail behind the `/financials` rules in `AGENTS.md`. The hard rules (privacy, secrets, no source mixing) stay in `AGENTS.md`; this page explains how the pieces fit.

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
