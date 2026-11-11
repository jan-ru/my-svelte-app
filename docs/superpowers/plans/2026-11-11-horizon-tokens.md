# Horizon Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate CSS custom properties for the four SAP Horizon themes from the Figma "export variable modes" files, and point nine existing colour names at them without changing how any page looks.

**Architecture:** A pure module `src/lib/tokens-build.ts` (no imports, so `node` can run it) flattens a token tree, names, resolves aliases, formats values and builds CSS text. `scripts/build-tokens.ts` is the thin I/O edge: it reads `design/horizon/*.tokens.json` and writes `src/lib/styles/generated/*.css`. `+layout.svelte` imports only the Morning file and the alias file. A Vitest sync test fails when the committed CSS is not what the script would write.

**Tech Stack:** TypeScript (Node 24 type stripping), Vitest, SvelteKit 3, Prettier.

**Spec:** `docs/superpowers/specs/2026-11-11-horizon-tokens-design.md` (Task 1 corrects it first). Phase 2 (themed charts) is a separate plan.

## Global Constraints

- TypeScript only; no `.js`, `.mjs`, `.cjs`, `.jsx` files (`npm run check:ts-only`). Scripts run with `node scripts/<name>.ts`.
- `npm run check`, `npm run lint` and `npm run format:check` report 0 errors; `npm run test:coverage` stays above the thresholds in `vitest.config.ts`.
- Data shapes are `readonly`; prefer `map`/`filter`/`flatMap`; I/O only in the script. Never use `!`; use `at()` or `get()` from `src/lib/at.ts` in tests.
- `tokens-build.ts` must have **no imports** (`#lib/*` has no extension, so `node` cannot resolve it from a script, and a relative import would need a `.ts` suffix).
- Generated files are never edited by hand; `design/` and `src/lib/styles/generated/` go in `.prettierignore`.
- Work on a branch and open a PR; do not push or merge without the owner's approval.
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Facts about the Figma export (checked against the real files)

- Four files, 1141 tokens each: 897 colour, 232 number, 12 string. Colour value `{colorSpace, components, alpha, hex}`; `hex` is always `#RRGGBB`, `alpha` is separate.
- An alias is a string value like `{Shadow.sapContent_ShadowColor}`: a dotted path to another token. All resolve.
- `com.figma.codeSyntax.WEB` is unreliable (13 names contain stray spaces, U+2028 or `--/`), so names come from the token key: `sap…` keys become `--sap…`; the rest become `--hz-<path>`.
- The 12 string tokens are Figma font-style labels (`Regular`, `Semibold Duplex`), not CSS values. They are skipped.
- Numbers carry no unit. Everything is `px`, except keys ending in `Opacity` (100 means `1`).
- Most existing colours have no exact Horizon match (`--positive`, `--negative`, `--grey-01`, `--blue-05`…). Only nine names match exactly in Morning; those become aliases. The rest stay as they are.

## File Structure

| File | Responsibility |
|---|---|
| `design/horizon/{morning,evening,high-contrast-white,high-contrast-black}.tokens.json` | The Figma exports, source of truth |
| `src/lib/tokens-build.ts` | Pure: flatten, name, resolve, format, build CSS text |
| `src/lib/tokens-build.test.ts` | Unit tests on small fixtures |
| `src/lib/tokens-data.test.ts` | Tests on the real exports and the committed CSS (sync test) |
| `scripts/build-tokens.ts` | Reads the JSON, writes the CSS |
| `src/lib/styles/generated/{morning,evening,high-contrast-white,high-contrast-black,aliases}.css` | Generated |
| `src/lib/styles/tokens.css` | Loses the nine declarations that move to `aliases.css` |
| `src/routes/+layout.svelte` | Imports `generated/morning.css` and `generated/aliases.css` |
| `docs/horizon-tokens.md`, `README.md`, `CLAUDE.md` | How to regenerate; one convention line |

---

### Task 1: Branch, source files, ignore rules, spec corrections

**Files:**
- Create: `design/horizon/morning.tokens.json`, `evening.tokens.json`, `high-contrast-white.tokens.json`, `high-contrast-black.tokens.json`
- Modify: `.prettierignore`
- Modify: `docs/superpowers/specs/2026-11-11-horizon-tokens-design.md`

**Interfaces:**
- Produces: the four JSON files at those exact paths (Tasks 4 and 5 read them).

- [ ] **Step 1: Create the implementation branch from the spec branch**

```bash
cd /Users/jrm/Projects/my-svelte-app
git switch docs/horizon-tokens-spec
git switch -c feat/horizon-tokens
```

- [ ] **Step 2: Copy the exports in under slug names**

Unzip into a fresh empty directory (never into the project), then copy:

```bash
work=$(mktemp -d)
unzip -q ~/Downloads/Horizon.zip -d "$work"
mkdir -p design/horizon
cp "$work/Morning Horizon.tokens.json"      design/horizon/morning.tokens.json
cp "$work/Evening Horizon.tokens.json"      design/horizon/evening.tokens.json
cp "$work/High Contrast White.tokens.json"  design/horizon/high-contrast-white.tokens.json
cp "$work/High Contrast Black.tokens.json"  design/horizon/high-contrast-black.tokens.json
ls -la design/horizon
```

Expected: four files of roughly 590–620 KB each.

- [ ] **Step 3: Ignore them in Prettier**

In `.prettierignore`, in the first block (after `src/lib/data/`), add two lines:

```
design/
src/lib/styles/generated/
```

- [ ] **Step 4: Correct the spec**

In `docs/superpowers/specs/2026-11-11-horizon-tokens-design.md`:

1. Replace the bullet that starts `- Names are SAP's own` with:

