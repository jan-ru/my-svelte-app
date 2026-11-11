import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ADOPTED,
	ALIASES,
	GROUPS,
	THEMES,
	buildAll,
	flattenTokens,
	themeDeclarations,
	type TokenTree
} from './tokens-build';

const root = path.join(import.meta.dirname, '../..');
const sources: Record<string, TokenTree> = Object.fromEntries(
	THEMES.map((theme) => [
		theme.slug,
		JSON.parse(readFileSync(path.join(root, 'design/horizon', `${theme.slug}.tokens.json`), 'utf8')) as TokenTree
	])
);
const names = (slug: string): readonly string[] =>
	themeDeclarations(flattenTokens(sources[slug] ?? {}), GROUPS).map(([name]) => name);

describe('the Figma exports', () => {
	it('hold the same 1141 tokens in all four themes', () => {
		for (const theme of THEMES) expect(flattenTokens(sources[theme.slug] ?? {})).toHaveLength(1141);
	});
	it('write the same custom properties in every theme, so a theme switch changes values and never names', () => {
		const morning = names('morning');
		expect(morning.length).toBeGreaterThan(400);
		for (const theme of THEMES) expect(names(theme.slug)).toEqual(morning);
	});
	it('contain every Horizon token an existing name is aliased to or adopts', () => {
		const morning = new Set(names('morning'));
		for (const alias of [...ALIASES, ...ADOPTED]) expect(morning.has(`--${alias.token}`)).toBe(true);
	});
	it('write the four composed shadows in every theme', () => {
		for (const theme of THEMES) {
			const written = names(theme.slug);
			for (const level of [0, 1, 2, 3]) expect(written).toContain(`--sapContent_Shadow${level}`);
		}
	});
});

describe('the generated stylesheets', () => {
	it('are exactly what the script writes from the committed exports', () => {
		const built = buildAll(sources);
		expect(Object.keys(built).sort()).toEqual([
			'aliases.css',
			'evening.css',
			'grid.css',
			'high-contrast-black.css',
			'high-contrast-white.css',
			'morning.css'
		]);
		for (const [file, css] of Object.entries(built))
			expect(readFileSync(path.join(root, 'src/lib/styles/generated', file), 'utf8'), file).toBe(css);
	});
});

describe('the Morning stylesheet', () => {
	const morning = buildAll(sources)['morning.css'] ?? '';
	it('writes Horizon spacing in rem, so it follows the browser font size, and breakpoints in px', () => {
		expect(morning).toContain('--sapContent_Space_Tiny: 0.5rem;');
		expect(morning).toContain('--sapContent_Space_Large: 3rem;');
		expect(morning).toContain('--sapBreakpoint_M_Min: 600px;');
	});
	it('composes Shadow0 from its two layers', () => {
		expect(morning).toContain('--sapContent_Shadow0: 0 0 2px 0 rgb(34 53 72 / 0.2), 0 2px 4px 0 rgb(34 53 72 / 0.2);');
	});
});

describe('the grid stylesheet', () => {
	const grid = buildAll(sources)['grid.css'] ?? '';
	it('switches at the real Horizon breakpoints', () => {
		expect(grid).toContain('@media (min-width: 600px)');
		expect(grid).toContain('@media (min-width: 1024px)');
		expect(grid).toContain('@media (min-width: 1440px)');
	});
});
