import { describe, expect, it } from 'vitest';
import { EXPLORE_HOME, EXPLORE_LINKS, inExplore } from './nav';

describe('explore navigation', () => {
	it('recognises exactly the explore pages', () => {
		for (const l of EXPLORE_LINKS) expect(inExplore(l.href)).toBe(true);
		for (const p of ['/', '/financials', '/about', '/countriesx', '/countries/x']) expect(inExplore(p)).toBe(false);
	});
	it('opens on the first page', () => {
		expect(EXPLORE_HOME).toBe('/countries');
	});
});