```markdown
- Names are SAP's own (`sapButton_Emphasized_Background`). The `codeSyntax.WEB` field looks like the CSS name but 13 of the values are corrupt (stray spaces, U+2028, `--/`), so the script ignores it and names tokens from the key: keys starting with `sap` become `--<key>`, all others become `--hz-<path>` (for example `--hz-Container-Spacing-Tiny`).
- An alias is a string value holding a dotted path (`{Shadow.sapContent_ShadowColor}`). The script resolves every alias to its literal value, so a generated file never refers to a token it did not write.
- The 12 string tokens are Figma font-style labels, not CSS values, and are skipped.
```

2. In "Decisions", replace item 2 with: `**All four themes are generated; only Morning is imported.** Each theme is its own file under `src/lib/styles/generated/`. Morning uses `:root`; the others use `:root[data-theme='…']` and are not imported until the theme-switcher PR.`

3. In "Decisions", replace item 3's group list with: `Main, Interaction, Application, Text, Button, Input, List, Shell, Tile, Link, Semantic, Focus, Chart, Font, Shadow, Container` (about 517 non-string tokens per theme).

4. In "Decisions", replace item 4 with: `**Existing names become aliases only where the value is identical.** Nine semantic names (`--color-primary`, `--text-secondary`, `--surface-group`, `--surface-card`, `--surface-hover`, `--surface-shell`, `--border-subtle`, `--critical`, `--information`) exactly equal a Horizon Morning token and become `var(--sap…)` references in `generated/aliases.css`. The build fails if one of them stops matching. Names with no exact match (`--positive`, `--negative`, `--grey-01`, `--blue-05`…) stay hand-written, so pages look the same; `docs/horizon-tokens.md` lists them as the drift to decide on later.`

5. In the "Files" table, replace the `horizon.generated.css` row with `src/lib/styles/generated/*.css` (Generated: one file per theme plus `aliases.css`), and the `design/horizon/*.tokens.json` row's name pattern with `<slug>.tokens.json`.

6. In "Risks and checks", add: `**Evening is not safe to switch on yet.** Palette names such as `--white` and `--ink` are not aliased, so a dark theme would leave dark text on dark surfaces. The theme-switcher PR must alias or replace them first.`

- [ ] **Step 5: Commit**

```bash
git add design .prettierignore docs/superpowers/specs/2026-11-11-horizon-tokens-design.md docs/superpowers/plans/2026-11-11-horizon-tokens.md
git commit -m "chore: add Horizon token exports and correct the design" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Flatten, name and resolve tokens

**Files:**
- Create: `src/lib/tokens-build.ts`
- Create: `src/lib/tokens-build.test.ts`

**Interfaces:**
- Produces (all exported from `src/lib/tokens-build.ts`):
  - `type TokenType = 'color' | 'number' | 'string'`
  - `interface ColorValue { readonly hex: string; readonly alpha: number }`
  - `type TokenValue = ColorValue | number | string`
  - `interface Token { readonly path: readonly string[]; readonly key: string; readonly type: TokenType; readonly value: TokenValue }`
  - `interface TokenTree { readonly [key: string]: unknown }`
  - `flattenTokens(tree: TokenTree, path?: readonly string[]): readonly Token[]`
  - `cssName(token: Pick<Token, 'path' | 'key'>): string`
  - `pathIndex(tokens: readonly Token[]): ReadonlyMap<string, Token>` (keys are dotted paths)
  - `resolveValue(token: Token, index: ReadonlyMap<string, Token>): TokenValue`

- [ ] **Step 1: Write the failing tests** in `src/lib/tokens-build.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { at } from './at';
import { cssName, flattenTokens, pathIndex, resolveValue, type TokenTree } from './tokens-build';

const tree: TokenTree = {
	$extensions: { 'com.figma.modeName': 'Test' },
	Main: {
		sapBrandColor: { $type: 'color', $value: { hex: '#0070F2', alpha: 1 }, $extensions: { 'com.figma.variableId': 'x' } }
	},
	Shadow: { sapShadow: { $type: 'color', $value: '{Main.sapBrandColor}' } },
	Container: { Spacing: { Tiny: { $type: 'number', $value: 8 } } }
};

describe('flattenTokens', () => {
	it('lists every token in order and skips the $-prefixed metadata', () => {
		const tokens = flattenTokens(tree);
		expect(tokens.map((t) => t.path.join('.'))).toEqual(['Main.sapBrandColor', 'Shadow.sapShadow', 'Container.Spacing.Tiny']);
		expect(tokens.map((t) => t.key)).toEqual(['sapBrandColor', 'sapShadow', 'Tiny']);
		expect(at(tokens, 2)).toEqual({ path: ['Container', 'Spacing', 'Tiny'], key: 'Tiny', type: 'number', value: 8 });
	});
});

describe('cssName', () => {
	it('uses the key for SAP tokens and the path for the rest', () => {
		expect(cssName({ path: ['Main', 'sapBrandColor'], key: 'sapBrandColor' })).toBe('--sapBrandColor');
		expect(cssName({ path: ['Container', 'Spacing', 'Tiny'], key: 'Tiny' })).toBe('--hz-Container-Spacing-Tiny');
	});
	it('drops spaces and other characters a custom property name cannot hold', () => {
		expect(cssName({ path: ['Additional Variables', 'Shadow Atoms', 'Shadow0_X_1'], key: 'Shadow0_X_1' })).toBe(
			'--hz-AdditionalVariables-ShadowAtoms-Shadow0_X_1'
		);
		expect(cssName({ path: ['Shell', 'sapA b/c'], key: 'sapA b/c' })).toBe('--sapAbc');
	});
});

