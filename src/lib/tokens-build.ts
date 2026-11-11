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

/** `#rrggbb`, or `rgb(r g b / a)` when the colour is translucent. */
export function formatColor(value: ColorValue): string {
	const hex = value.hex.toLowerCase();
	if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error(`Not a #rrggbb colour: ${value.hex}`);
	if (value.alpha >= 1) return hex;
	const channel = (from: number): number => parseInt(hex.slice(from, from + 2), 16);
	return `rgb(${channel(1)} ${channel(3)} ${channel(5)} / ${Number(value.alpha.toFixed(3))})`;
}

/**
 * Figma numbers have no unit: opacity is a percentage (100 is `1`), everything else is pixels, or rem (16px to the
 * rem) where the caller asks for it.
 */
export function formatNumber(key: string, value: number, unit: 'px' | 'rem' = 'px'): string {
	if (key.endsWith('Opacity')) return String(value / 100);
	if (value === 0) return '0';
	return unit === 'rem' ? `${value / 16}rem` : `${value}px`;
}

/** Container/Spacing holds the space and gap tokens (breakpoints excepted); they are written in rem like our own spacing. */
function isSpacing({ path, key }: Pick<Token, 'path' | 'key'>): boolean {
	return path[0] === 'Container' && path[1] === 'Spacing' && !key.includes('Breakpoint');
}

function isColor(value: TokenValue): value is ColorValue {
	return typeof value === 'object';
}

/** The CSS text for a token, or `null` for a string token (those are Figma font-style labels, not CSS). */
export function formatValue(token: Token, index: ReadonlyMap<string, Token>): string | null {
	if (token.type === 'string') return null;
	const value = resolveValue(token, index);
	if (token.type === 'color' && isColor(value)) return formatColor(value);
	if (token.type === 'number' && typeof value === 'number')
		return formatNumber(token.key, value, isSpacing(token) ? 'rem' : 'px');
	throw new Error(`${token.path.join('.')}: a ${token.type} token does not hold a ${token.type}`);
}

export type Declaration = readonly [name: string, value: string];

function assertUnique(result: readonly Declaration[]): readonly Declaration[] {
	const names = result.map(([name]) => name);
	const duplicate = names.find((name, i) => names.indexOf(name) !== i);
	if (duplicate !== undefined) throw new Error(`Two tokens would write ${duplicate}`);
	return result;
}

/** The `name: value` pairs for the tokens whose top-level group is listed. Throws when two tokens share a CSS name. */
export function declarations(tokens: readonly Token[], groups: readonly string[]): readonly Declaration[] {
	const index = pathIndex(tokens);
	return assertUnique(
		tokens
			.filter((token) => groups.includes(token.path[0] ?? ''))
			.flatMap((token): readonly Declaration[] => {
				const value = formatValue(token, index);
				return value === null ? [] : [[cssName(token), value]];
			})
	);
}

const SHADOW_LEVELS = [0, 1, 2, 3] as const;
const SHADOW_PARTS = ['X', 'Y', 'Blur', 'Spread', 'Color'] as const;

/**
 * Horizon's four shadows, `--sapContent_Shadow0` to `--sapContent_Shadow3`. The export holds each as atoms (position,
 * blur, spread and colour for two layers), so the box-shadow value is put together here.
 */
export function shadowDeclarations(tokens: readonly Token[]): readonly Declaration[] {
	const index = pathIndex(tokens);
	const atom = (level: number, part: string, layer: number): string => {
		const token = index.get(`Additional Variables.Shadow Atoms.Shadow${level}_${part}_${layer}`);
		const value = token === undefined ? null : formatValue(token, index);
		if (value === null) throw new Error(`Shadow${level}: no ${part}_${layer} atom`);
		return value;
	};
	return SHADOW_LEVELS.map((level): Declaration => [
		`--sapContent_Shadow${level}`,
		[1, 2].map((layer) => SHADOW_PARTS.map((part) => atom(level, part, layer)).join(' ')).join(', ')
	]);
}

/**
 * The shell bar's shadow, `--sapShell_Shadow`, put together from its two layers of atoms in the Shell group
 * (`Shell_Shadow_X_1`, ..., `Shell_ShadowColor_2`). Nothing is written when the export has none; a half-present layer throws.
 */
