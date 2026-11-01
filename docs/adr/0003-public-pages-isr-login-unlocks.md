---
status: Accepted
date: 2026-10-27
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-003: Public pages are a cached static view; one shared password makes them interactive

- **Accepted:** 2026-10-27, in #43 (spec `docs/superpowers/specs/2026-10-27-static-public-site-design.md`); query parameters let through in #45.
- **Component:** `src/hooks.server.ts`, `src/lib/server/access.ts`, the public routes' `config` exports

## Context

Anonymous traffic should cost almost nothing and expose nothing that varies by visitor, while the owner and invited users want the full, interactive pages.

## Decision

Anonymous visitors get the default view of each public page, cached by Vercel ISR for a day. Their loaders read the query only through `pageParams(locals.interactive, url)`, so what is cached never depends on the first requester. Logging in with the shared password sets a signed cookie plus Vercel's bypass cookie (`ISR_BYPASS_TOKEN`), and the same pages become interactive.

## Alternatives ruled out

- **Per-user accounts.** More than a small private tool needs; the shared password cannot tell users apart, which is accepted.
- **No cache.** Every anonymous hit would run a function.

## Consequences

- Without a usable `ISR_BYPASS_TOKEN` the site still works, uncached (`private, no-store`).
- Vercel drops query parameters not listed in `ISR_ALLOW_QUERY`, even for logged-in users; `SIZE_PARAMS` has a test.
- Rotating `ISR_BYPASS_TOKEN` needs a redeploy and should go with a password change.

## Open challenge

The failed-login rate limit lives in each serverless instance, so it is best effort only.
