import { describe, expect, it } from 'vitest';
import { ISR_ALLOW_QUERY } from './server/access';
import { MAX_SELECTED, SIZE_PARAMS, parseSizeNav, sizeHref, toggle } from './size-nav';

const known = {
	countries: ['Japan', 'Netherlands', 'Chile'],
	industries: ['Banks', 'Steel'],
	sectors: ['Financials', 'Materials']
};
const q = (s: string) => new URLSearchParams(s);

describe('parseSizeNav', () => {
	it('defaults to companies with nothing selected', () => {
		expect(parseSizeNav(q(''), known, '/countries')).toEqual({ measure: 'companies', countries: [], industries: [], sectors: [] });
	});
	it('reads repeated parameters, sorted and without duplicates', () => {
		const nav = parseSizeNav(q('country=Netherlands&country=Japan&country=Japan&industry=Steel'), known, '/countries');
		expect(nav.countries).toEqual(['Japan', 'Netherlands']);
		expect(nav.industries).toEqual(['Steel']);
	});
	it('drops unknown values and unknown measures', () => {
		const nav = parseSizeNav(q('country=Atlantis&industry=Nope&sector=x&measure=banana'), known, '/countries');
		expect(nav).toEqual({ measure: 'companies', countries: [], industries: [], sectors: [] });
	});
	it('allows GDP only on the countries page with no industry or sector restriction', () => {
		expect(parseSizeNav(q('measure=gdp'), known, '/countries').measure).toBe('gdp');
		expect(parseSizeNav(q('measure=gdp'), known, '/industries').measure).toBe('companies');
		expect(parseSizeNav(q('measure=gdp&industry=Banks'), known, '/countries').measure).toBe('companies');
		expect(parseSizeNav(q('measure=gdp&sector=Financials'), known, '/countries').measure).toBe('companies');
		expect(parseSizeNav(q('measure=gdp&country=Japan'), known, '/countries').measure).toBe('gdp');
	});
	it('caps each selection', () => {
		const many = Array.from({ length: MAX_SELECTED + 5 }, (_, i) => `C${String(i).padStart(2, '0')}`);
		const nav = parseSizeNav(new URLSearchParams(many.map((c) => ['country', c])), { ...known, countries: many }, '/countries');
		expect(nav.countries).toHaveLength(MAX_SELECTED);
	});
});

describe('sizeHref', () => {
	it('writes one canonical URL whatever order the facets were chosen in', () => {
		const a = parseSizeNav(q('country=Japan&industry=Banks'), known, '/countries');
		const b = parseSizeNav(q('industry=Banks&country=Japan'), known, '/countries');
		expect(sizeHref('/countries', a)).toBe('/countries?country=Japan&industry=Banks');
		expect(sizeHref('/countries', a)).toBe(sizeHref('/countries', b));
	});
	it('leaves out defaults', () => {
		expect(sizeHref('/industries', { measure: 'companies', countries: [], industries: [], sectors: [] })).toBe('/industries');
		expect(sizeHref('/countries', { measure: 'gdp', countries: [], industries: [], sectors: [] })).toBe('/countries?measure=gdp');
	});
	it('round trips', () => {
		const nav = { measure: 'gdp' as const, countries: ['Japan', 'Netherlands'], industries: [], sectors: [] };
		const url = new URL(sizeHref('/countries', nav), 'http://x.test');
		expect(parseSizeNav(url.searchParams, known, '/countries')).toEqual(nav);
	});
});

describe('toggle', () => {
	it('adds a missing value and removes a present one', () => {
		expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
		expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
	});
});

describe('query parameters and the ISR cache layer', () => {
	it('lists every parameter the size pages read in ISR_ALLOW_QUERY (Vercel drops the others)', () => {
		for (const name of SIZE_PARAMS) expect(ISR_ALLOW_QUERY).toContain(name);
	});
});
