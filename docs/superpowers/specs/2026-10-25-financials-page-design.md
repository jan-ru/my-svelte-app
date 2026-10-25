# Financial statements page (password protected)

Date: 2026-10-25. Status: design approved in conversation, pending written-spec review.

## Goal

A new page, `/financials`, shows the annual income statement, balance sheet and cash flow statement for the last 5 fiscal years of a company chosen by ticker. The data comes from Financial Modeling Prep (FMP) using the owner's key. The site is public, so the page and every FMP call sit behind a shared password. The target is a desktop browser.

## Decisions

| Topic | Decision |
|---|---|
| Users | The owner plus a few people who are given the shared password |
| Access gate | One shared password; a signed, HTTP-only cookie after login. No per-person accounts |
| Company choice | The visitor types an FMP ticker (for example `AAPL`, `ABN.AS`) |
| Scope | Annual statements, last 5 fiscal years, three statements |
| FMP plan | Starter or higher (non-US exchanges depend on the tier; unsupported tickers get a clear message) |
| Secrets | `FMP_API_KEY`, `SITE_PASSWORD` and `SESSION_SECRET` are Vercel environment variables, read server-side only |
| Rendering | Server-rendered HTML tables from a SvelteKit `load` function; the ticker is in the URL (`/financials?symbol=ABN.AS`); a plain GET form, so it works without JavaScript |

## Data source facts

- FMP stable API, base `https://financialmodelingprep.com/stable/`. Checked 2026-10-25 without a key: `income-statement`, `balance-sheet-statement` and `cash-flow-statement` exist and answer `Invalid API KEY` (not 404) when called with `symbol=AAPL&period=annual&limit=5`.
- One request per statement, so three per company. The key is sent as the `apikey` query parameter, which means the URL is a secret and must never be logged or shown.
- The response field names and the shape of an error or an empty result are to be confirmed against the live API with the real key before the plan is written. The parser is tested against fixtures copied from those real responses.

## Architecture

| File | Purpose |
|---|---|
| `src/lib/server/auth.ts` | Create and verify the signed session cookie value (HMAC-SHA-256, expiry inside the signed payload); constant-time password comparison |
| `src/lib/server/ratelimit.ts` | Per-IP failed-login counter with a window, in memory |
| `src/lib/server/fmp.ts` | `getStatements(symbol)`: three fetches in parallel, 10 s timeout, 5 MB cap, response parsing, error mapping; key never in messages |
| `src/lib/statements.ts` | Pure functions that turn parsed statements into table rows (line items by year), money formatting |
| `src/lib/symbol.ts` | Ticker pattern and normalisation, shared by server and client |
| `src/env.ts` | Declares the private environment variables with `defineEnvVars` from `@sveltejs/kit/env` |
| `src/hooks.server.ts` | Existing security headers; sets `locals.authed` from the session cookie; `no-store` for `/financials`. The page's `load` enforces the gate. |
| `src/routes/financials/+page.server.ts` | `load` (statements for `?symbol=`), `login` and `logout` form actions |
| `src/routes/financials/+page.svelte` | Login form, ticker form, three statement tables |
| `src/routes/+layout.svelte` | Add a `financials` link to the navigation |

The three variables are declared in `src/env.ts` and read with named imports from `$app/env/private`, so they are read at run time on Vercel and never reach the client bundle. The app must fail closed: if `SITE_PASSWORD` or `SESSION_SECRET` is unset, nobody can log in and the page says it is not configured.

## Access gate

1. A visitor without a valid cookie who requests anything under `/financials` gets the login form (HTTP 200, `no-store`; SvelteKit's `load` cannot return another status) and no data. No FMP call is made.
2. Logging in is a form action (POST; SvelteKit's origin check applies). The password is compared in constant time against `SITE_PASSWORD`.
3. On success the server sets one cookie holding `expiry.signature`, with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/financials` and a 7-day lifetime. The expiry is part of the signed value, so the server decides when it ends.
4. Changing `SESSION_SECRET` logs everyone out; changing `SITE_PASSWORD` stops new logins. Revoking one person means changing the shared password for everyone.
5. Failed logins are limited per client IP (for example 5 in 15 minutes, then a 429). The counter is in memory per serverless instance, so this is best effort; a long random password is the real protection.
6. A logout action clears the cookie.

## Page behaviour

- Ticker input accepts `^[A-Za-z0-9.^-]{1,15}$`, upper-cased. Anything else is rejected before any FMP request. The ticker is URL-encoded when placed in the FMP URL.
- `load` calls `getStatements`, cached per ticker for 24 hours with the existing cache helper (stale copy served if a refresh fails; failures remembered for a minute).
- Each statement is a table: rows are line items in FMP's order, columns are the fiscal years (newest first, up to 5). Values are shown in millions with the reporting currency in the heading; a missing value shows "n/a". Fiscal year and period-end date are in the column headings.
- Fewer than 5 years of data shows the years that exist. Zero years shows "No annual statements found for <ticker> on this plan."
- The page response carries `Cache-Control: private, no-store`. The other pages are cached publicly by the Vercel CDN; this page must never be.

## Error handling

| Case | Behaviour |
|---|---|
| No or wrong password | Login form with a short message; the login action answers a wrong password with HTTP 401 and a rate-limited attempt with 429 |
| `SITE_PASSWORD`, `SESSION_SECRET` or `FMP_API_KEY` not set | The page shows only the "not configured" message and no data; the login action logs the missing variable when someone tries to log in; names are never shown to visitors |
| Invalid ticker text | Message under the input; no FMP call |
| Unknown ticker or empty result | "No annual statements found for X" |
| FMP refuses the ticker (plan or exchange) | "Your FMP plan does not cover X" with FMP's reason, key removed |
| FMP rate limit, timeout or outage | Short message with a retry link; stale cached copy used if there is one |
| One of the three statements fails | The other two still show; the failed one shows "unavailable" |

All errors log the ticker and the failing statement to the server log. The `apikey` value and full FMP URLs are never logged.

## Testing

Vitest, no network.

- `auth.ts`: valid cookie, tampered signature, expired cookie, wrong secret, constant-time comparison helper, unset secrets.
- `ratelimit.ts`: count, window expiry, per-IP separation (with a fake clock).
- `symbol.ts`: accepted and rejected tickers.
- `fmp.ts`: parsing from recorded real responses, error and empty-result mapping, key never present in any error message (fetch mocked).
- `statements.ts`: row building across years, missing years, formatting.
- `loadFinancials`: without a session or key, or with a bad ticker, the FMP fetcher is never called.

## Delivery

Work on a new branch in separate commits: auth, FMP client, statement tables, page and navigation. `FMP_API_KEY`, `SITE_PASSWORD` and `SESSION_SECRET` must be added in Vercel for Production and Preview before the page can be tried; the plan lists this as a manual step. Local development uses a `.env` file that is gitignored and not committed. README and `docs/` get a short section on the page and its variables. Nothing is merged to `main` without explicit approval.

## Terms and limits

- FMP's terms usually forbid republishing its data publicly. The page is behind a password and shown only to the people given it; the owner should check the FMP terms for what may be shared.
- A single shared password cannot tell users apart, cannot revoke one person, and leaves no per-person audit trail.
- Statements are as FMP reports them; the page does no restating or currency conversion.

## Out of scope

Charts, ratios, quarterly statements, CSV export, per-person accounts, searching by company name, linking from `/companies`, and non-annual periods.

## Open items

- FMP field names, empty-result and error shapes: the parser is generic (it does not depend on fixed field names), and the real response shape is checked on the Vercel preview.
- Confirm which markets the owner's tier covers.
