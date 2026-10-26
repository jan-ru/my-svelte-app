# Financials page: Company Data and News tabs

Date: 2026-10-26. Status: design approved in conversation, pending written-spec review.
Builds on `2026-10-26-financials-tabs-design.md` (tabs, URL state) and `2026-10-25-financials-page-design.md` (auth, FMP client rules).

## Goal

Replace the "Coming soon" placeholders for **Company Data** and **News** on `/financials` with real content from FMP. Stock Price stays a placeholder.

## Decisions

| Topic | Decision |
|---|---|
| Company Data | One profile card from FMP `profile?symbol=`: name, exchange, sector, industry, country, CEO, employees, website, IPO date, currency, price, market cap, beta; then the business description as plain text. Empty fields are skipped. |
| News | Latest 20 articles for the ticker (FMP stock news endpoint, `limit=20`): headline, publisher, date, short snippet. One call. |
| News endpoint | Expected `news/stock?symbols=SYMBOL&limit=20`; confirmed only from third-party sources, so it is verified on the preview (open item). The path is one constant in `fmp.ts`. |
| Links | Article and website links open in a new tab with `rel="noopener noreferrer"`. Only `http:` and `https:` URLs become links; anything else is shown as plain text. |
| Images | None loaded (no remote images from API data). |
| Cache | Profile 24 h, news 15 min, per symbol. Failures never cached as a result (existing cache behaviour). |
| URL state | Existing `tab=company` and `tab=news`; no new parameters. |
| Auth / headers | Unchanged: enforcement inside `loadFinancials`, `private, no-store`. |
| Shared FMP code | One request helper in `fmp.ts` does timeout, size limit, key redaction and status mapping; statements, profile and news all use it. |

## Components

- `src/lib/server/fmp.ts`: extract `fmpGet(path, params, apiKey, fetchFn)` from `fetchStatement` (same behaviour: 10 s timeout, 5 MB cap, key redaction, `FmpError` kinds). `fetchStatement` calls it. New:
  - `parseProfile(body): Profile | null` and `fetchProfile(symbol, apiKey, fetchFn?)`. Takes the first array element; strings trimmed, numbers finite, others dropped; `website` kept only if it passes `safeUrl`.
  - `parseNews(body): NewsItem[]` and `fetchNews(symbol, apiKey, fetchFn?)`. Each item `{title, publisher, date, text, url}`; items without a title are dropped; `url` kept only if it passes `safeUrl`; `text` cut to 300 characters.
  - `safeUrl(value): string | null`: returns the URL string only if it parses and its protocol is `http:` or `https:`.
- `src/lib/company.ts` (new, pure): `profileFields(profile)` returns `{label, value}[]` in display order with formatting (market cap in millions or billions, price with currency, dates as given); skips missing values. `formatNewsDate`.
- `src/lib/server/financials.ts`: `FinancialsView` gains `{state:'profile', symbol, profile | null, message}` and `{state:'news', symbol, items, message}`. `loadFinancials` branches on `nav.tab`: `financials` as today; `company` -> profile; `news` -> news; `price` -> `soon`. The order of checks stays: locked, (price: soon), unconfigured, idle, invalid, fetch. Two new caches (24 h, 15 min). `messageFor` is reused.
- `src/routes/financials/+page.svelte`: card (definition list) and article list; links built only from values `safeUrl` accepted; description rendered as text (Svelte escapes).

## Behaviour

- No ticker: "Enter an FMP ticker to see …" as today; invalid ticker and missing key messages unchanged.
- Company Data, symbol unknown to FMP (empty array): "No company profile found for SYMBOL."
- News, empty list: "No recent news found for SYMBOL."
- Plan or rate-limit errors use the existing messages, per tab.

## Testing

Vitest, no network:
- `safeUrl`: https/http accepted; `javascript:`, `data:`, relative, garbage and empty rejected.
- `parseProfile`: normal record; missing fields skipped; non-string values dropped; empty array -> null; unsafe `website` dropped.
- `parseNews`: normal items; item without title dropped; unsafe url dropped; text truncated; non-array -> `unavailable`.
- `fetchProfile`/`fetchNews`: URL and parameters (`profile?symbol=`, news path with `limit=20`); key redacted from errors (same cases as statements).
- `profileFields`: order, formatting, skipping.
- `loadFinancials`: `company` and `news` fetch only their own data; `price` fetches nothing; auth still first; cache keys and lifetimes separate (profile vs news vs statements).
- Existing tests keep passing; `svelte-check`, build and `check:ts-only` stay green.

## Open items

- Confirm on the preview, with the real key, that the profile and the news endpoint return data on the owner's plan, and that the news path is right.
- If FMP wraps the news in a different shape than a flat array, `parseNews` throws `unavailable` and the tab shows "FMP is unavailable"; the fix is a one-line change to the parser.

## Out of scope

Stock Price tab, key metrics/ratios, press releases, news filtering or paging, images and logos, sentiment, saving articles.

## Delivery

Branch `feat/company-news-tabs`, separate commits, preview check by the owner, no merge to `main` without explicit approval.
