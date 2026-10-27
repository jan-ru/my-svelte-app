# Public static site, interactive after login

Date: 2026-10-27. Status: approved; implemented (see PR).
Builds on `2026-10-25-financials-page-design.md` (shared password, HMAC session cookie, fail-closed rules).

## Goal

The site gets many bot visits. Anonymous visitors (and bots) get a cheap, cached, static version of each page; after logging in with the existing shared password the site is fully interactive. Bots can no longer cause server work, NYU downloads or data scraping by varying query strings.

## Decisions

| Topic | Decision |
|---|---|
| Mechanism | Vercel Incremental Static Regeneration (ISR) through `@sveltejs/adapter-vercel` 7.0.1 (`isr` route config), on Home, Classification, Companies and About. |
| Cache lifetime | `expiration: 86400` (one day), as the pages are cached today. |
| Query strings | `allowQuery: []`: the cache ignores them, so all variants of a URL share one cached copy. |
| Who gets what | Anonymous: the default view, no controls. Logged in: the live, interactive page. |
| Password | The same shared password as `/financials` (`SITE_PASSWORD`). No new login system. |
| Companies, anonymous | The first 20 rows of the unfiltered list and the counts line; no filters, no paging. |
| Bypass | A second cookie `__prerender_bypass=<token>` makes Vercel skip the cache for that browser. Set at login, cleared at logout. |
| robots.txt | `Disallow: /` (polite crawlers only; the cache and login are the real protection). |
| `/financials` | Unchanged: still locked, `private, no-store`, login form for anonymous visitors. |
| Lighthouse CI | Keeps auditing the public static versions (`/`, `/classification`, `/companies`, `/about`); it needs no login. |

## How it works

### The interactive rule (the core safety property)

A request is **interactive** only when it carries a valid session cookie **and** (when ISR is enabled) the bypass cookie equal to the token. Everything else renders the anonymous view.

Why both: the ISR cache is filled by whichever request arrives first after expiry. If a logged-in browser without the bypass cookie filled it, the interactive page would be cached for everyone. Requiring the bypass cookie means a request that can fill the cache is anonymous by construction. Vercel's `passQuery` also hands the first requester's query string to the function, so the anonymous code path must not read `url.searchParams` at all.

If `ISR_BYPASS_TOKEN` is not set, ISR is off (`isr: false`), pages are dynamic and `interactive` equals `authed`. Access is still controlled by the session; the cache is only an optimisation. This is the fail-safe.

### Components

- `vite.config.ts`: adapter `isr` config from `process.env.ISR_BYPASS_TOKEN` (build time), applied through route `config` in the four routes' `+page.server.ts` (or `+layout.server.ts`) via one shared constant in `src/lib/server/isr.ts`. Token shorter than 32 characters or absent: ISR off.
- `src/lib/server/auth.ts`: `isInteractive(session, bypassCookie, token)` pure function, unit tested.
- `src/hooks.server.ts`: sets `locals.authed` (as now) and `locals.interactive`. Interactive responses get `Cache-Control: private, no-store`; anonymous responses keep the public cache header.
- Session cookie path changes from `/financials` to `/` (needed so every page can see it). Login and logout also delete the old `/financials`-path cookie.
- Login (`/financials?/login`) sets the bypass cookie next to the session cookie (`httpOnly`, `secure`, `sameSite: lax`, path `/`, same lifetime). Logout deletes both. A `from` query value (an allow-listed local path: `/`, `/classification`, `/companies`, `/about`, `/financials`) lets "Log in" links return to the page the visitor came from.
- `src/routes/+layout.server.ts` (new): passes `interactive` to every page. The nav shows "Log in" or "Log out".
- Page loaders: when not interactive they ignore all query parameters and return the default view. Interactive requests behave as today.
  - Home: default selection chart; the pickers and chart options are replaced by "Log in to change the selection".
  - Companies: first 20 rows of the unfiltered list, plus the counts line; filters, paging and the Financials buttons are hidden behind "Log in to filter and page through all companies".
  - Classification: the page without search or trace; a login prompt for the search.
  - About: unchanged content; the only difference is the nav state.
- `static/robots.txt`: `User-agent: *` / `Disallow: /`.
- `src/env.ts`: `ISR_BYPASS_TOKEN` declared as optional, like the other variables.

## Behaviour and edge cases

- Anonymous request with any query string: the default view (the string is never read). A bot that sends `?industry=Steel` as the first request after expiry cannot change what is cached.
- Logged in, bypass cookie missing or wrong (for example cleared): the cached anonymous view; logging in again restores it.
- Session expired (7 days): the next request is anonymous; the bypass cookie remains but without a session it grants nothing.
- Anyone who learns the token can only bypass the cache and still gets the anonymous view without a session.
- Client-side navigation (`__data.json` requests) follows the same cookies and cache rules as page requests.
- Login rate limit and fail-closed behaviour of `/financials` are unchanged.

## Testing

Vitest, no network:
- `isInteractive`: session and token present, either missing, wrong token, expired session, ISR off.
- Loaders: anonymous requests ignore query parameters (same output with and without them); Companies returns exactly 20 rows; interactive requests keep today's behaviour.
- Login action sets both cookies; logout deletes both and the old-path cookie; `from` accepts only the allow-listed paths.
- `isr.ts`: token absent or too short turns ISR off.
- Existing suites, `svelte-check`, build, `check:ts-only` and coverage stay green.

Cannot be tested locally (ISR exists only on Vercel). Checks on production after the deploy, with the owner's token set:
- A request with no cookie returns the anonymous view and `x-vercel-cache` shows `HIT` on the second call.
- A request with `?industry=Steel` and no cookie returns the default view.
- A request with a made-up `__prerender_bypass` cookie and no session returns the anonymous view.
- After a real login, the pages are interactive and `x-vercel-cache` is not `HIT`.

## Owner steps

Add one Vercel environment variable `ISR_BYPASS_TOKEN` (a random string of at least 32 characters, for example `openssl rand -hex 32`) for Production and Preview. Without it the site still works, but without the CDN cache.

## Risks

- If the safety property above is wrong in some Vercel edge case, an interactive page could be cached for everyone. The rule that interactive needs the bypass cookie, plus the post-deploy checks, are the guard; the first deploy should be watched.
- ISR pages cannot stream.
- Anonymous visitors lose the interactive features that exist today; this is the point of the change.
- The 20-company preview still exposes 20 rows publicly.

## Out of scope

Static versions of `/financials` (still a dynamic login page, cheap because it returns before any data call); Vercel Firewall Bot Protection (a dashboard setting the owner can turn on); separate passwords or accounts; letting Lighthouse CI audit the logged-in pages.
