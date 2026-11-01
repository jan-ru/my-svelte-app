---
status: Accepted
date: 2026-10-27
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-005: A view never mixes data sources

- **Accepted:** 2026-10-27, with Yahoo Finance as a second source in #32 (spec `docs/superpowers/specs/2026-10-27-yahoo-source-design.md`); shared types and `SourceError` in #69.
- **Component:** `src/lib/source.ts`, `src/lib/source-data.ts`, `src/lib/server/yahoo.ts`, `yahoo-parse.ts`, `source-error.ts`

## Context

FMP covers US tickers on the current plan; Yahoo covers the rest but is unofficial and can break without notice. Figures from two sources do not reconcile line by line.

## Decision

`source.ts` decides the source per ticker: a dot suffix means Yahoo only, otherwise FMP by default with a switch to Yahoo. It also decides whether a period exists for that source (TTM is Yahoo only). Both sources produce the same shapes (`Statement`, `Profile`, `NewsItem`, `PricePoint`) and fail with a `SourceError`. A source module imports those shared types and never another source's module.

## Alternatives ruled out

- **Fill gaps from the other source.** A table would mix definitions without saying so.

## Consequences

- `source-boundary.test.ts` enforces the import rule.
- Yahoo error text is never shown to visitors.
