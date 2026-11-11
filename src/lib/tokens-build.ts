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
