import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import real from './data/gdp.json';
import companies from './data/companies.json';
import { gdpOf, gdpValues, gdpYearRange, type GdpData } from './gdp';

const data: GdpData = {
	generated: '2026-10-28',
	source: 'World Bank NY.GDP.MKTP.CD',
	world: { value: 1000, year: 2025 },
	countries: { NLD: { name: 'Netherlands', value: 100, year: 2024 }, JPN: { name: 'Japan', value: 300, year: 2025 } },
	nyu: { Netherlands: 'NLD', Japan: 'JPN', Gibraltar: 'GIB' },
	unmatched: ['Taiwan']
};

describe('gdp helpers', () => {
	it('looks a GDP up by NYU country name', () => {
		expect(gdpOf(data, 'Netherlands')).toEqual({ value: 100, year: 2024 });
		expect(gdpOf(data, 'Gibraltar')).toBeNull(); // mapped, but the World Bank has no value
		expect(gdpOf(data, 'Taiwan')).toBeNull(); // not mapped
	});
	it('builds the value map for shareOfGlobal, leaving out countries without GDP', () => {
		expect(gdpValues(data, ['Netherlands', 'Japan', 'Taiwan', 'Gibraltar'])).toEqual({ Netherlands: 100, Japan: 300 });
	});
	it('reports the span of years', () => {
		expect(gdpYearRange(data)).toEqual([2024, 2025]);
	});
});

describe('the generated gdp.json', () => {
	const gdp = real as unknown as GdpData;
	const names = (companies as { countries: string[] }).countries;
	it('accounts for every NYU country, mapped or listed as unmatched', () => {
		expect(names.filter((n) => !(n in gdp.nyu) && !gdp.unmatched.includes(n))).toEqual([]);
	});
	it('uses each World Bank country once', () => {
		const iso = Object.values(gdp.nyu);
		expect(new Set(iso).size).toBe(iso.length);
	});
	it('holds a plausible world total', () => {
		expect(gdp.world.value).toBeGreaterThan(5e13);
	});
	it('lists the unmatched countries in docs/size.md', () => {
		const doc = readFileSync(new URL('../../docs/size.md', import.meta.url), 'utf8');
		for (const name of gdp.unmatched) expect(doc).toContain(name);
	});
});
