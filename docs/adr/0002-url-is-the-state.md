---
status: Accepted
date: 2026-10-24
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-002: The URL is the page state

- **Accepted:** 2026-10-24, with the home page; applied since to every page.
- **Component:** `params.ts`, `size-nav.ts`, `financials-nav.ts`, `valuation-nav.ts`

## Context

A comparison, a filtered company list or a valuation is worth bookmarking and sharing.

## Decision

Every selection lives in the query string and is parsed by a pure module per page, against allow-lists. There is no client-side store of selections and no server-side session state beyond the login.

## Alternatives ruled out

- **Local storage or a server-side store.** Views could not be shared, and the pages would need JavaScript.

## Consequences

- The pages are server-rendered and work without JavaScript.
- A new query parameter on a public page must also be listed in `ISR_ALLOW_QUERY` ([ADR-003](0003-public-pages-isr-login-unlocks.md)).
- The valuation page carries a private company's figures in the URL too (`co`, [ADR-008](0008-valuation-peers-by-hand.md)), so they end up in browser history and request logs.
