---
status: Accepted
date: 2026-10-24
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-001: Read the NYU workbooks live and cache them in memory, with no database

- **Accepted:** 2026-10-24, with the home page (spec `docs/superpowers/specs/2026-10-24-home-page-design.md`).
- **Component:** `src/lib/server/` (workbook download, parsing, cache, comparison), `src/lib/catalog.ts`

## Context

NYU Stern publishes its industry multiples as 32 legacy `.xls` workbooks, one per multiple family and region, updated about once a year. The app only reads them.

## Decision

The server downloads only the workbooks a view needs, parses them with SheetJS, and keeps each in memory for 24 hours. When NYU is unreachable it serves the last copy it had (stale fallback). There is no database and no copy of the data in the repository.

## Alternatives ruled out

- **Commit the parsed data as JSON.** It would need a rebuild after every NYU update and would go stale silently.
- **A database.** Too much to run for data that changes once a year.

## Consequences

- A download is limited to 5 MB per workbook with a 10 s timeout.
- `npm run check:data` fetches the real files; it runs monthly in GitHub Actions and fails when NYU renames a column, which is then fixed in `catalog.ts`.
- A January update reaches the public pages within about two days (24 h in memory plus 24 h ISR, [ADR-003](0003-public-pages-isr-login-unlocks.md)).

## Open challenge

Each serverless instance keeps its own cache, so a cold instance downloads again. That is fine at the current traffic.
