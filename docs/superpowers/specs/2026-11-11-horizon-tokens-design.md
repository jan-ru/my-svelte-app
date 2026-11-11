# Horizon tokens from Figma: design

Date: 2026-11-11. Status: draft, awaiting review.

## Goal

Extend the current design with the full SAP Horizon theme from the Figma file "SAP Fiori for Web UI Kit (Community)". Figma's "export variable modes" produces one JSON file per theme. We turn those files into CSS custom properties with a script, so the values are never typed by hand and a new Figma export is a re-run, not a copy-paste.

## What we have

- `src/lib/styles/tokens.css`: about 100 hand-exported Horizon values with our own names (`--blue-60`, `--grey-07`, `--text-primary`, `--space-4`, `--radius-sm` and so on), imported once in `src/routes/+layout.svelte`. `global.css` styles base elements on top of it.
- 76 distinct `var(--…)` names used across components and pages.
- Hard-coded hex colours in `src/lib/size.ts`, `src/lib/chart.ts` and `Treemap.svelte`. These will not follow a theme until they read tokens.
- No theme switching of any kind.

## What Figma gives us

`Horizon.zip` holds four W3C design-token files: `Morning Horizon`, `Evening Horizon`, `High Contrast White`, `High Contrast Black`. Each has 1141 tokens (897 colour, 232 number, 12 string; 54 are aliases to other tokens), grouped as Main, Text, Button, Input, List, Shell, Tile, Chart, Font, Container/Spacing, Shadow and more.

- Names are SAP's own (`sapButton_Emphasized_Background`). Each token carries its CSS name in `$extensions["com.figma.codeSyntax"].WEB` (`var(--sapButton_Emphasized_Background)`), which is the name we use. The Container/Spacing tokens, among others, have no `codeSyntax` entry and need a name rule.
- Colours are objects (`{colorSpace, components, alpha, hex}`), not strings; the script uses `hex` and `alpha`.
- Numbers have no unit; the script decides `px` or `rem` from the group.

## Decisions

1. **Generated, not hand-written.** `scripts/build-tokens.ts` (run with `node`, like `build-crosswalk.ts`) reads the JSON and writes CSS. The output starts with a "generated, do not edit" header, sits in `.prettierignore`, and a test checks that it matches the source.
2. **All four themes are generated; only Morning is switched on.** Evening and the two high-contrast themes are written as `[data-theme='…']` blocks, ready for later. Switching them on is a separate pull request (switcher, stored choice, per-theme contrast checks), not part of this one.
3. **Allow-list of groups.** The script reads all 1141 tokens but writes only the groups in an allow-list in the script. First list: Main, Text, Button, Input, List, Shell, Tile, Link, Semantic, Focus, Chart, Font, Shadow, Container. Anything not listed is skipped, and adding a group is a one-line change. This keeps the shipped CSS small.
4. **Old names stay as aliases, then retire.** `tokens.css` keeps `--blue-60`, `--text-primary` and the rest, but as `var(--sap…)` references to the generated tokens. The alias table lives in the script, so the alias block is generated too. Components move to the Horizon names over time; when none uses an old name, its alias is deleted.
5. **Non-colour layout tokens stay hand-written for now.** `--space-*`, `--radius-*`, `--shell-header-height`, `--duration-*`. Horizon's spacing and radius tokens are a different scale from ours; mapping them is a separate step, after the colours are in.

## Files

| File | Role |
|---|---|
| `design/horizon/*.tokens.json` | The four Figma exports, committed as the source of truth (JSON, not JS, so the TypeScript-only rule is unaffected) |
| `scripts/build-tokens.ts` | Reads the JSON, applies the allow-list and alias table, writes the CSS |
| `src/lib/tokens-build.ts` | Pure functions (parse a token, name it, format a value, group filter) so the script is thin and testable without mocks |
| `src/lib/styles/horizon.generated.css` | Morning in `:root`, the other themes in `[data-theme]` blocks |
| `src/lib/styles/tokens.css` | Keeps layout tokens; colour names become aliases |
| `package.json` | New script `build:tokens` |
| `docs/horizon-tokens.md` | How to re-export from Figma and regenerate |

## Data flow

