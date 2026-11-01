# Quality review

What keeps the code healthy, what CI enforces and what to watch. The block marked *Measured* is a dated snapshot, refreshed in each release PR ([RELEASING.md](../../RELEASING.md), step 2); the rest is hand-written.

> **Generated:** 2026-11-01 · **Cadence:** each release
> **Tool:** none, manually compiled from the repository and CI configuration
> **Scope:** `src/`, `scripts/`, CI; not the generated data in `src/lib/data/`
> **Repo state:** `main` at `3644951` (#82)

## Health at a glance

| Area | Headline | Status | Enforced by |
|---|---|:---:|---|
| Types | Strict svelte-check with `noUncheckedIndexedAccess`; no casts on outside data, no `!` in source | 🟢 | `npm run check` in CI |
| Lint | typescript-eslint `strictTypeChecked` and eslint-plugin-svelte, 0 errors | 🟢 | `npm run lint` in CI |
| Formatting | Prettier on code; Markdown, `package.json` and generated files are left alone | 🟢 | `npm run format:check` in CI |
| TypeScript only | No `.js`, `.mjs`, `.cjs` or `.jsx` files | 🟢 | `npm run check:ts-only` in CI |
| Tests | Coverage floor on `src/lib`: 95% statements, lines and functions, 85% branches | 🟢 | `npm run test:coverage` in CI |
| Dependencies | No high or critical advisories in runtime dependencies | 🟢 | `npm audit --omit=dev --audit-level=high` in CI |
| Public pages | Accessibility, best practices and SEO at least 0.9, performance 0.8 (warning) | 🟡 | Lighthouse CI, a non-required job |
| Live data | The NYU workbooks still resolve every multiple | 🟡 | `check-data.yml`, monthly, not on PRs |
| API docs | TypeDoc builds `src/lib` with warnings as errors | 🟢 | `docs.yml`, on PRs and `main` |

## Measured

> **Measured 2026-11-01:** 62 test files with about 560 tests; 8.5k lines of source and 6.5k lines of tests under `src/`; 9 Accepted ADRs; 3 open issues. Coverage and audit figures are not copied in yet: the next release PR runs them and fills this line.

## The TypeScript review (2026-11-01)

A six-point review of the TypeScript, done in #81 and #82 and recorded as [ADR-007](../adr/0007-strict-typescript.md):

1. **Type guards instead of casts.** FMP, Yahoo and URL data are narrowed with `isRecord` and `field` (`coerce.ts`); `as Record<string, unknown>` and `as unknown as` are gone.
2. **Typed JSON.** Each generated file has a `*.d.json.ts`, so importers need no cast; tests check the real files.
3. **Readonly data shapes.** Rows, views and API results use `readonly` properties and arrays; constant tables use `as const`.
4. **typescript-eslint strict and Prettier in CI.** Three rules are tuned in `eslint.config.ts`, each with its reason.
5. **`noUncheckedIndexedAccess`.** Indexed reads are possibly `undefined`; `at()` and `get()` (`src/lib/at.ts`) throw a `RangeError` where the data guarantees the element.
6. **`attempt()`.** One helper replaces the same try/catch in the profile, news, price and peers loaders.

The rules bind new and changed code; existing code is not rewritten only to match them.

## What to watch

- **SheetJS** comes from `cdn.sheetjs.com` and Dependabot cannot update it. Check for a new release now and then.
- **Yahoo Finance** goes through the unofficial yahoo-finance2 package and can break without notice. Issue #33 holds the follow-ups from its review.
- **TypeDoc** supports TypeScript up to 6.0.x, so TypeScript 7 waits for it.
- **The login rate limit** is per serverless instance, so best effort only ([ADR-003](../adr/0003-public-pages-isr-login-unlocks.md)).
- **Svelte components** are covered by render tests but not by TypeDoc, and there is no DOM test library.
