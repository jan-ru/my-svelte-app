# Conventions

- **TypeScript only.** Write all source in TypeScript: `.ts` files and Svelte `<script lang="ts">`. Do not add `.js`, `.mjs`, `.cjs` or `.jsx` files. Scripts in `scripts/` are `.ts` too and run with `node scripts/<name>.ts` (Node 24 strips the types). `npm run check:ts-only` enforces this and CI runs it.
- **Type-check before committing:** `npm run check` (svelte-check, strict). It must report 0 errors.
- **Imports:** use the `#lib/...` alias for `src/lib` (declared under `imports` in `package.json`). Do not use `$lib` or `config.alias`, which SvelteKit 3 deprecates.
- **Tests:** `npm test` (Vitest, no network). `npm run check:data` fetches the real NYU files and is run by hand each January.
- **Branches:** `main` is protected by a ruleset that requires a pull request and a passing `test` check. Work on a branch and open a PR. Do not merge without the owner's approval.
- **Generated data:** `src/lib/data/*.json` come from `npm run build:crosswalk` and `npm run build:companies` (see `docs/crosswalk.md`). Do not edit them by hand.