Figma export, then `design/horizon/*.tokens.json`, then `npm run build:tokens`, then `horizon.generated.css`, imported in `+layout.svelte` ahead of `tokens.css`, then components through `var(--…)`.

## Risks and checks

- **Contrast.** `tokens.css` records that `--blue-60` fails WCAG AA as text on the page background, so `--color-primary` uses `--blue-70`. When aliases point at Horizon tokens, the e2e axe run must still pass; where a mapping would regress contrast, the alias keeps the darker token.
- **Visual drift.** Horizon's Morning values should match what we have; the alias step is where any difference shows up. We review a before/after screenshot of each page type before merging.
- **Size.** Measure the CSS added per theme; if Morning alone is too large, tighten the allow-list.
- **Unnamed tokens.** Tokens without a `codeSyntax` name get a deterministic name from their group path; the test asserts there are no duplicates.
- **Re-export drift.** If Figma renames or removes a token, the build fails when an alias points at a missing name, instead of shipping a broken variable.
- **Caching and privacy.** Static CSS only; no effect on ISR caching or the `/financials` rules.

## Testing

- Vitest on `tokens-build.ts`: colour with and without alpha, number units, alias resolution, name rules, allow-list filtering, duplicate names.
- A sync test: the generated CSS equals what the script produces from the committed JSON.
- A test that every alias target exists in the generated CSS.
- Existing e2e (page errors, CSP, axe) unchanged and must pass. `npm run check`, `npm run lint` and `npm test` stay green; coverage thresholds are met by the new pure module.

## Out of scope

Theme switcher and persistence, themed charts (see Phase 2), migrating components to Horizon names, and the spacing and radius scales. Each is a later pull request.

## Phase 2: themed charts (separate pull request, after the tokens land)

Today `Treemap.svelte`, `chart.ts` and `size.ts` pass colour values (`fill="#1D2D3E"`, `'#C58FD6'`) into SVG attributes and TypeScript tables. The browser can only switch a colour per theme if it resolves it at paint time through `var(--…)`, so these files will not follow a theme until they change. Three levels, in order of cost:

1. **Structural colours (do first).** Label ink (`#1D2D3E`), white tile borders and the default fill (`#B3D6FF`) in `Treemap.svelte` move into the component's `<style>` block as `fill: var(--sap…)` and `stroke: var(--sap…)`. CSS properties accept `var()` where some SVG presentation attributes do not. Low risk; the HTML parts of the component already use tokens.
2. **Data colours (decide before building).** The 11 sector colours in `size.ts` and the 4-colour `PALETTE` in `chart.ts` identify categories. Options:
   - _Token per slot:_ store a slot name (`--sapChart_OrderedColor_3`) instead of a hex. Horizon's `Chart/Ordered` group has 12 colours, enough for 11 sectors, and each theme defines its own values, including the high-contrast ones.
   - _Fixed colours:_ keep today's values in every theme. Simpler, but pastel fills can glare on Evening and the high-contrast themes will not get their required colours.
   - Open question: sector colours that change per theme can confuse people who learn "Energy is red". Decide whether sectors should be themed at all before choosing.
3. **Computed contrast.** `readableOn()` and the thinned light fills in `size.ts` do arithmetic on hex strings and cannot read a CSS variable. Options:
   - Give each chart slot a paired text token (`--sapChart_OrderedColor_3_Text`) and delete the calculation. Needs those pairs designed for all four themes.
   - Resolve colours in the browser with `getComputedStyle` and recompute. Rejected: it runs client-side only and conflicts with the ISR-cached server rendering of public pages.
   - Keep the calculation on fixed colours, leaving those charts theme-neutral.

Dependencies: Phase 2 needs the generated tokens (Chart group included in the allow-list) and, for any visible effect, the theme switcher from the out-of-scope list. Level 1 can ship before the switcher; levels 2 and 3 only matter once a second theme is on.

Acceptance for Phase 2: the existing `size` and `chart` tests still pass, the 4.5:1 label contrast stays tested for every theme that is switched on, and no hex colour remains in `Treemap.svelte`.

## Delivery

One branch, one PR, merged only with the owner's approval. Order: script and pure module with tests, then generated CSS, then aliases, then the doc.
