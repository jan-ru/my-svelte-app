---
status: Accepted
date: 2026-10-31
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-008: Valuation by multiples: peers picked by hand, a P25–P75 range, private companies from an uploaded template

- **Accepted:** 2026-10-31, in #75 to #78.
- **Component:** `/financials/valuation`, `valuation.ts`, `valuation-figures.ts`, `valuation-nav.ts`, `valuation-template.ts`, `valuation-company.ts`, `src/lib/server/valuation.ts`, `football-field.ts`

## Context

A valuation report shows a football-field chart: per method, a range of equity values. The peers matter more than anything else, and many companies valued are private.

## Decision

- Peers are picked by hand, up to 8. FMP's peer list is only a suggestion.
- Each method's range is the company figure times the peers' 25th to 75th percentile (median as midpoint), minus net debt for EV multiples. A manual low and high multiple can replace it.
- The Damodaran sector value is shown beside the peers, not mixed into them.
- A private company comes from an uploaded Excel template, read once and never stored; its figures travel in the URL (`co`).
- Values are in the company's own currency. The maths is pure; loading reuses the `/financials` fetchers.

## Alternatives ruled out

- **Store uploaded companies.** It would add storage, retention and access questions to a password-shared tool.
- **Automatic peers.** FMP's list is often off-sector.

## Consequences

- A private company's figures end up in browser history and request logs.
- DCF is a separate page, not part of this one.