export function shellShadowDeclarations(tokens: readonly Token[]): readonly Declaration[] {
	const index = pathIndex(tokens);
	if (![...index.keys()].some((path) => path.startsWith('Shell.Shell_Shadow'))) return [];
	const atom = (name: string, layer: number): string => {
		const token = index.get(`Shell.Shell_${name}_${layer}`);
		const value = token === undefined ? null : formatValue(token, index);
		if (value === null) throw new Error(`Shell shadow: no ${name}_${layer} atom`);
		return value;
	};
	const layers = [1, 2].map((layer) =>
		['Shadow_X', 'Shadow_Y', 'Shadow_Blur', 'Shadow_Spread', 'ShadowColor'].map((name) => atom(name, layer)).join(' ')
	);
	return [['--sapShell_Shadow', layers.join(', ')]];
}

/** Everything one theme writes: the listed groups, then the composed shadows. Throws when two names clash. */
export function themeDeclarations(tokens: readonly Token[], groups: readonly string[]): readonly Declaration[] {
	return assertUnique([
		...declarations(tokens, groups),
		...shadowDeclarations(tokens),
		...shellShadowDeclarations(tokens)
	]);
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
		...themeDeclarations(flattenTokens(tree), groups).map(([name, value]) => `\t${name}: ${value};`),
		'}',
		''
	].join('\n');
}

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
	{ name: '--information', token: 'sapInformativeColor', was: '#0070f2' },
	// Spacing: the four steps of our 4px scale that equal Horizon's (8, 16, 32 and 48px) exactly. 4px, 12px and 24px
	// have no Horizon step and stay in tokens.css.
	{ name: '--space-2', token: 'sapContent_Space_Tiny', was: '0.5rem' },
	{ name: '--space-4', token: 'sapContent_Space_Small', was: '1rem' },
	{ name: '--space-8', token: 'sapContent_Space_Medium', was: '2rem' },
	{ name: '--space-12', token: 'sapContent_Space_Large', was: '3rem' }
];

export interface Adoption {
	/** The existing custom property that components use. */
	readonly name: string;
	/** The Horizon token (its key) that now supplies the value. */
	readonly token: string;
}

/** Names that take Horizon's value on purpose, so they look different. Nothing checks an old value. */
export const ADOPTED: readonly Adoption[] = [
	{ name: '--shadow-1', token: 'sapContent_Shadow0' },
	{ name: '--shadow-2', token: 'sapContent_Shadow1' },
	{ name: '--shadow-3', token: 'sapContent_Shadow2' },
	{ name: '--shadow-4', token: 'sapContent_Shadow3' },
	// Focus: Horizon's focus colour (a darker blue than our #0070f2) and 2px width.
	{ name: '--border-focus', token: 'sapContent_FocusColor' },
	{ name: '--focus-ring', token: 'sapContent_FocusWidth' }
];

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

const remOf = (px: number): string => `${px / 16}rem`;

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

/**
 * The alias stylesheet. Throws when a Horizon Morning value has drifted from the old one, or when a token is not
 * written. The adopted names follow the aliases, under a comment that says their look changes.
 */
export function buildAliasCss(
	aliases: readonly Alias[],
	morning: readonly Declaration[],
	adopted: readonly Adoption[] = []
): string {
	const values = new Map(morning);
	return [
		'/* Generated by `npm run build:tokens`. Existing names that now read a Horizon token; the build checked each has the value it had before. Do not edit. */',
		':root {',
		...aliases.map(({ name, token, was }) => {
			const now = values.get(`--${token}`);
			if (now !== was) throw new Error(`${name} was ${was}, but --${token} is now ${now ?? 'missing'}`);
			return `\t${name}: var(--${token});`;
		}),
		...(adopted.length === 0 ? [] : ["\t/* Adopted on purpose: these take Horizon's value and look different. */"]),
		...adopted.map(({ name, token }) => {
			if (!values.has(`--${token}`)) throw new Error(`${name}: --${token} is missing`);
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
	const morning = themeDeclarations(flattenTokens(treeOf('morning')), GROUPS);
	return Object.fromEntries([
		...themes,
		['aliases.css', buildAliasCss(ALIASES, morning, ADOPTED)] as const,
		['grid.css', buildGridCss(GRID, morning)] as const
	]);
}
