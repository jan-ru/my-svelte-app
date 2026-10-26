# Conventions

- **TypeScript only.** Write all source in TypeScript: `.ts` files and Svelte `<script lang="ts">`. Do not add `.js`, `.mjs`, `.cjs` or `.jsx` files. Scripts in `scripts/` are `.ts` too and run with `node scripts/<name>.ts` (Node 24 strips the types). `npm run check:ts-only` enforces this and CI runs it.
- **Type-check before committing:** `npm run check` (svelte-check, strict). It must report 0 errors.
- **Imports:** use the `#lib/...` alias for `src/lib` (declared under `imports` in `package.json`). Do not use `$lib` or `config.alias`, which SvelteKit 3 deprecates.
- **Tests:** `npm test` (Vitest, no network). `npm run check:data` fetches the real NYU files; it also runs monthly in GitHub Actions (`check-data.yml`).
- **Branches:** `main` is protected by a ruleset that requires a pull request and a passing `test` check. Work on a branch and open a PR. Do not merge without the owner's approval.
- **Generated data:** `src/lib/data/*.json` come from `npm run build:crosswalk` and `npm run build:companies` (see `docs/crosswalk.md`). Do not edit them by hand.
- **`/financials` is password protected.** Never cache it publicly, never log or return the FMP URL or key, and keep `$app/env/private` reads in `hooks.server.ts` and `src/routes/financials/`. Environment variables are declared in `src/env.ts`; `$env/dynamic/private` is deprecated and sees nothing without that declaration. Page state (`tab`, `statement`, `period`) is parsed by `src/lib/financials-nav.ts`; only the selected statement is fetched. Profile and news go through the shared `fmpGet` in `src/lib/server/fmp.ts`; links from API data must pass `safeUrl`.
- **Secrets** are Vercel environment variables (`FMP_API_KEY`, `SITE_PASSWORD`, `SESSION_SECRET`); never commit them.
