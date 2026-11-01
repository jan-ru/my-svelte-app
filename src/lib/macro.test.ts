import { describe, expect, it } from 'vitest';
import gdp from './data/gdp.json';
import real from './data/macro.json';
import { get } from './at';
import { formatRate, latestYears, macroRows, macroYearRange, summarize, type MacroData } from './macro';

const years = (from: number, values: readonly number[]) => values.map((value, i) => ({ year: from + i, value }));

const data: MacroData = {
	generated: '2026-11-01',
	source: 'World Bank',
	countries: {
		NLD: { inflation: years(2021, [2.7, 11.6, 4.1, 3.2, 2.9]), growth: years(2021, [6.2, 5.0, 0.1, 1.0, 1.4]) },
		VEN: { inflation: [], growth: years(2013, [1.3, -3.9]) }
	}
};
const nyu = { Netherlands: 'NLD', Venezuela: 'VEN', Gibraltar: 'GIB' };

describe('macro helpers', () => {
	it('keeps the latest five years, oldest first, counting from the newest year with a value', () => {
		expect(latestYears(years(2018, [1, 2, 3, 4, 5, 6, 7]).toReversed()).map((v) => v.year)).toEqual([
			2020, 2021, 2022, 2023, 2024
		]);
		// a gap stays a gap: 2019 and 2020 are missing, so only three of the five years remain
		expect(latestYears([...years(2017, [1, 2]), ...years(2021, [3, 4, 5])]).map((v) => v.year)).toEqual([
			2021, 2022, 2023
		]);
	});
	it('summarizes the latest value and the average', () => {
		const s = summarize(get(data.countries, 'NLD').inflation);
		expect(s).toMatchObject({ latest: { year: 2025, value: 2.9 }, from: 2021 });
		expect(s?.average).toBeCloseTo(4.9);
	});
	it('gives no average with fewer than three values, and nothing without values', () => {
		expect(summarize(get(data.countries, 'VEN').growth)).toEqual({
			latest: { year: 2014, value: -3.9 },
			average: null,
			from: 2013
		});
		expect(summarize([])).toBeNull();
	});
	it('builds one row per selected country, in the order selected', () => {
		const rows = macroRows(data, nyu, ['Venezuela', 'Netherlands', 'Gibraltar', 'Taiwan']);
		expect(rows.map((r) => [r.country, r.inflation?.latest.value ?? null, r.growth?.latest.value ?? null])).toEqual([
			['Venezuela', null, -3.9],
			['Netherlands', 2.9, 1.4],
			['Gibraltar', null, null], // mapped, but no values
			['Taiwan', null, null] // not mapped
		]);
		expect(macroRows(data, nyu, [])).toEqual([]);
	});
	it('reports the years shown', () => {
		expect(macroYearRange(macroRows(data, nyu, ['Netherlands', 'Venezuela']))).toEqual([2013, 2025]);
		expect(macroYearRange(macroRows(data, nyu, ['Taiwan']))).toBeNull();
	});
	it('formats a rate with one decimal and a real minus sign', () => {
		expect(formatRate(2.84)).toBe('2.8%');
		expect(formatRate(-0.44)).toBe('−0.4%');
		expect(formatRate(-0.04)).toBe('0.0%');
		expect(formatRate(11.6)).toBe('11.6%');
	});
});

describe('the generated macro.json', () => {
	const values = Object.values(real.countries);
	it('holds both rates for most World Bank countries', () => {
		expect(values.filter((c) => c.inflation.length > 0).length).toBeGreaterThan(150);
		expect(values.filter((c) => c.growth.length > 0).length).toBeGreaterThan(150);
	});
	it('keeps at most five years per rate, oldest first', () => {
		for (const c of values)
			for (const series of [c.inflation, c.growth]) {
				expect(series.length).toBeLessThanOrEqual(5);
				expect(series.map((v) => v.year)).toEqual(series.map((v) => v.year).toSorted((a, b) => a - b));
			}
	});
	it('covers the countries of gdp.json by the same ISO3 codes', () => {
		const mapped = new Set(Object.values(gdp.nyu));
		expect(Object.keys(real.countries).filter((iso) => mapped.has(iso)).length).toBeGreaterThan(100);
	});
	it('has plausible values for the Netherlands', () => {
		const nld = real.countries.NLD;
		expect(nld?.inflation.every((v) => v.value > -5 && v.value < 30)).toBe(true);
		expect(nld?.growth.every((v) => v.value > -15 && v.value < 15)).toBe(true);
	});
});
