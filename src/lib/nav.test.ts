import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ABOUT_SECTIONS, EXPLORE_HOME, EXPLORE_LINKS, inExplore, mainLinks } from './nav';

describe('explore navigation', () => {
	it('recognises exactly the explore pages', () => {
		for (const l of EXPLORE_LINKS) expect(inExplore(l.href)).toBe(true);
		for (const p of ['/', '/financials', '/about', '/countriesx', '/countries/x']) expect(inExplore(p)).toBe(false);
	});
	it('opens on the first page', () => {
		expect(EXPLORE_HOME).toBe('/countries');
	});
});

describe('about sections', () => {
	const page = readFileSync(new URL('../routes/about/+page.svelte', import.meta.url), 'utf8');
	it('each menu entry points at a heading with that id', () => {
		for (const s of ABOUT_SECTIONS) expect(page).toContain(`<h2 id="${s.id}">`);
	});
	it('has unique ids', () => {
		expect(new Set(ABOUT_SECTIONS.map((s) => s.id)).size).toBe(ABOUT_SECTIONS.length);
	});
});

describe('mainLinks', () => {
	const current = (pathname: string) =>
		mainLinks(pathname)
			.filter((l) => l.current)
			.map((l) => l.label);
	it('lists the five pages in order', () => {
		expect(mainLinks('/').map((l) => l.label)).toEqual(['Multiples', 'Explore', 'Financials', 'Valuation', 'About']);
	});
	it('marks exactly the page you are on', () => {
		expect(current('/')).toEqual(['Multiples']);
		expect(current('/companies')).toEqual(['Explore']);
		expect(current('/financials')).toEqual(['Financials']);
		expect(current('/financials/valuation')).toEqual(['Valuation']);
		expect(current('/about')).toEqual(['About']);
	});
	it('marks nothing on a page outside the menu', () => {
		expect(current('/login')).toEqual([]);
	});
});
