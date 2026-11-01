import { describe, expect, it } from 'vitest';
import {
	parseYahooNews,
	parseYahooPrices,
	parseYahooProfile,
	parseYahooStatement,
	toDate
} from './yahoo-parse';
import { SourceError } from './source-error';

describe('toDate', () => {
	it('reads Dates, epoch seconds, epoch milliseconds and ISO strings', () => {
		const iso = '2025-12-31T00:00:00.000Z';
		expect(toDate(new Date(iso))?.toISOString()).toBe(iso);
		expect(toDate(1767139200)?.toISOString()).toBe(iso);
		expect(toDate(1767139200000)?.toISOString()).toBe(iso);
		expect(toDate(iso)?.toISOString()).toBe(iso);
	});
	it('returns null for anything else', () => {
		[null, undefined, '', 'soon', NaN, {}].forEach((v, i) => { expect(toDate(v), `case ${i}`).toBeNull(); });
	});
});

describe('parseYahooPrices', () => {
	const q = (date: string, close: number | null, volume: number | null = 1000) => ({
		date: new Date(date),
		open: 1,
		close,
		volume
	});
	it('maps quotes to dated closes, oldest first', () => {
		expect(parseYahooPrices([q('2026-10-23T08:00:00Z', 39.5, 10), q('2026-10-22T08:00:00Z', 39.1, null)])).toEqual([
			{ date: '2026-10-22', close: 39.1, volume: null },
			{ date: '2026-10-23', close: 39.5, volume: 10 }
		]);
	});
	it('drops quotes without a close and keeps one point per date (last wins)', () => {
		const points = parseYahooPrices([
			q('2026-10-22T08:00:00Z', 1),
			q('2026-10-22T16:00:00Z', 2),
			q('2026-10-23T08:00:00Z', null),
			null,
			'x'
		]);
		expect(points).toEqual([{ date: '2026-10-22', close: 2, volume: 1000 }]);
	});
	it('dates a quote in the exchange timezone', () => {
		// Sydney opens at 10:00 local on 27 October, which is 23:00 UTC on the 26th
		const quotes = [q('2026-10-26T23:00:00Z', 5)];
		expect(parseYahooPrices(quotes)[0]?.date).toBe('2026-10-26');
		expect(parseYahooPrices(quotes, 39600)[0]?.date).toBe('2026-10-27');
	});
	it('returns [] for an empty list and rejects other shapes', () => {
		expect(parseYahooPrices([])).toEqual([]);
		expect(() => parseYahooPrices({ nope: 1 })).toThrow(SourceError);
	});
});

describe('parseYahooProfile', () => {
	const summary = {
		assetProfile: {
			sector: 'Financial Services',
			industry: 'Banks - Diversified',
			country: 'Netherlands',
			website: 'https://www.abnamro.com',
			fullTimeEmployees: 22905,
			longBusinessSummary: 'ABN AMRO provides banking.',
			companyOfficers: [
				{ name: 'A. CFO', title: 'Chief Financial Officer' },
				{ name: 'M. Boss', title: 'Chief Executive Officer & Chairman' }
			]
		},
		price: {
			longName: 'ABN AMRO Bank N.V.',
			shortName: 'ABN AMRO',
			exchangeName: 'Amsterdam',
			currency: 'EUR',
			regularMarketPrice: 39.74,
			marketCap: 32_385_548_288
		}
	};
	it('maps the profile fields', () => {
		expect(parseYahooProfile(summary)).toEqual({
			name: 'ABN AMRO Bank N.V.',
			exchange: 'Amsterdam',
			sector: 'Financial Services',
			industry: 'Banks - Diversified',
			country: 'Netherlands',
			ceo: 'M. Boss',
			website: 'https://www.abnamro.com/',
			ipoDate: null,
			currency: 'EUR',
			description: 'ABN AMRO provides banking.',
			employees: 22905,
			price: 39.74,
			marketCap: 32_385_548_288,
			beta: null
		});
	});
	it('copes with missing modules and officers', () => {
		const p = parseYahooProfile({ price: { shortName: 'X' } })!;
		expect(p.name).toBe('X');
		expect(p.ceo).toBeNull();
		expect(p.website).toBeNull();
	});
	it('drops an unsafe website', () => {
		expect(parseYahooProfile({ assetProfile: { website: 'javascript:alert(1)', sector: 'S' } })!.website).toBeNull();
	});
	it('returns null when nothing usable is there and rejects non-objects', () => {
		expect(parseYahooProfile({})).toBeNull();
		expect(() => parseYahooProfile(null)).toThrow(SourceError);
		expect(() => parseYahooProfile('x')).toThrow(SourceError);
	});
});

