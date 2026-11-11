# Horizon grid: tokens, a `.grid` helper and the Home page as proof

Date: 2026-11-11. Follows `2026-11-11-horizon-tokens-design.md` (colours, shadows, spacing are already on Horizon).

## Goal

Adopt the SAP Horizon layout grid (column count, margin and gutter per screen size) as generated tokens, give pages a small CSS helper to use it, and move one page, Home (`src/routes/+page.svelte`), onto it to prove the helper. Other pages stay as they are.

## Source values

Figma does not export layout guides, so the numbers were read by hand from the "Grid" page of SAP Fiori for Web UI Kit (Community), layout-guide styles (all type Stretch, 2026-11-11):

| Style | Screen size | Columns | Margin | Gutter |
|---|---|---|---|---|
| Grid: S (Home) | below 600px | 4 | 8px | 8px |
| Grid: S (Application) | below 600px | 4 | 16px | 8px |
| Grid: M | 600px and up | 8 | 32px | 16px |
| Grid: L | 1024px and up | 12 | 32px | 16px |
| Grid: XL | 1440px and up | 16 | 48px | 16px |

Breakpoints are the generated tokens `--sapBreakpoint_M_Min` (600px), `_L_Min` (1024px) and `_XL_Min` (1440px).

We use **S (Application)**. S (Home) differs only in a 8px margin and is not used; S (Application)'s 16px matches the 1rem side padding the pages have today.

## Design

### 1. Tokens: `generated/grid.css`

- `src/lib/tokens-build.ts` gets a constant table `GRID` (`as const`, readonly) holding the rows above for S (Application), M, L and XL, in px.
- A pure function `buildGridCss(grid, breakpoints)` returns the stylesheet. `buildAll` adds it as `grid.css`; `scripts/build-tokens.ts` writes it with the other files. `breakpoints` is read from the Morning tokens (`sapBreakpoint_*_Min`), so the media queries cannot drift from the generated breakpoint tokens.
- `grid.css` defines `--hz-grid-columns`, `--hz-grid-margin` and `--hz-grid-gutter` on `:root`. The defaults are S (Application). Each of M, L and XL overrides them in `@media (min-width: <breakpoint>px)`, smallest first. A media query cannot use a custom property, so the breakpoint is written as a literal px value.
- Margin and gutter are written in `rem` (px / 16), the same rule as Container/Spacing; the breakpoints in the media queries stay px.
- The names `--hz-grid-*` are ours (not `--sap…`, since Figma has no such tokens), and are the same in every theme, so `grid.css` is not themed.

### 2. The helper: `src/lib/styles/grid.css`

Hand-written, imported globally in `src/routes/+layout.svelte` after `generated/grid.css`.

- `.grid`: `display: grid; grid-template-columns: repeat(var(--hz-grid-columns), minmax(0, 1fr)); column-gap: var(--hz-grid-gutter); row-gap: var(--space-4)`. A direct child spans every column by default (`.grid > * { grid-column: 1 / -1 }`, written before the span classes so that an equal-specificity span class wins), so a page that adds no span gets one stacked column.
- Span classes by breakpoint, written in a plain CSS file and checked by a test:
  - `.span-1` to `.span-4` for every size (S upward);
  - `.span-m-1` to `.span-m-8` from M;
  - `.span-l-1` to `.span-l-12` from L;
  - `.span-xl-1` to `.span-xl-16` from XL.

  Each sets `grid-column: span N`. Within one element, the larger breakpoint classes come later in the file and so win, which gives "4 columns on S, 8 on M" with `class="span-4 span-m-8"`.
- `.grid-page`: the page container. `max-width: 80rem; margin: 0 auto; padding-inline: var(--hz-grid-margin)`. The cap is **80rem**, today's Home width, not the XL grid width (decision, 2026-11-11). It is one value, so it can change later.

### 3. Home as the proof (`src/routes/+page.svelte`)

Markup stays; classes are added. The title, source line, "Chart options" pivot, legend, notices and footnotes stay full width outside the grid.

- `<main>` gets `class="grid-page"`. Its side padding is now `--hz-grid-margin`; the bottom padding (`--space-12`) stays; its `max-width` moves to `.grid-page`.
- `.controls` (the three pickers) becomes `.grid`, replacing `grid-template-columns: 1.4fr 1fr 1fr`:

  | Size | Industries | Regions | Multiples |
  |---|---|---|---|
  | S (4 columns) | 4 | 4 | 4 |
  | M (8) | 8 | 4 | 4 |
  | L (12) | 5 | 4 | 3 |
  | XL (16) | 6 | 5 | 5 |

  The span classes go on a wrapper `<div>` per picker, so the picker components do not need a new prop. The L and XL splits approximate today's `1.4fr 1fr 1fr` in whole columns.
- `.panels` (the chart panels) becomes `.grid`, replacing `grid-template-columns: 1fr 1fr`. Each panel is wrapped as `class="span-4 span-m-8 span-l-6 span-xl-8"`: stacked below L, side by side from L (6 of 12, 8 of 16). The chart `gap: var(--space-6)` becomes the grid gutter.
- A single panel (`.panels.single`) keeps its `40rem` limit as a `max-width` on the one panel.

Visible changes: below 1024px the two charts stack; on phones the pickers stack and at tablet width the industry picker has its own row; side margins grow with the screen (16, 32, 32, 48px) instead of a constant 16px; at 1440px and wider the layout is as today except the 48px margins.

## Not affected

- Caching: CSS only, no new query parameters, `ISR_ALLOW_QUERY` and the loaders are unchanged. Home stays ISR-cached for anonymous visitors (it shows the pickers only when logged in; the grid wraps nothing else).
- `/financials` (private), the Explore pages, About and `SideLayout` keep their own layouts.
- Typography, colours, shadows and spacing tokens are unchanged.

## Testing

- `tokens-build.test.ts`: `buildGridCss` on fixture breakpoints writes the right defaults and one media query per size, smallest first, with margin and gutter in rem.
- `tokens-data.test.ts`: the media-query px values equal the real `--sapBreakpoint_M_Min`, `_L_Min`, `_XL_Min`; `grid.css` is in the sync test with the other generated files; `GRID` holds the five Figma values above.
- A test reads `src/lib/styles/grid.css` and checks that every span class named in the design exists for its range.
- A component render test for Home checks the `grid-page`, `grid` and span classes on the pickers and panels.
- A Playwright check at 400, 800, 1200 and 1600px wide reads `getComputedStyle(...).gridTemplateColumns` of `.controls` (4, 8, 12, 16 tracks) and whether the two chart panels share a row, so a media query that stops applying fails the build. The existing e2e run still checks page errors, CSP and axe.
- The usual gates: `npm run check`, `lint`, `format:check`, `check:ts-only`, `test:coverage`.

## Documentation

- `docs/horizon-tokens.md`: a "Grid" section: where the values come from (read by hand, so re-read from Figma if the layout guides change and update `GRID`), the `--hz-grid-*` names, that S (Home) is not used, and how to use `.grid`, the span classes and `.grid-page`.
- `CLAUDE.md`: one line under the design-tokens bullet: grid values are `GRID` in `tokens-build.ts` (not from the exports), `generated/grid.css` is generated, `src/lib/styles/grid.css` is the hand-written helper.

## Out of scope

Moving other pages or `SideLayout` onto the grid, the S (Home) margin, themes, Phase 2 chart colours.