describe('resolveValue', () => {
	const tokens = flattenTokens(tree);
	const index = pathIndex(tokens);
	it('returns a literal value as it is', () => {
		expect(resolveValue(at(tokens, 2), index)).toBe(8);
	});
	it('follows an alias to the literal', () => {
		expect(resolveValue(at(tokens, 1), index)).toEqual({ hex: '#0070F2', alpha: 1 });
	});
	it('throws when an alias points at nothing', () => {
		const lost = flattenTokens({ G: { A: { $type: 'color', $value: '{G.Missing}' } } });
		expect(() => resolveValue(at(lost, 0), pathIndex(lost))).toThrow('points at no token');
	});
	it('throws on an alias loop instead of spinning', () => {
		const loop = flattenTokens({ G: { A: { $type: 'color', $value: '{G.B}' }, B: { $type: 'color', $value: '{G.A}' } } });
		expect(() => resolveValue(at(loop, 0), pathIndex(loop))).toThrow('alias chain longer than 10');
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/tokens-build.test.ts`
Expected: FAIL (cannot find `./tokens-build`).

- [ ] **Step 3: Write the minimal implementation** in `src/lib/tokens-build.ts`

```ts
// Turns the Figma "export variable modes" files (W3C design tokens, one per Horizon theme) into CSS custom
// properties. Pure: scripts/build-tokens.ts does the file I/O. No imports on purpose, so `node` can run it.

export type TokenType = 'color' | 'number' | 'string';

export interface ColorValue {
	readonly hex: string;
	readonly alpha: number;
}

export type TokenValue = ColorValue | number | string;

export interface Token {
	readonly path: readonly string[];
	readonly key: string;
	readonly type: TokenType;
	readonly value: TokenValue;
}

/** A parsed export file, or any group inside one. */
export interface TokenTree {
	readonly [key: string]: unknown;
}

function isRecord(node: unknown): node is TokenTree {
	return typeof node === 'object' && node !== null && !Array.isArray(node);
}

function isTokenType(type: unknown): type is TokenType {
	return type === 'color' || type === 'number' || type === 'string';
}

/** Every token under `tree`, in file order. A node with a `$type` and a `$value` is a token; keys starting with `$` are metadata. */
export function flattenTokens(tree: TokenTree, path: readonly string[] = []): readonly Token[] {
	return Object.entries(tree).flatMap(([key, node]): readonly Token[] => {
		if (key.startsWith('$') || !isRecord(node)) return [];
		const here = [...path, key];
		const type = node['$type'];
		const value = node['$value'];
		return isTokenType(type) && value !== undefined
			? [{ path: here, key, type, value: value as TokenValue }]
			: flattenTokens(node, here);
	});
}

const safe = (text: string): string => text.replace(/[^A-Za-z0-9_-]+/g, '');

/**
 * The custom property for a token. SAP's own keys (`sapBrandColor`) are kept; tokens without one (`Tiny` under
 * Container/Spacing) get a name from their path. Figma's `codeSyntax` is not used: some of its values are corrupt.
 */
export function cssName({ path, key }: Pick<Token, 'path' | 'key'>): string {
	return key.startsWith('sap') ? `--${safe(key)}` : `--hz-${path.map(safe).join('-')}`;
}

/** Tokens by dotted path, the form an alias uses (`Shadow.sapContent_ShadowColor`). */
export function pathIndex(tokens: readonly Token[]): ReadonlyMap<string, Token> {
	return new Map(tokens.map((token) => [token.path.join('.'), token]));
}

const ALIAS = /^\{(.+)\}$/;

/** The literal behind a token: an alias such as `{Main.sapBrandColor}` is followed until a real value. */
export function resolveValue(token: Token, index: ReadonlyMap<string, Token>): TokenValue {
	let value = token.value;
	for (let hops = 0; hops < 10; hops++) {
		const target = typeof value === 'string' ? ALIAS.exec(value)?.[1] : undefined;
		if (target === undefined) return value;
		const next = index.get(target);
		if (next === undefined) throw new Error(`${token.path.join('.')}: alias {${target}} points at no token`);
		value = next.value;
	}
	throw new Error(`${token.path.join('.')}: alias chain longer than 10`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/tokens-build.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write src/lib/tokens-build.ts src/lib/tokens-build.test.ts
git add src/lib/tokens-build.ts src/lib/tokens-build.test.ts
git commit -m "feat: flatten, name and resolve Horizon tokens" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Format values and build a theme's CSS

**Files:**
- Modify: `src/lib/tokens-build.ts` (append)
- Modify: `src/lib/tokens-build.test.ts` (extend imports, append tests)

**Interfaces:**
- Consumes: `Token`, `TokenTree`, `ColorValue`, `flattenTokens`, `cssName`, `pathIndex`, `resolveValue` from Task 2.
- Produces:
  - `formatColor(value: ColorValue): string`: `#rrggbb` lowercase when opaque, else `rgb(r g b / a)`; throws on a non-`#rrggbb` hex.
  - `formatNumber(key: string, value: number): string`
  - `formatValue(token: Token, index: ReadonlyMap<string, Token>): string | null` (`null` for string tokens)
  - `type Declaration = readonly [name: string, value: string]`
  - `declarations(tokens: readonly Token[], groups: readonly string[]): readonly Declaration[]` (throws on two tokens with one CSS name)
  - `interface Theme { readonly slug: string; readonly name: string; readonly selector: string }`
  - `THEMES: readonly Theme[]` (slugs `morning`, `evening`, `high-contrast-white`, `high-contrast-black`)
  - `GROUPS: readonly string[]`
  - `buildThemeCss(theme: Theme, tree: TokenTree, groups?: readonly string[]): string`

- [ ] **Step 1: Write the failing tests.** Replace the import lines at the top of `src/lib/tokens-build.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { at } from './at';
import {
	buildThemeCss,
	cssName,
	declarations,
	flattenTokens,
	formatColor,
	formatNumber,
	formatValue,
	pathIndex,
	resolveValue,
	type Theme,
	type TokenTree
} from './tokens-build';
```

Append to the file:

```ts
describe('formatColor', () => {
	it('writes an opaque colour as lowercase hex', () => {
		expect(formatColor({ hex: '#0070F2', alpha: 1 })).toBe('#0070f2');
	});
	it('writes a translucent colour as rgb() with a rounded alpha', () => {
		expect(formatColor({ hex: '#131E29', alpha: 0.6000000238418579 })).toBe('rgb(19 30 41 / 0.6)');
		expect(formatColor({ hex: '#FFFFFF', alpha: 0 })).toBe('rgb(255 255 255 / 0)');
	});
	it('refuses a hex it cannot read', () => {
		expect(() => formatColor({ hex: 'blue', alpha: 1 })).toThrow('Not a #rrggbb colour');
	});
});

describe('formatNumber', () => {
	it('uses px, a bare 0, and a 0 to 1 scale for opacity', () => {
		expect(formatNumber('sapFontSize', 14)).toBe('14px');
		expect(formatNumber('Zero', 0)).toBe('0');
		expect(formatNumber('sapShell_BackgroundImageOpacity', 100)).toBe('1');
	});
});

const sample: TokenTree = {
	Main: {
		sapBrandColor: { $type: 'color', $value: { hex: '#0070F2', alpha: 1 } },
		sapDim: { $type: 'color', $value: { hex: '#131E29', alpha: 0.6000000238418579 } }
	},
	Shadow: { sapShadow: { $type: 'color', $value: '{Main.sapBrandColor}' } },
	Container: { Spacing: { Tiny: { $type: 'number', $value: 8 }, Zero: { $type: 'number', $value: 0 } } },
	Shell: { sapShell_BackgroundImageOpacity: { $type: 'number', $value: 100 } },
	Font: { Weight: { sapFontFamily: { $type: 'string', $value: 'Regular' } } },
	Other: { sapOther: { $type: 'color', $value: { hex: '#000000', alpha: 1 } } }
};
const listed = ['Main', 'Shadow', 'Container', 'Shell', 'Font'];

describe('formatValue', () => {
	const tokens = flattenTokens(sample);
	const index = pathIndex(tokens);
	const find = (key: string) => at(tokens.filter((t) => t.key === key), 0);
	it('formats colours (aliases included) and numbers, and skips strings', () => {
		expect(formatValue(find('sapShadow'), index)).toBe('#0070f2');
		expect(formatValue(find('Tiny'), index)).toBe('8px');
		expect(formatValue(find('sapFontFamily'), index)).toBeNull();
	});
	it('throws when a colour resolves to something that is not a colour', () => {
		const odd = flattenTokens({ G: { A: { $type: 'color', $value: 5 } } });
		expect(() => formatValue(at(odd, 0), pathIndex(odd))).toThrow('G.A');
	});
	it('throws when a number resolves to something that is not a number', () => {
		const odd = flattenTokens({ G: { A: { $type: 'number', $value: { hex: '#000000', alpha: 1 } } } });
		expect(() => formatValue(at(odd, 0), pathIndex(odd))).toThrow('G.A');
	});
});

describe('declarations', () => {
	it('keeps only the listed groups, in file order, without strings', () => {
		expect(declarations(flattenTokens(sample), listed)).toEqual([
			['--sapBrandColor', '#0070f2'],
			['--sapDim', 'rgb(19 30 41 / 0.6)'],
			['--sapShadow', '#0070f2'],
			['--hz-Container-Spacing-Tiny', '8px'],
			['--hz-Container-Spacing-Zero', '0'],
			['--sapShell_BackgroundImageOpacity', '1']
		]);
	});
	it('throws when two tokens would write the same custom property', () => {
		const clash = flattenTokens({
			A: { sapSame: { $type: 'color', $value: { hex: '#000000', alpha: 1 } } },
			B: { sapSame: { $type: 'color', $value: { hex: '#ffffff', alpha: 1 } } }
		});
		expect(() => declarations(clash, ['A', 'B'])).toThrow('--sapSame');
	});
});

describe('buildThemeCss', () => {
	const morning: Theme = { slug: 'morning', name: 'Morning Horizon', selector: ':root' };
	it('writes a header and one rule with a declaration per token', () => {
		expect(buildThemeCss(morning, sample, listed)).toBe(
			[
				'/* Generated by `npm run build:tokens` from design/horizon/morning.tokens.json (Morning Horizon). Do not edit. */',
				':root {',
				'\t--sapBrandColor: #0070f2;',
				'\t--sapDim: rgb(19 30 41 / 0.6);',
				'\t--sapShadow: #0070f2;',
				'\t--hz-Container-Spacing-Tiny: 8px;',
				'\t--hz-Container-Spacing-Zero: 0;',
				'\t--sapShell_BackgroundImageOpacity: 1;',
				'}',
				''
			].join('\n')
		);
	});
	it('uses the theme selector', () => {
		const evening: Theme = { slug: 'evening', name: 'Evening Horizon', selector: ":root[data-theme='evening']" };
		expect(buildThemeCss(evening, sample, ['Main'])).toContain(":root[data-theme='evening'] {");
	});
});
```

(`cssName` and `resolveValue` stay imported because Task 2's tests use them.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/tokens-build.test.ts`
Expected: FAIL (`formatColor`, `buildThemeCss` and the others are not exported).

- [ ] **Step 3: Append the implementation** to `src/lib/tokens-build.ts`

```ts
/** `#rrggbb`, or `rgb(r g b / a)` when the colour is translucent. */
export function formatColor(value: ColorValue): string {
	const hex = value.hex.toLowerCase();
	if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error(`Not a #rrggbb colour: ${value.hex}`);
	if (value.alpha >= 1) return hex;
	const channel = (from: number): number => parseInt(hex.slice(from, from + 2), 16);
	return `rgb(${channel(1)} ${channel(3)} ${channel(5)} / ${Number(value.alpha.toFixed(3))})`;
}

/** Figma numbers have no unit: opacity is a percentage (100 is `1`), everything else is pixels. */
export function formatNumber(key: string, value: number): string {
	if (key.endsWith('Opacity')) return String(value / 100);
	return value === 0 ? '0' : `${value}px`;
}

function isColor(value: TokenValue): value is ColorValue {
	return typeof value === 'object';
}

/** The CSS text for a token, or `null` for a string token (those are Figma font-style labels, not CSS). */
export function formatValue(token: Token, index: ReadonlyMap<string, Token>): string | null {
	if (token.type === 'string') return null;
	const value = resolveValue(token, index);
	if (token.type === 'color' && isColor(value)) return formatColor(value);
	if (token.type === 'number' && typeof value === 'number') return formatNumber(token.key, value);
	throw new Error(`${token.path.join('.')}: a ${token.type} token does not hold a ${token.type}`);
}

export type Declaration = readonly [name: string, value: string];

/** The `name: value` pairs for the tokens whose top-level group is listed. Throws when two tokens share a CSS name. */
export function declarations(tokens: readonly Token[], groups: readonly string[]): readonly Declaration[] {
	const index = pathIndex(tokens);
	const result = tokens
		.filter((token) => groups.includes(token.path[0] ?? ''))
		.flatMap((token): readonly Declaration[] => {
			const value = formatValue(token, index);
			return value === null ? [] : [[cssName(token), value]];
		});
	const names = result.map(([name]) => name);
	const duplicate = names.find((name, i) => names.indexOf(name) !== i);
	if (duplicate !== undefined) throw new Error(`Two tokens would write ${duplicate}`);
	return result;
}

export interface Theme {
	readonly slug: string;
	readonly name: string;
	readonly selector: string;
}

/** The four Horizon themes. Morning is the default; the others wait for the theme switcher. */
export const THEMES: readonly Theme[] = [
	{ slug: 'morning', name: 'Morning Horizon', selector: ':root' },
	{ slug: 'evening', name: 'Evening Horizon', selector: ":root[data-theme='evening']" },
	{ slug: 'high-contrast-white', name: 'High Contrast White', selector: ":root[data-theme='high-contrast-white']" },
	{ slug: 'high-contrast-black', name: 'High Contrast Black', selector: ":root[data-theme='high-contrast-black']" }
];

/** The top-level groups of the export that are written out. Adding a group is one line here. */
export const GROUPS: readonly string[] = [
	'Main',
	'Interaction',
	'Application',
	'Text',
	'Button',
	'Input',
	'List',
	'Shell',
	'Tile',
	'Link',
	'Semantic',
	'Focus',
	'Chart',
	'Font',
	'Shadow',
	'Container'
];

/** One theme's stylesheet. */
export function buildThemeCss(theme: Theme, tree: TokenTree, groups: readonly string[] = GROUPS): string {
	return [
		`/* Generated by \`npm run build:tokens\` from design/horizon/${theme.slug}.tokens.json (${theme.name}). Do not edit. */`,
		`${theme.selector} {`,
		...declarations(flattenTokens(tree), groups).map(([name, value]) => `\t${name}: ${value};`),
		'}',
		''
	].join('\n');
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/tokens-build.test.ts`
Expected: PASS.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write src/lib/tokens-build.ts src/lib/tokens-build.test.ts
git add src/lib/tokens-build.ts src/lib/tokens-build.test.ts
git commit -m "feat: format Horizon values and build a theme stylesheet" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Aliases and the whole build

**Files:**
- Modify: `src/lib/tokens-build.ts` (append)
- Modify: `src/lib/tokens-build.test.ts` (extend imports, append tests)

**Interfaces:**
- Consumes: `Declaration`, `declarations`, `flattenTokens`, `GROUPS`, `THEMES`, `buildThemeCss`, `TokenTree` from Task 3.
- Produces:
  - `interface Alias { readonly name: string; readonly token: string; readonly was: string }`
  - `ALIASES: readonly Alias[]` (nine entries)
  - `buildAliasCss(aliases: readonly Alias[], morning: readonly Declaration[]): string`
  - `buildAll(sources: Readonly<Record<string, TokenTree>>): Readonly<Record<string, string>>`: keys `morning.css`, `evening.css`, `high-contrast-white.css`, `high-contrast-black.css`, `aliases.css`; `sources` is keyed by theme slug.

- [ ] **Step 1: Write the failing tests.** Add `ALIASES`, `buildAliasCss` and `buildAll` to the import list in `src/lib/tokens-build.test.ts`, then append:

```ts
describe('buildAliasCss', () => {
	const morning = declarations(flattenTokens(sample), listed);
	it('writes var() references for names whose value still matches', () => {
		const css = buildAliasCss([{ name: '--brand', token: 'sapBrandColor', was: '#0070f2' }], morning);
		expect(css).toContain(':root {');
		expect(css).toContain('\t--brand: var(--sapBrandColor);');
	});
	it('throws when the Horizon value no longer equals the old one', () => {
		expect(() => buildAliasCss([{ name: '--brand', token: 'sapBrandColor', was: '#ffffff' }], morning)).toThrow(
			'--brand was #ffffff'
		);
	});
	it('throws when the Horizon token is not written at all', () => {
		expect(() => buildAliasCss([{ name: '--brand', token: 'sapGone', was: '#ffffff' }], morning)).toThrow('missing');
	});
});

describe('ALIASES', () => {
	it('names each custom property once, and writes each as a var() of a different property', () => {
		expect(new Set(ALIASES.map((a) => a.name)).size).toBe(ALIASES.length);
		expect(ALIASES.every((a) => /^#[0-9a-f]{6}$/.test(a.was) && a.name !== `--${a.token}`)).toBe(true);
	});
});

describe('buildAll', () => {
	const all = {
		morning: { Main: { sapHighlightColor: { $type: 'color', $value: { hex: '#0064D9', alpha: 1 } } } },
		evening: { Main: { sapHighlightColor: { $type: 'color', $value: { hex: '#4DA1FF', alpha: 1 } } } },
		'high-contrast-white': { Main: {} },
		'high-contrast-black': { Main: {} }
	};
	it('throws when a theme file is missing', () => {
		expect(() => buildAll({ morning: all.morning })).toThrow('No token file for theme evening');
	});
});
```

(A full run of `buildAll` needs all nine alias targets, so it is tested on the real exports in Task 5.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/tokens-build.test.ts`
Expected: FAIL (`ALIASES`, `buildAliasCss`, `buildAll` are not exported).

- [ ] **Step 3: Append the implementation** to `src/lib/tokens-build.ts`

```ts
export interface Alias {
	/** The existing custom property that components use. */
	readonly name: string;
	/** The Horizon token (its key) that now supplies the value. */
	readonly token: string;
	/** The value the name had before, in lowercase hex. The build fails when Horizon Morning no longer equals it. */
	readonly was: string;
}

/**
 * The existing names whose value is exactly a Horizon Morning token. Names with no exact match (`--positive`,
 * `--negative`, `--grey-01`, `--blue-05`, ...) stay in tokens.css, so no page changes colour.
 */
export const ALIASES: readonly Alias[] = [
	{ name: '--color-primary', token: 'sapHighlightColor', was: '#0064d9' },
	{ name: '--text-secondary', token: 'sapContent_LabelColor', was: '#556b82' },
	{ name: '--surface-group', token: 'sapBackgroundColor', was: '#f5f6f7' },
	{ name: '--surface-card', token: 'sapGroup_ContentBackground', was: '#ffffff' },
	{ name: '--surface-hover', token: 'sapHoverColor', was: '#eaecee' },
	{ name: '--surface-shell', token: 'sapShellColor', was: '#ffffff' },
	{ name: '--border-subtle', token: 'sapGroup_ContentBorderColor', was: '#d9d9d9' },
	{ name: '--critical', token: 'sapCriticalColor', was: '#e76500' },
	{ name: '--information', token: 'sapInformativeColor', was: '#0070f2' }
];

/** The alias stylesheet. Throws when a Horizon Morning value has drifted from the old one, or is not written. */
export function buildAliasCss(aliases: readonly Alias[], morning: readonly Declaration[]): string {
	const values = new Map(morning);
	return [
		'/* Generated by `npm run build:tokens`. Existing names that now read a Horizon token; the build checked each has the value it had before. Do not edit. */',
		':root {',
		...aliases.map(({ name, token, was }) => {
			const now = values.get(`--${token}`);
			if (now !== was) throw new Error(`${name} was ${was}, but --${token} is now ${now ?? 'missing'}`);
			return `\t${name}: var(--${token});`;
		}),
		'}',
		''
	].join('\n');
}

/** Every generated file by name. `sources` holds each parsed export under its theme slug. */
export function buildAll(sources: Readonly<Record<string, TokenTree>>): Readonly<Record<string, string>> {
	const treeOf = (slug: string): TokenTree => {
		const tree = sources[slug];
		if (tree === undefined) throw new Error(`No token file for theme ${slug}`);
		return tree;
	};
	const themes = THEMES.map((theme) => [`${theme.slug}.css`, buildThemeCss(theme, treeOf(theme.slug))] as const);
	const morning = declarations(flattenTokens(treeOf('morning')), GROUPS);
	return Object.fromEntries([...themes, ['aliases.css', buildAliasCss(ALIASES, morning)] as const]);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/tokens-build.test.ts`
Expected: PASS. (`buildAll` throws on `evening` before it needs the aliases, which is what the test asserts.)

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write src/lib/tokens-build.ts src/lib/tokens-build.test.ts
git add src/lib/tokens-build.ts src/lib/tokens-build.test.ts
git commit -m "feat: alias nine existing colour names to Horizon tokens" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The script, the generated CSS and the real-data tests

**Files:**
- Create: `scripts/build-tokens.ts`
- Create: `src/lib/tokens-data.test.ts`
- Create (generated): `src/lib/styles/generated/{morning,evening,high-contrast-white,high-contrast-black,aliases}.css`
- Modify: `package.json` (one script)

**Interfaces:**
- Consumes: `THEMES`, `buildAll`, `declarations`, `flattenTokens`, `GROUPS`, `ALIASES`, `type TokenTree` from `src/lib/tokens-build.ts`; the four JSON files from Task 1.
- Produces: the five CSS files; `npm run build:tokens`.

- [ ] **Step 1: Write the failing real-data tests** in `src/lib/tokens-data.test.ts`

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALIASES, GROUPS, THEMES, buildAll, declarations, flattenTokens, type TokenTree } from './tokens-build';

const root = path.join(import.meta.dirname, '../..');
const sources: Record<string, TokenTree> = Object.fromEntries(
	THEMES.map((theme) => [
		theme.slug,
		JSON.parse(readFileSync(path.join(root, 'design/horizon', `${theme.slug}.tokens.json`), 'utf8')) as TokenTree
	])
);
const names = (slug: string): readonly string[] =>
	declarations(flattenTokens(sources[slug] ?? {}), GROUPS).map(([name]) => name);

describe('the Figma exports', () => {
	it('hold the same 1141 tokens in all four themes', () => {
		for (const theme of THEMES) expect(flattenTokens(sources[theme.slug] ?? {})).toHaveLength(1141);
	});
	it('write the same custom properties in every theme, so a theme switch changes values and never names', () => {
		const morning = names('morning');
		expect(morning.length).toBeGreaterThan(400);
		for (const theme of THEMES) expect(names(theme.slug)).toEqual(morning);
	});
	it('contain every Horizon token an existing name is aliased to', () => {
		const morning = new Set(names('morning'));
		for (const alias of ALIASES) expect(morning.has(`--${alias.token}`)).toBe(true);
	});
});

describe('the generated stylesheets', () => {
	it('are exactly what the script writes from the committed exports', () => {
		const built = buildAll(sources);
		expect(Object.keys(built).sort()).toEqual([
			'aliases.css',
			'evening.css',
			'high-contrast-black.css',
			'high-contrast-white.css',
			'morning.css'
		]);
		for (const [file, css] of Object.entries(built))
			expect(readFileSync(path.join(root, 'src/lib/styles/generated', file), 'utf8'), file).toBe(css);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/tokens-data.test.ts`
Expected: the first two groups PASS or FAIL on real data (read the failure; see Step 5), and the sync test FAILS with ENOENT (the CSS does not exist yet).

- [ ] **Step 3: Write the script** `scripts/build-tokens.ts`

```ts
// Builds src/lib/styles/generated/*.css (one stylesheet per Horizon theme, plus aliases.css) from the Figma
// "export variable modes" files in design/horizon/. See docs/horizon-tokens.md.
// Usage: node scripts/build-tokens.ts   (no network)
import fs from 'node:fs';
import path from 'node:path';
import { THEMES, buildAll, type TokenTree } from '../src/lib/tokens-build.ts';

const root = path.join(import.meta.dirname, '..');
const sources: Record<string, TokenTree> = Object.fromEntries(
	THEMES.map((theme) => [
		theme.slug,
		JSON.parse(fs.readFileSync(path.join(root, 'design/horizon', `${theme.slug}.tokens.json`), 'utf8')) as TokenTree
	])
);

const out = path.join(root, 'src/lib/styles/generated');
fs.mkdirSync(out, { recursive: true });
for (const [file, css] of Object.entries(buildAll(sources))) {
	fs.writeFileSync(path.join(out, file), css);
	console.log(`${path.relative(root, path.join(out, file))}: ${css.split('\n').length - 3} lines`);
}
```

Add to `package.json` `scripts`, next to `build:gdp`:

```json
    "build:tokens": "node scripts/build-tokens.ts",
```

- [ ] **Step 4: Generate the CSS**

Run: `npm run build:tokens`
Expected: five lines such as `src/lib/styles/generated/morning.css: 517 lines` (the exact count may differ slightly). No error. If it throws `--surface-card was #ffffff, but …`, read the message: it names the alias whose Horizon value differs; fix that one `ALIASES` entry or remove it, then rerun.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/tokens-build.test.ts src/lib/tokens-data.test.ts`
Expected: PASS. If "write the same custom properties in every theme" fails, a theme's export differs in structure from Morning; report which names differ before changing anything, because the generated themes must stay swappable.

- [ ] **Step 6: Spot-check the output**

```bash
head -5 src/lib/styles/generated/morning.css
cat src/lib/styles/generated/aliases.css
grep -c "var(--" src/lib/styles/generated/morning.css
wc -c src/lib/styles/generated/*.css
```

Expected: a header comment and `:root {`; nine `var(--sap…)` lines in `aliases.css`; `0` for the `var(--` count in `morning.css` (aliases are flattened to literals); each theme file roughly 20–30 KB.

- [ ] **Step 7: Format check and commit**

```bash
npx prettier --write scripts/build-tokens.ts src/lib/tokens-data.test.ts
git add scripts/build-tokens.ts src/lib/tokens-data.test.ts src/lib/styles/generated package.json
git commit -m "feat: build:tokens writes the Horizon stylesheets" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Use the generated files without changing how pages look

**Files:**
- Modify: `src/routes/+layout.svelte:5-7` (the two stylesheet imports)
- Modify: `src/lib/styles/tokens.css` (delete nine declarations)

**Interfaces:**
- Consumes: `generated/morning.css`, `generated/aliases.css` from Task 5.

- [ ] **Step 1: Record the current computed values for later comparison**

Run (this writes to the scratchpad, not the project):

```bash
grep -nE '^\s*--(color-primary|text-secondary|surface-group|surface-card|surface-hover|surface-shell|border-subtle|critical|information):' src/lib/styles/tokens.css
```

Expected: nine lines. Note each line number.

- [ ] **Step 2: Delete those nine declarations from `tokens.css`**

Delete exactly the nine lines found in Step 1 (including any trailing comment on the same line). Leave `--text-link`, `--color-primary-hover`, `--border-focus`, `--surface-page` and the palette alone. Then add one comment line above the `/* ---- Semantic aliases ---- */` heading:

```css
	/* --color-primary, --text-secondary, --surface-group/-card/-hover/-shell, --border-subtle, --critical and --information are in generated/aliases.css */
```

Verify:

```bash
grep -nE '^\s*--(color-primary|text-secondary|surface-group|surface-card|surface-hover|surface-shell|border-subtle|critical|information):' src/lib/styles/tokens.css
```

Expected: no output.

- [ ] **Step 3: Import the generated files**

In `src/routes/+layout.svelte` replace

```ts
	import '../lib/styles/tokens.css';
	import '../lib/styles/global.css';
```

with

```ts
	import '../lib/styles/tokens.css';
	import '../lib/styles/generated/morning.css';
	import '../lib/styles/generated/aliases.css';
	import '../lib/styles/global.css';
```

(Keep the existing comment above these imports: the relative path is still needed.)

- [ ] **Step 4: Run every CI gate**

```bash
npm run check && npm run lint && npm run format:check && npm run check:ts-only
npm run test:coverage
npm run build
npx playwright install chromium   # first time only
npm run test:e2e
```

Expected: 0 errors everywhere; coverage thresholds met; e2e reports no page errors, CSP blocks or serious axe violations.

- [ ] **Step 5: Look at the pages**

Run `npm run build && npm run preview`, open `/`, `/countries`, `/industries` and `/login`. Because every aliased value is asserted equal to the old one, the pages should look the same as before. Check in DevTools that `:root` now lists `--sapBrandColor` and that `--surface-card` computes to `#ffffff`. If a page looks different, stop and report which one.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+layout.svelte src/lib/styles/tokens.css
git commit -m "feat: load the Morning Horizon tokens and alias nine names to them" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation

**Files:**
- Create: `docs/horizon-tokens.md`
- Modify: `README.md` (scripts table, line near `npm run build:crosswalk`)
- Modify: `CLAUDE.md` (one bullet)

- [ ] **Step 1: Write `docs/horizon-tokens.md`**

```markdown
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
- `aliases.css` points nine existing names at Horizon tokens. The build checks each has exactly the value it had before.

## Not yet on Horizon

These existing names have no exact Horizon Morning match, so they keep their own value (`src/lib/styles/tokens.css`). Moving them is a visible change and needs a decision: `--blue-05`, `--blue-10`, `--blue-40`, `--blue-90`, `--grey-01`, `--grey-05`, `--grey-08`, `--positive*`, `--negative*`, `--critical-bg`, `--critical-border`, `--information-bg`, `--information-border`. The palette names (`--white`, `--ink`, `--blue-60`…) are literal colours and also stay.

## Before switching on another theme

Do not import `evening.css` or a high-contrast file yet. Components still read palette names such as `--white` and `--ink`, which do not change with a theme, so dark surfaces would keep dark text. The theme-switcher change has to alias or replace those names first, and the chart colours in `size.ts`, `chart.ts` and `Treemap.svelte` need Phase 2 of `docs/superpowers/specs/2026-11-11-horizon-tokens-design.md`.
```

- [ ] **Step 2: Add the script to the README table**

In `README.md`, change the row

```
| `npm run build:crosswalk` / `build:companies` | Regenerate the data files (see `docs/crosswalk.md`) |
```

to add a new row directly below it:

```
| `npm run build:tokens` | Regenerate the Horizon CSS from the Figma exports (see `docs/horizon-tokens.md`) |
```

- [ ] **Step 3: Add the convention to `CLAUDE.md`**

Directly after the **Generated data** bullet, add:

```
- **Design tokens** for the Horizon theme come from Figma exports in `design/horizon/` through `npm run build:tokens` into `src/lib/styles/generated/`. Do not edit those CSS files; `tokens-data.test.ts` checks they match. Only `morning.css` and `aliases.css` are imported; a name goes into `ALIASES` in `src/lib/tokens-build.ts` only if its value equals a Horizon Morning token exactly. See `docs/horizon-tokens.md`.
```

- [ ] **Step 4: Verify and commit**

```bash
npm run format:check && npm run check:ts-only
git add docs/horizon-tokens.md README.md CLAUDE.md
git commit -m "docs: how the Horizon tokens are generated" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Expected: both checks pass (Markdown is not checked by Prettier).

- [ ] **Step 5: Hand over for review**

Do not push or open the PR yet. Report to the owner: branch `feat/horizon-tokens`, the commits, the output of the CI gates from Task 6 Step 4, the list in "Not yet on Horizon", and ask whether to push and open the PR. The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. `main` is protected: a PR and a passing `test` check are required, and nothing merges without the owner's approval.

---

## Self-review

**Spec coverage:** generated pipeline (Tasks 2–5); four themes generated, only Morning imported (Tasks 3, 5, 6); allow-list of groups (`GROUPS`, Task 3); aliases only where values are identical (`ALIASES`, Task 4, with the build failing on drift); non-colour layout tokens left hand-written (untouched in Task 6); sources committed under `design/horizon` (Task 1); sync test (Task 5); docs, README script row and CLAUDE.md line (Task 7); spec corrections (Task 1). Phase 2 is explicitly a separate plan.

**Placeholder scan:** none; every code step has its code. Task 6 Step 2 refers to nine lines "found in Step 1" because their exact text, including trailing comments, is in the file and not copied here.

**Type consistency:** `Token`, `TokenTree`, `Declaration`, `Theme`, `Alias` and the function names (`flattenTokens`, `cssName`, `pathIndex`, `resolveValue`, `formatColor`, `formatNumber`, `formatValue`, `declarations`, `buildThemeCss`, `buildAliasCss`, `buildAll`, `ALIASES`, `GROUPS`, `THEMES`) are the same in every task and in the test imports.

**Known uncertainty:** the unit tests and the lint rules (`strictTypeChecked`) have not been run against this code; Task 2–6 each run them and any rule complaint is fixed in place. The real-data test "write the same custom properties in every theme" assumes the four exports share a structure; Task 5 Step 5 says what to do if they do not.
