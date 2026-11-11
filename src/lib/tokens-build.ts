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
