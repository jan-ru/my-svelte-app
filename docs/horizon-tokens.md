# Horizon tokens

The design tokens come from the SAP Horizon theme in Figma ("SAP Fiori for Web UI Kit (Community)"). Figma exports each theme as a W3C design-tokens file; a script turns those into CSS custom properties.

## Regenerating after a Figma change

1. In Figma, open the Horizon variables, choose **Export modes**, and download `Horizon.zip` (four files: Morning Horizon, Evening Horizon, High Contrast White, High Contrast Black).
2. Unzip into a new empty folder and copy the four files over `design/horizon/` under the names `morning.tokens.json`, `evening.tokens.json`, `high-contrast-white.tokens.json`, `high-contrast-black.tokens.json`.
3. Run `npm run build:tokens`, then `npm test`. Commit the changed JSON and `src/lib/styles/generated/*.css` together. Never edit the CSS by hand; the sync test in `src/lib/tokens-data.test.ts` fails if it differs from what the script writes.

If the build says `--surface-card was #ffffff, but --sapGroup_ContentBackground is now …`, Figma changed a value that an existing name relies on. Decide whether the page should follow Figma (update `was` in `ALIASES`, in `src/lib/tokens-build.ts`) or keep its colour (remove the alias and put the old value back in `tokens.css`).

## What is written

- One stylesheet per theme in `src/lib/styles/generated/`. Morning uses `:root`; the others use `:root[data-theme='…']`. Only Morning and `aliases.css` are imported (in `src/routes/+layout.svelte`).
- Only the groups in `GROUPS` (`src/lib/tokens-build.ts`) are written; add a group there. String tokens (font-style labels) are skipped.
- Names: a key starting with `sap` becomes `--<key>`; any other token becomes `--hz-<path>`, for example `--hz-Container-Spacing-Tiny`. Figma's own `codeSyntax` names are not used because some are corrupt.
- Aliases in the export (`{Shadow.sapContent_ShadowColor}`) are written as the literal value.
- `aliases.css` points 13 existing names at Horizon tokens and the build checks each has exactly the value it had before: nine colours (`--color-primary`, `--surface-card`, ...) and four spacing steps (`--space-2`, `-4`, `-8` and `-12`, which are Horizon's 8, 16, 32 and 48px).
- `aliases.css` also holds four names that adopt Horizon on purpose and so change how the app looks: `--shadow-1` to `--shadow-4` are Horizon's `Shadow0` to `Shadow3`. Nothing checks an old value for these (`ADOPTED` in `src/lib/tokens-build.ts`).
- Shadows are not tokens in the export: each is a set of atoms (position, blur, spread and colour for two layers). `shadowDeclarations` puts them together as `--sapContent_Shadow0` to `--sapContent_Shadow3` in every theme.
- The token's type decides the format. A number token is written in `px` (zero as `0`), but numbers in Container/Spacing (the space, gap and padding tokens, not the breakpoints) are written in `rem`, 16px to the rem, like our own spacing, so they follow the browser's font size. A number whose key ends in `Opacity` is written as a number from 0 to 1. A colour token is always written as a colour, even when its key ends in `Opacity`: `--sapBlockLayer_Opacity` is `rgb(0 0 0 / 0.2)`, so `opacity: var(--sapBlockLayer_Opacity)` would be invalid; use it as a colour.

## Not yet on Horizon

These existing names have no exact Horizon Morning match, so they keep their own value (`src/lib/styles/tokens.css`). Moving them is a visible change and needs a decision: `--blue-05`, `--blue-10`, `--blue-40`, `--blue-90`, `--grey-01`, `--grey-05`, `--grey-08`, `--positive*`, `--negative*`, `--critical-bg`, `--critical-border`, `--information-bg`, `--information-border`. The palette names (`--white`, `--ink`, `--blue-60`…) are literal colours and also stay. One case to know about: `--ink` (`#1d2d3e`, the text colour) equals `sapNeutralTextColor`, not `sapTextColor`, which is `#131E29` in Morning. `--ink` is kept as a literal and `--text-primary` stays hand-written.

## Before switching on another theme

Do not import `evening.css` or a high-contrast file yet. Components still read palette names such as `--white` and `--ink`, which do not change with a theme, so dark surfaces would keep dark text. The theme-switcher change has to alias or replace those names first, and the chart colours in `size.ts`, `chart.ts` and `Treemap.svelte` need Phase 2 of `docs/superpowers/specs/2026-11-11-horizon-tokens-design.md`.
