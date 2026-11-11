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
