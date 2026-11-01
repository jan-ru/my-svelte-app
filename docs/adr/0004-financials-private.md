---
status: Accepted
date: 2026-10-25
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-004: Company financials sit behind the login and are never cached publicly

- **Accepted:** 2026-10-25, in #25 (spec `docs/superpowers/specs/2026-10-25-financials-page-design.md`).
- **Component:** `src/routes/financials/`, `src/lib/server/fmp.ts`, `src/env.ts`

## Context

The FMP key is paid for, and FMP's and Yahoo's terms restrict redistributing their data.

## Decision

`/financials` and everything under it (the valuation page included) needs the login and is sent `Cache-Control: private, no-store`. The FMP URL and key are never logged or returned, and `$app/env/private` is read only in `hooks.server.ts` and `src/routes/financials/`. Links from API data must pass `safeUrl`. Only the selected tab and statement are fetched.

## Consequences

- Environment variables are declared in `src/env.ts`.
- Each tab is one entry in `TABS` plus one loader in `TAB_LOADERS`.