describe('parseYahooNews', () => {
	it('maps items, formats the time and keeps safe links only', () => {
		const items = parseYahooNews([
			{ title: 'Dutch state dilutes ABN', publisher: 'RBI', link: 'https://finance.yahoo.com/news/a', providerPublishTime: new Date('2026-10-25T14:30:00Z') },
			{ title: 'Epoch time', publisher: 'X', link: 'javascript:alert(1)', providerPublishTime: 1767139200 },
			{ title: '', link: 'https://x.test' },
			{ publisher: 'no title' },
			null
		]);
		expect(items).toEqual([
			{ title: 'Dutch state dilutes ABN', publisher: 'RBI', date: '2026-10-25 14:30:00', text: null, url: 'https://finance.yahoo.com/news/a' },
			{ title: 'Epoch time', publisher: 'X', date: '2025-12-31 00:00:00', text: null, url: null }
		]);
	});
	it('returns [] for an empty list and rejects other shapes', () => {
		expect(parseYahooNews([])).toEqual([]);
		expect(() => parseYahooNews(undefined)).toThrow(SourceError);
	});
});

describe('parseYahooStatement', () => {
	const row = (year: number, extra: Record<string, unknown>) => ({
		TYPE: 'FINANCIALS',
		date: new Date(`${year}-12-31T00:00:00Z`),
		periodType: '12M',
		operatingExpense: year,
		...extra
	});
	const annual = [
		row(2023, { totalRevenue: 100, netIncome: 10, dilutedEPS: 1.1 }),
		row(2025, { totalRevenue: 130, netIncome: 14, dilutedEPS: 1.5, interestIncome: 40 }),
		row(2024, { totalRevenue: 115, netIncome: 12, dilutedEPS: 1.3 })
	];
	const trailing = [
		{ TYPE: 'FINANCIALS', date: 1759190400, periodType: 'TTM', totalRevenue: 110, netIncome: 11 },
		{ TYPE: 'FINANCIALS', date: 1767139200, periodType: 'TTM', totalRevenue: 120, netIncome: 13 }
	];

	it('lists key lines first, then the rest in Yahoo order, newest year first', () => {
		const s = parseYahooStatement('income', annual, null, 'annual', 'EUR');
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2025', '2024', '2023']);
		expect(s.years[0]?.date).toBe('2025-12-31');
		expect(s.years[0]?.currency).toBe('EUR');
		expect(s.lines).toEqual(['totalRevenue', 'netIncome', 'dilutedEPS', 'operatingExpense', 'interestIncome']);
		expect(s.years[0]?.values.totalRevenue).toBe(130);
		expect(s.years[2]?.values.interestIncome).toBeUndefined();
	});
	it('leaves out metadata and non-numeric fields', () => {
		const s = parseYahooStatement('income', [row(2025, { totalRevenue: 1, note: 'x', junk: null })], null, 'annual', null);
		expect(s.lines).not.toContain('TYPE');
		expect(s.lines).not.toContain('periodType');
		expect(s.lines).not.toContain('date');
		expect(s.lines).not.toContain('note');
		expect(s.lines).not.toContain('junk');
		expect(s.years[0]?.currency).toBeNull();
	});
	it('keeps at most five years', () => {
		const rows = [2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => row(y, { totalRevenue: y }));
		const s = parseYahooStatement('income', rows, null, 'annual', null);
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2025', '2024', '2023', '2022', '2021']);
	});
	it('uses only the newest trailing point for TTM income and cash flow', () => {
		const s = parseYahooStatement('income', [], trailing, 'ttm', 'EUR');
		expect(s.years).toHaveLength(1);
		expect(s.years[0]?.date).toBe('2025-12-31');
		expect(s.years[0]?.values.totalRevenue).toBe(120);
		const cf = parseYahooStatement('cashflow', [], [{ date: 1767139200, operatingCashFlow: 5 }], 'ttm', null);
		expect(cf.lines).toEqual(['operatingCashFlow']);
	});
	it('uses the latest annual balance sheet for TTM', () => {
		const balance = [
			{ date: new Date('2024-12-31T00:00:00Z'), totalAssets: 1 },
			{ date: new Date('2025-12-31T00:00:00Z'), totalAssets: 2, totalDebt: 3 }
		];
		const s = parseYahooStatement('balance', balance, null, 'ttm', null);
		expect(s.years).toHaveLength(1);
		expect(s.years[0]?.values.totalAssets).toBe(2);
		expect(s.lines).toEqual(['totalAssets', 'totalDebt']);
	});
	it('returns an empty statement when there are no rows, and rejects other shapes', () => {
		expect(parseYahooStatement('income', [], null, 'annual', null)).toEqual({ lines: [], years: [] });
		expect(() => parseYahooStatement('income', { nope: 1 }, null, 'annual', null)).toThrow(SourceError);
		expect(() => parseYahooStatement('income', [], { nope: 1 }, 'ttm', null)).toThrow(SourceError);
	});
	it('skips rows without a usable date', () => {
		const s = parseYahooStatement('income', [{ date: 'soon', totalRevenue: 1 }, row(2025, { totalRevenue: 2 })], null, 'annual', null);
		expect(s.years).toHaveLength(1);
	});
});
