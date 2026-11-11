# Horizon grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the Horizon layout-grid tokens, add a small `.grid` CSS helper, and move the Home page (`src/routes/+page.svelte`) onto it as the proof.

**Architecture:** `tokens-build.ts` gets a constant `GRID` table (Figma does not export layout guides) and a pure `buildGridCss` that writes `generated/grid.css` (`--hz-grid-columns/-margin/-gutter`, defaults S, overridden at the M, L and XL breakpoints read from the Morning tokens). A hand-written `src/lib/styles/grid.css` holds `.grid`, `.grid-page` and the `.span-*` classes. Home wraps its pickers and chart panels in span classes.

**Tech Stack:** SvelteKit 3, TypeScript (strict), Vitest, Playwright, plain CSS.

**Spec:** `docs/superpowers/specs/2026-11-11-horizon-grid-design.md`

## Global Constraints

- TypeScript only; no `.js/.mjs/.cjs/.jsx` files (`npm run check:ts-only`). Scripts are `.ts`.
- Data shapes `readonly`, constant tables `as const`; pure functions take data and return data; no `!` (use `at()`/`get()` from `src/lib/at.ts`).
- Imports of `src/lib` use the `#lib/...` alias in `.ts`/`.svelte`; CSS imports in `+layout.svelte` stay relative (as the existing ones).
- Never edit `src/lib/styles/generated/*.css` by hand: run `npm run build:tokens`. `tokens-data.test.ts` checks they match.
- Tabs, single quotes, printWidth 120 (Prettier). `src/lib/styles/generated/`, `*.md` are not formatted.
- Grid values (verbatim from the spec; S is S (Application)): S 4 columns, margin 16px, gutter 8px; M (≥600px) 8, 32px, 16px; L (≥1024px) 12, 32px, 16px; XL (≥1440px) 16, 48px, 16px. Margin and gutter are written in rem (px / 16).
- `.grid-page` max-width is `80rem` (not the XL grid width).
- Public pages are ISR-cached; this change is CSS and markup only: no new query parameters, no loader changes.
- Work on branch `feat/horizon-grid` (already created; the spec is committed on it). `main` is protected: finish with a PR, do not merge.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: `GRID` and `buildGridCss`, written as `generated/grid.css`

**Files:**
- Modify: `src/lib/tokens-build.ts` (add `GridSize`, `GRID`, `buildGridCss`; `buildAll` adds `grid.css`)
- Modify: `src/lib/tokens-build.test.ts` (new `describe` blocks; import `GRID`, `buildGridCss`, `type GridSize`)
- Modify: `src/lib/tokens-data.test.ts` (file list now has `grid.css`; real-data checks)
- Create (generated): `src/lib/styles/generated/grid.css`
- Script `scripts/build-tokens.ts` needs no change (it writes every file `buildAll` returns).

**Interfaces:**
- Produces:
  - `export interface GridSize { readonly size: 'S' | 'M' | 'L' | 'XL'; readonly columns: number; readonly margin: number; readonly gutter: number }` (margin and gutter in px)
  - `export const GRID: readonly GridSize[]` (S first, then M, L, XL)
  - `export function buildGridCss(grid: readonly GridSize[], morning: readonly Declaration[]): string` (`Declaration` already exists: `readonly [name: string, value: string]`; `morning` is the Morning declarations, which hold `--sapBreakpoint_M_Min` as `'600px'` etc.)
  - `buildAll` returns an extra key `'grid.css'`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/tokens-build.test.ts` add `GRID,`, `buildGridCss,` and `type GridSize,` to the import list from `./tokens-build` (keep it alphabetical like the rest), then append:

```ts
describe('buildGridCss', () => {
	const breakpoints = [
		['--sapBreakpoint_S_Min', '0'],
		['--sapBreakpoint_M_Min', '600px'],
		['--sapBreakpoint_L_Min', '1024px'],
		['--sapBreakpoint_XL_Min', '1440px']
	] as const;
	const css = buildGridCss(GRID, breakpoints);

	it('writes the smallest size as the default on :root, in rem', () => {
		expect(css).toContain(
			':root {\n\t--hz-grid-columns: 4;\n\t--hz-grid-margin: 1rem;\n\t--hz-grid-gutter: 0.5rem;\n}'
		);
	});
	it('overrides the three properties at each larger breakpoint, smallest first', () => {
		const order = [...css.matchAll(/@media \(min-width: (\d+)px\)/g)].map((m) => m[1]);
		expect(order).toEqual(['600', '1024', '1440']);
		expect(css).toContain(
			'@media (min-width: 600px) {\n\t:root {\n\t\t--hz-grid-columns: 8;\n\t\t--hz-grid-margin: 2rem;\n\t\t--hz-grid-gutter: 1rem;\n\t}\n}'
		);
		expect(css).toContain('--hz-grid-columns: 12;');
		expect(css).toContain(
			'@media (min-width: 1440px) {\n\t:root {\n\t\t--hz-grid-columns: 16;\n\t\t--hz-grid-margin: 3rem;\n\t\t--hz-grid-gutter: 1rem;\n\t}\n}'
		);
	});
	it('throws when a breakpoint token is missing, not in px, or not increasing', () => {
		expect(() => buildGridCss(GRID, breakpoints.slice(0, 2))).toThrow('--sapBreakpoint_L_Min');
		expect(() => buildGridCss(GRID, [...breakpoints.slice(0, 2), ['--sapBreakpoint_L_Min', '60rem'], breakpoints[3]])).toThrow(
			'--sapBreakpoint_L_Min'
		);
		expect(() =>
			buildGridCss(GRID, [breakpoints[0], breakpoints[1], ['--sapBreakpoint_L_Min', '500px'], breakpoints[3]])
		).toThrow('increasing');
	});
	it('throws when there is no size', () => {
		expect(() => buildGridCss([], breakpoints)).toThrow('no sizes');
	});
});

