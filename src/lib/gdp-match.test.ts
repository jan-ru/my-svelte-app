import { describe, expect, it } from 'vitest';
import { MANUAL_NAMES, matchCountries } from './gdp-match';

const wb = [
	{ iso3: 'NLD', name: 'Netherlands' },
	{ iso3: 'KOR', name: 'Korea, Rep.' },
	{ iso3: 'JPN', name: 'Japan' },
	{ iso3: 'CHI', name: 'Channel Islands' }
];

describe('matchCountries', () => {
	it('matches exact names and the manual table, and reports the rest', () => {
		const m = matchCountries(['Netherlands', 'South Korea', 'Taiwan'], wb, { 'South Korea': 'Korea, Rep.' });
		expect(m.mapping).toEqual({ Netherlands: 'NLD', 'South Korea': 'KOR' });
		expect(m.unmatched).toEqual(['Taiwan']);
		expect(m.unusedWb).toEqual(['CHI', 'JPN']);
		expect(m.badManual).toEqual([]);
	});
	it('reports a manual entry whose target is not a World Bank name', () => {
		const m = matchCountries(['Russia'], wb, { Russia: 'Russian Federation' });
		expect(m.mapping).toEqual({});
		expect(m.unmatched).toEqual(['Russia']);
		expect(m.badManual).toEqual(['Russia']);
	});
	it('refuses two NYU names for one country (GDP would be counted twice)', () => {
		expect(() => matchCountries(['Netherlands', 'Holland'], wb, { Holland: 'Netherlands' })).toThrow(/NLD/);
	});
	it('keeps Jersey and Guernsey out of the manual table (both would map to the Channel Islands)', () => {
		expect(MANUAL_NAMES).not.toHaveProperty('Jersey');
		expect(MANUAL_NAMES).not.toHaveProperty('Guernsey');
	});
});
