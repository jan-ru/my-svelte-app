---
status: Accepted
date: 2026-11-01
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-007: TypeScript only, as strict as the tools allow, enforced in CI

- **Accepted:** TypeScript only on 2026-10-25 (#20); the six-point review on 2026-11-01 (#81, #82).
- **Component:** `tsconfig.json`, `eslint.config.ts`, `.prettierrc`, `scripts/check-no-js.ts`, `.github/workflows/ci.yml`

## Context

Most of the code is written with an agent. Rules that only live in prose drift; rules that fail the build hold.

## Decision

- Source is TypeScript only (`npm run check:ts-only`).
- svelte-check runs strict with `noUncheckedIndexedAccess`; an element the data guarantees is read with `at()` or `get()` from `src/lib/at.ts`, which throw a `RangeError`, rather than `!`.
- Data from outside (APIs, JSON, URL) is narrowed with type guards (`isRecord`, `field` in `coerce.ts`), never cast.
- ESLint runs typescript-eslint `strictTypeChecked` and eslint-plugin-svelte; Prettier owns formatting.
- CI runs all four plus the tests; each must pass.

## Consequences

- A new rule binds new and changed code; existing code is not rewritten only to match it.
- TypeDoc supports TypeScript up to 6.0.x, which caps the TypeScript version until it catches up.