describe('GRID', () => {
	it('holds the five Horizon layout-guide values read from Figma', () => {
		const rows: readonly GridSize[] = [
			{ size: 'S', columns: 4, margin: 16, gutter: 8 },
			{ size: 'M', columns: 8, margin: 32, gutter: 16 },
			{ size: 'L', columns: 12, margin: 32, gutter: 16 },
			{ size: 'XL', columns: 16, margin: 48, gutter: 16 }
		];
		expect(GRID).toEqual(rows);
	});
});
```

If TypeScript complains about `breakpoints[3]` possibly undefined (`noUncheckedIndexedAccess`), use `at(breakpoints, 3)` (already imported in this test file) for those three spots, or build the arrays with `breakpoints.map(...)`. Run `npm run format` on the test file afterwards.

In `src/lib/tokens-data.test.ts`:
- In the `'are exactly what the script writes'` test, add `'grid.css'` to the expected sorted list (between `'evening.css'` and `'high-contrast-black.css'`).
- Add a `describe('the grid stylesheet', ...)` block at the end:

```ts
describe('the grid stylesheet', () => {
	const grid = buildAll(sources)['grid.css'] ?? '';
	it('switches at the real Horizon breakpoints', () => {
		expect(grid).toContain('@media (min-width: 600px)');
		expect(grid).toContain('@media (min-width: 1024px)');
		expect(grid).toContain('@media (min-width: 1440px)');
	});
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/lib/tokens-build.test.ts src/lib/tokens-data.test.ts`
Expected: FAIL (`GRID`/`buildGridCss` are not exported; `grid.css` missing from `buildAll`).

- [ ] **Step 3: Implement in `src/lib/tokens-build.ts`**

Add after `ADOPTED` (before `buildAliasCss`):

```ts
export interface GridSize {
	readonly size: 'S' | 'M' | 'L' | 'XL';
	readonly columns: number;
	/** px */
	readonly margin: number;
	/** px */
	readonly gutter: number;
}

/**
 * The Horizon layout guides ("Grid: S (Application)", M, L, XL on the Grid page of SAP Fiori for Web UI Kit
 * (Community)). Figma does not export layout guides, so these were read by hand: re-read them when the kit changes.
 * "Grid: S (Home)" is not used (it differs only in an 8px margin). The sizes switch at the `--sapBreakpoint_*_Min`
 * tokens.
 */
export const GRID = [
	{ size: 'S', columns: 4, margin: 16, gutter: 8 },
	{ size: 'M', columns: 8, margin: 32, gutter: 16 },
	{ size: 'L', columns: 12, margin: 32, gutter: 16 },
	{ size: 'XL', columns: 16, margin: 48, gutter: 16 }
] as const satisfies readonly GridSize[];

const remOf = (px: number): string => (px === 0 ? '0' : `${px / 16}rem`);

const gridProperties = ({ columns, margin, gutter }: GridSize, indent: string): readonly string[] => [
	`${indent}--hz-grid-columns: ${columns};`,
	`${indent}--hz-grid-margin: ${remOf(margin)};`,
	`${indent}--hz-grid-gutter: ${remOf(gutter)};`
];

/**
 * The grid stylesheet: the first size is the default on `:root`, each later one overrides it from its breakpoint.
 * `morning` supplies the breakpoints (`--sapBreakpoint_M_Min: 600px`); a media query cannot read a custom property,
 * so they are written out as px. Throws on a missing or non-px breakpoint, or one that does not increase.
 */
export function buildGridCss(grid: readonly GridSize[], morning: readonly Declaration[]): string {
	const [base, ...larger] = grid;
	if (base === undefined) throw new Error('GRID has no sizes');
	const values = new Map(morning);
	let previous = 0;
	const blocks = larger.flatMap((size) => {
		const name = `--sapBreakpoint_${size.size}_Min`;
		const raw = values.get(name);
		if (raw === undefined || !/^\d+px$/.test(raw)) throw new Error(`${name} is ${raw ?? 'missing'}, not a px value`);
		const px = Number.parseInt(raw, 10);
		if (px <= previous) throw new Error(`${name} (${raw}) is not increasing`);
		previous = px;
		return [`@media (min-width: ${px}px) {`, '\t:root {', ...gridProperties(size, '\t\t'), '\t}', '}'];
	});
	return [
		'/* Generated by `npm run build:tokens` from GRID in src/lib/tokens-build.ts and the Morning breakpoints. Do not edit. */',
		':root {',
		...gridProperties(base, '\t'),
		'}',
		...blocks,
		''
	].join('\n');
}
```

In `buildAll`, change the last line to:

```ts
	return Object.fromEntries([
		...themes,
		['aliases.css', buildAliasCss(ALIASES, morning, ADOPTED)] as const,
		['grid.css', buildGridCss(GRID, morning)] as const
	]);
```

- [ ] **Step 4: Generate the stylesheet and run the tests**

Run: `npm run build:tokens` (it prints a line for `grid.css`), then `npx vitest run src/lib/tokens-build.test.ts src/lib/tokens-data.test.ts`
Expected: PASS. Open `src/lib/styles/generated/grid.css`: it must be 4 blocks (`:root` defaults 4 / 1rem / 0.5rem, then 600px, 1024px, 1440px).

- [ ] **Step 5: Lint, types, commit**

Run: `npm run format && npm run check && npm run lint`
Expected: 0 errors.

```bash
git add src/lib/tokens-build.ts src/lib/tokens-build.test.ts src/lib/tokens-data.test.ts src/lib/styles/generated/grid.css
git commit -m "feat: generate the Horizon grid tokens

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The `.grid` helper stylesheet

**Files:**
- Create: `src/lib/styles/grid.css`
- Create: `src/lib/grid-css.test.ts`
- Modify: `src/routes/+layout.svelte` (two imports)

**Interfaces:**
- Consumes: `--hz-grid-columns`, `--hz-grid-margin`, `--hz-grid-gutter` from Task 1; `--space-4`.
- Produces classes: `.grid`, `.grid-page`, `.span-1`..`.span-4`, `.span-m-1`..`.span-m-8` (from 600px), `.span-l-1`..`.span-l-12` (from 1024px), `.span-xl-1`..`.span-xl-16` (from 1440px).

- [ ] **Step 1: Write the failing test** `src/lib/grid-css.test.ts`

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRID } from './tokens-build';

const styles = path.join(import.meta.dirname, 'styles');
const helper = readFileSync(path.join(styles, 'grid.css'), 'utf8');
const morning = readFileSync(path.join(styles, 'generated/morning.css'), 'utf8');

/** The CSS inside `@media (min-width: <px>px) { ... }`, or `null`. The blocks here do not nest braces beyond one rule. */
function mediaBlock(css: string, px: number): string | null {
	const start = css.indexOf(`@media (min-width: ${px}px) {`);
	if (start === -1) return null;
	const end = css.indexOf('\n}\n', start);
	return css.slice(start, end);
}

const breakpoint = (name: string): number => {
	const match = new RegExp(`--sapBreakpoint_${name}_Min: (\\d+)px;`).exec(morning);
	if (!match?.[1]) throw new Error(`no ${name} breakpoint in morning.css`);
	return Number(match[1]);
};

describe('the grid helper stylesheet', () => {
	it('writes the same breakpoints as the Horizon tokens', () => {
		for (const size of ['M', 'L', 'XL'] as const) expect(mediaBlock(helper, breakpoint(size)), size).not.toBeNull();
	});
	it('has a span class for every column of every size', () => {
		const columns = (size: string): number => GRID.find((g) => g.size === size)?.columns ?? 0;
		for (let i = 1; i <= columns('S'); i++) expect(helper).toContain(`.span-${i} {\n\tgrid-column: span ${i};`);
		for (const [prefix, size] of [['m', 'M'], ['l', 'L'], ['xl', 'XL']] as const) {
			const block = mediaBlock(helper, breakpoint(size)) ?? '';
			for (let i = 1; i <= columns(size); i++)
				expect(block, `.span-${prefix}-${i}`).toContain(`.span-${prefix}-${i} {\n\t\tgrid-column: span ${i};`);
			expect(block).not.toContain(`.span-${prefix}-${columns(size) + 1} `);
		}
	});
	it('puts the full-width default before the span classes so that a span class wins', () => {
		expect(helper.indexOf('.grid > *')).toBeGreaterThan(-1);
		expect(helper.indexOf('.grid > *')).toBeLessThan(helper.indexOf('.span-1 '));
	});
	it('caps the page container at 80rem and reads the grid margin', () => {
		expect(helper).toContain('max-width: 80rem;');
		expect(helper).toContain('padding-inline: var(--hz-grid-margin);');
	});
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/lib/grid-css.test.ts`
Expected: FAIL (`ENOENT ... grid.css`).

- [ ] **Step 3: Create `src/lib/styles/grid.css`** with exactly this content (it is generated text, 4 base spans and 8, 12 and 16 spans inside the three media queries):

```css
/* Layout helper for the Horizon grid. The column count, margin and gutter are --hz-grid-* in generated/grid.css; the
   breakpoints below are the --sapBreakpoint_*_Min tokens written out, because a media query cannot read a custom
   property (grid-css.test.ts checks they agree). Hand-written: see docs/horizon-tokens.md. */

.grid {
	display: grid;
	grid-template-columns: repeat(var(--hz-grid-columns), minmax(0, 1fr));
	column-gap: var(--hz-grid-gutter);
	row-gap: var(--space-4);
}

/* Written before the span classes: both have the same specificity, so a span class that follows wins. */
.grid > * {
	grid-column: 1 / -1;
}

/* The page container: centred, side margin from the grid, capped at Home's width. */
.grid-page {
	max-width: 80rem;
	margin: 0 auto;
	padding-inline: var(--hz-grid-margin);
}

/* Every size: 4 columns */
.span-1 {
	grid-column: span 1;
}
.span-2 {
	grid-column: span 2;
}
.span-3 {
	grid-column: span 3;
}
.span-4 {
	grid-column: span 4;
}

/* M and up: 8 columns */
@media (min-width: 600px) {
	.span-m-1 {
		grid-column: span 1;
	}
	.span-m-2 {
		grid-column: span 2;
	}
	.span-m-3 {
		grid-column: span 3;
	}
	.span-m-4 {
		grid-column: span 4;
	}
	.span-m-5 {
		grid-column: span 5;
	}
	.span-m-6 {
		grid-column: span 6;
	}
	.span-m-7 {
		grid-column: span 7;
	}
	.span-m-8 {
		grid-column: span 8;
	}
}

/* L and up: 12 columns */
@media (min-width: 1024px) {
	.span-l-1 {
		grid-column: span 1;
	}
	.span-l-2 {
		grid-column: span 2;
	}
	.span-l-3 {
		grid-column: span 3;
	}
	.span-l-4 {
		grid-column: span 4;
	}
	.span-l-5 {
		grid-column: span 5;
	}
	.span-l-6 {
		grid-column: span 6;
	}
	.span-l-7 {
		grid-column: span 7;
	}
	.span-l-8 {
		grid-column: span 8;
	}
	.span-l-9 {
		grid-column: span 9;
	}
	.span-l-10 {
		grid-column: span 10;
	}
	.span-l-11 {
		grid-column: span 11;
	}
	.span-l-12 {
		grid-column: span 12;
	}
}

/* XL and up: 16 columns */
@media (min-width: 1440px) {
	.span-xl-1 {
		grid-column: span 1;
	}
	.span-xl-2 {
		grid-column: span 2;
	}
	.span-xl-3 {
		grid-column: span 3;
	}
	.span-xl-4 {
		grid-column: span 4;
	}
	.span-xl-5 {
		grid-column: span 5;
	}
	.span-xl-6 {
		grid-column: span 6;
	}
	.span-xl-7 {
		grid-column: span 7;
	}
	.span-xl-8 {
		grid-column: span 8;
	}
	.span-xl-9 {
		grid-column: span 9;
	}
	.span-xl-10 {
		grid-column: span 10;
	}
	.span-xl-11 {
		grid-column: span 11;
	}
	.span-xl-12 {
		grid-column: span 12;
	}
	.span-xl-13 {
		grid-column: span 13;
	}
	.span-xl-14 {
		grid-column: span 14;
	}
	.span-xl-15 {
		grid-column: span 15;
	}
	.span-xl-16 {
		grid-column: span 16;
	}
}
```

- [ ] **Step 4: Import both stylesheets in `src/routes/+layout.svelte`**

After the line `import '../lib/styles/generated/aliases.css';` add:

```ts
	import '../lib/styles/generated/grid.css';
	import '../lib/styles/grid.css';
```

(`global.css` stays last.)

- [ ] **Step 5: Run the tests and the build**

Run: `npx vitest run src/lib/grid-css.test.ts && npm run format && npm run check && npm run lint && npm run build`
Expected: all PASS / 0 errors; the build succeeds. (`grid.css` is not in `src/lib/**/*.ts` coverage; the test file is.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/styles/grid.css src/lib/grid-css.test.ts src/routes/+layout.svelte
git commit -m "feat: a .grid layout helper on the Horizon grid

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Move the Home page onto the grid

**Files:**
- Modify: `src/routes/+page.svelte` (markup and `<style>`)
- Modify: `e2e/smoke.spec.ts` (one new test)

Home cannot get a Vitest render test: it imports `$app/state`, which the Vitest config does not resolve. The classes are verified by the Playwright test below instead (the spec is amended in Task 4).

**Interfaces:**
- Consumes: `.grid`, `.grid-page`, `.span-*` from Task 2.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/smoke.spec.ts`:

```ts
test('the Home pickers follow the Horizon grid: 4, 8, 12 and 16 columns', async ({ page }) => {
	const errors = watchErrors(page);
	await logIn(page);
	const columnsAt = async (width: number): Promise<number> => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		const tracks = await page.locator('.controls').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
		return tracks.split(' ').length;
	};
	expect(await columnsAt(400)).toBe(4);
	expect(await columnsAt(800)).toBe(8);
	expect(await columnsAt(1200)).toBe(12);
	expect(await columnsAt(1600)).toBe(16);
	// the picker widths follow the spans: stacked on a phone, side by side on a wide screen
	await page.setViewportSize({ width: 400, height: 900 });
	await page.goto('/');
	const tops = await page.locator('.controls > div').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
	expect(new Set(tops).size).toBe(3);
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto('/');
	const wideTops = await page
		.locator('.controls > div')
		.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
	expect(new Set(wideTops).size).toBe(1);
	expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm run build && npx playwright test e2e/smoke.spec.ts -g "Horizon grid"`
Expected: FAIL (`.controls` has 3 tracks, and `.controls > div` finds nothing).

- [ ] **Step 3: Change the markup** in `src/routes/+page.svelte`

1. `<main>` becomes `<main class="grid-page">`.
2. The pickers block becomes:

```svelte
			<div class="controls grid">
				<div class="span-4 span-m-8 span-l-5 span-xl-6">
					<IndustryPicker industries={data.industries} selected={selection.industries} max={MAX_SELECTION} />
				</div>
				<div class="span-4 span-m-4 span-l-4 span-xl-5">
					<CheckGroup legend="Regions" name="r" options={REGIONS} selected={selection.regions} max={MAX_SELECTION} />
				</div>
				<div class="span-4 span-m-4 span-l-3 span-xl-5">
					<CheckGroup
						legend="Multiples"
						name="m"
						options={MULTIPLES}
						selected={selection.multiples}
						max={MAX_SELECTION}
					/>
				</div>
			</div>
```

3. The panels block becomes:

```svelte
		<div class="panels grid" class:single={data.model.panels.length === 1}>
			{#each data.model.panels as panel, index (panel.key)}
				<div class="panel span-4 span-m-8 span-l-6 span-xl-8">
					<ChartPanel {panel} colors={PALETTE} uid={index} />
				</div>
			{/each}
		</div>
```

- [ ] **Step 4: Change the `<style>`** in the same file

- Remove the `main { max-width: 80rem; margin: 0 auto; padding: 0 var(--space-4) var(--space-12); }` rule and replace it with `main { padding-bottom: var(--space-12); }` (the container, centring and side padding now come from `.grid-page`).
- In `.controls` remove `display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: var(--space-4);` and keep `align-items: start;`.
- Replace the `.panels` and `.panels.single` rules with:

```css
	.panels.single .panel {
		max-width: 40rem;
	}
```

(The `.grid` gutter replaces `gap: var(--space-6)`.)

- [ ] **Step 5: Run the e2e test, then every gate**

Run: `npm run build && npx playwright test e2e/smoke.spec.ts`
Expected: PASS, including the existing axe tests for `/`.
Then: `npm run format && npm run check && npm run lint && npm run check:ts-only && npm run test:coverage`
Expected: 0 errors, thresholds met.

Then look at the page once in a real browser at 400, 800, 1200 and 1600px (for example `npm run preview`, log in at `/login`) to see that nothing overlaps, and say what you saw in the report.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+page.svelte e2e/smoke.spec.ts
git commit -m "feat: Home on the Horizon grid

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Documentation and spec amendment

**Files:**
- Modify: `docs/horizon-tokens.md`
- Modify: `CLAUDE.md` (Design tokens bullet)
- Modify: `docs/superpowers/specs/2026-11-11-horizon-grid-design.md`
- Modify: `README.md` only if it lists the generated files (check with `grep -n "generated" README.md`).

- [ ] **Step 1: `docs/horizon-tokens.md`**: add a section `## Grid` after "What is written":

```
## Grid

Figma does not export layout guides, so the grid is not in the token files. `GRID` in `src/lib/tokens-build.ts` holds the values read by hand from the Grid page of the kit (S (Application): 4 columns, 16px margin, 8px gutter; M: 8, 32, 16; L: 12, 32, 16; XL: 16, 48, 16). "Grid: S (Home)" (8px margin) is not used. If the kit's layout guides change, re-read them in Figma (Layout guide styles, the properties icon of each) and update `GRID`.

`npm run build:tokens` writes `generated/grid.css`: `--hz-grid-columns`, `--hz-grid-margin` and `--hz-grid-gutter` (rem), the same in every theme, overridden from the breakpoints `--sapBreakpoint_M_Min`, `_L_Min`, `_XL_Min` (written out as px, since a media query cannot read a custom property). `src/lib/styles/grid.css` is hand-written: `.grid` (a CSS grid on those properties, children full width by default), `.grid-page` (centred, side margin from the grid, `max-width: 80rem`) and the span classes `.span-1`..`.span-4`, `.span-m-1`..`.span-m-8`, `.span-l-1`..`.span-l-12`, `.span-xl-1`..`.span-xl-16` (a class applies from its breakpoint upward). For example `class="span-4 span-m-8 span-l-6"` is the full width on a phone, 8 of 8 columns on M, and half on L. `grid-css.test.ts` checks the breakpoints and the span classes. Only Home uses it so far.
```

Also change "Only Morning and `aliases.css` are imported" to "Only Morning, `aliases.css` and `grid.css` are imported".

- [ ] **Step 2: `CLAUDE.md`**: in the **Design tokens** bullet, append one sentence: `The layout grid is not in the exports: \`GRID\` in \`src/lib/tokens-build.ts\` (read by hand from Figma) becomes \`generated/grid.css\`, and \`src/lib/styles/grid.css\` is the hand-written \`.grid\` helper (see \`docs/horizon-tokens.md\`); only Home uses it so far.` Also add `grid.css` to the "Only `morning.css` and `aliases.css` are imported" clause.

- [ ] **Step 3: Amend the spec**: in `docs/superpowers/specs/2026-11-11-horizon-grid-design.md`, under Testing replace the line "A component render test for Home checks the `grid-page`, `grid` and span classes on the pickers and panels." with "Home has no Vitest render test: it imports `$app/state`, which Vitest does not resolve. The Playwright check below covers the pickers' classes through their computed layout." and replace the Playwright bullet's first sentence so it reads: "A Playwright check at 400, 800, 1200 and 1600px wide (logged in, because the pickers show only then) reads `getComputedStyle(...).gridTemplateColumns` of `.controls` (4, 8, 12, 16 tracks) and whether the pickers stack or share a row. The chart panels render only when the NYU data loads, which the e2e run cannot rely on, so they are checked by looking at the page, not by the test."

- [ ] **Step 4: Verify and commit**

Run: `npm run format:check && npm test`
Expected: PASS.

```bash
git add docs CLAUDE.md README.md
git commit -m "docs: the Horizon grid

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
