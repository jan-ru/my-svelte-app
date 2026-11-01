---
status: Accepted
date: 2026-10-28
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-009: Stay on one Node LTS line, pinned in four places that a test keeps together

- **Accepted:** 2026-10-28, in #59.
- **Component:** `package.json` `engines`, `.nvmrc`, the CI workflows, `@types/node`, `src/lib/node-pin.test.ts`

## Decision

The app runs on the Node LTS line pinned in `engines` (now 24). Moving to the next line is one deliberate PR that changes all four places; Dependabot majors of `@types/node` are refused.

## Consequences

- `node-pin.test.ts` fails when the four drift apart.
- SheetJS is installed from `cdn.sheetjs.com` (the npm copy is unmaintained), so Dependabot cannot update it; it is checked by hand.
