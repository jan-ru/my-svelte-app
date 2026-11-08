import { describe, expect, it } from 'vitest';
import {
	parseEulerpoolCurrency,
	parseEulerpoolPrices,
	parseEulerpoolProfile,
	parseEulerpoolStatement
} from './eulerpool-parse';
import { SourceError } from './source-error';

// Trimmed from real responses for AAPL (statements are in millions, oldest first, forecasts last).
const income = [
	{
		ticker: 'AAPL',
		period: '2023-09-30',
		revenue: 383285,
		grossIncome: 169148,
		ebit: 114301,
		netIncome: 96995,
		diluted_eps: 6.13
	},
	{
		ticker: 'AAPL',
		period: '2024-09-30',
		revenue: 391035,
		grossIncome: 180683,
		ebit: 123216,
		netIncome: 93736,
		diluted_eps: 6.08
	},
	{
		ticker: 'AAPL',
		period: '2025-09-30',
		revenue: 416161,
		grossIncome: 195201,
		ebit: 133050,
		netIncome: 112010,
		diluted_eps: 7.562951,
		shares: 14810.356
	},
	{ ticker: 'AAPL', period: '2026-09-30e', revenue: 450000, netIncome: 120000, diluted_eps: null }
];

describe('parseEulerpoolStatement', () => {
	it('returns actual years newest first, in dollars, without the analyst forecasts', () => {
		const statement = parseEulerpoolStatement('income', income, 'USD');
		expect(statement.years.map((y) => y.date)).toEqual(['2025-09-30', '2024-09-30', '2023-09-30']);
		expect(statement.years[0]).toMatchObject({ fiscalYear: '2025', currency: 'USD' });
		expect(statement.years[0]?.values.revenue).toBe(416_161_000_000);
	});
	it('keeps per-share figures as they are and scales share counts', () => {
		const [latest] = parseEulerpoolStatement('income', income, 'USD').years;
		expect(latest?.values.dilutedEPS).toBe(7.562951);
		expect(latest?.values.shares).toBe(14_810_356_000);
	});
	it('names the figures as the other sources do, key lines first', () => {
		const { lines } = parseEulerpoolStatement('income', income, null);
		expect(lines.slice(0, 5)).toEqual(['revenue', 'grossProfit', 'ebit', 'netIncome', 'dilutedEPS']);
		expect(lines).not.toContain('diluted_eps');
		expect(lines).not.toContain('ticker');
		expect(lines).not.toContain('period');
	});
	it('keeps at most five years', () => {
		const rows = Array.from({ length: 8 }, (_, i) => ({ period: `${2010 + i}-12-31`, revenue: i + 1 }));
		const years = parseEulerpoolStatement('income', rows, null).years;
		expect(years).toHaveLength(5);
		expect(years[0]?.date).toBe('2017-12-31');
	});
	it('reads a balance sheet with its totals under their usual names', () => {
		const { lines, years } = parseEulerpoolStatement(
			'balance',
			[
				{
					period: '2025-09-27',
					currentAssets: 147957,
					assets: 211284,
					allAssets: 359241,
					currentLiabilities: 165631,
					fixedLiabilities: 119877,
					liabilities: 285508,
					equity: 73732.998,
					capital: 359240.998,
					otherCurrentliabilities: 64406
				}
			],
			'USD'
		);
		expect(lines.slice(0, 5)).toEqual([
			'totalAssets',
			'totalLiabilities',
			'stockholdersEquity',
			'currentAssets',
			'currentLiabilities'
		]);
		expect(years[0]?.values).toMatchObject({
			totalAssets: 359_241_000_000,
			nonCurrentAssets: 211_284_000_000,
			nonCurrentLiabilities: 119_877_000_000,
			stockholdersEquity: 73_732_998_000,
			otherCurrentLiabilities: 64_406_000_000
		});
	});
	it('reads a cash flow statement and does not take the year column for a figure', () => {
		const { lines, years } = parseEulerpoolStatement(
			'cashflow',
			[{ period: '2025-09-27', year: 2025, netOperatingCashFlow: 111482, capex: -12715, fcf: 98767 }],
			'USD'
		);
		expect(lines).toEqual(['operatingCashFlow', 'capitalExpenditure', 'freeCashFlow']);
		expect(years[0]?.values.freeCashFlow).toBe(98_767_000_000);
	});
	it('collapses two rows of one fiscal year into the one with more figures', () => {
		const full = { period: '2025-09-27', allAssets: 359241, liabilities: 285508, equity: 73733, inventory: 5718 };
		const thin = { period: '2025-09-30', allAssets: 286284, liabilities: 277145 };
		for (const rows of [
			[full, thin],
			[thin, full]
		]) {
			const { years } = parseEulerpoolStatement('balance', rows, null);
			expect(years.map((y) => y.date)).toEqual(['2025-09-27']);
			expect(years[0]?.values.totalAssets).toBe(359_241_000_000);
		}
	});
	it('keeps rows a year apart', () => {
		const rows = [
			{ period: '2024-12-31', revenue: 1 },
			{ period: '2025-12-31', revenue: 2 }
		];
		expect(parseEulerpoolStatement('income', rows, null).years).toHaveLength(2);
	});
	it('leaves out missing figures and rows without any', () => {
		const rows = [
			{ period: '2024-12-31', revenue: 5, netIncome: null, ebit: 'n/a' },
			{ period: '2025-12-31', revenue: null }
		];
		const { lines, years } = parseEulerpoolStatement('income', rows, null);
		expect(years).toHaveLength(1);
		expect(lines).toEqual(['revenue']);
		expect(years[0]?.values).toEqual({ revenue: 5_000_000 });
	});
	it('ignores rows that are not objects or have no usable period', () => {
		const rows = ['x', null, { revenue: 1 }, { period: 'FY2024', revenue: 2 }, { period: '2024-12-31', revenue: 3 }];
		expect(parseEulerpoolStatement('income', rows, null).years.map((y) => y.date)).toEqual(['2024-12-31']);
	});
	it('gives an empty statement for an empty list', () => {
		expect(parseEulerpoolStatement('income', [], null)).toEqual({ lines: [], years: [] });
	});
	it('rejects a body that is not a list', () => {
		for (const body of [{}, 'x', null, { error: 'Unauthorized' }]) {
			expect(() => parseEulerpoolStatement('income', body, null)).toThrow(SourceError);
		}
	});
});

describe('parseEulerpoolProfile', () => {
	const overview = {
		isin: 'NL0010273215',
		ticker: 'ASML.AS',
		name: 'ASML Holding NV',
		description: 'A Dutch manufacturer of lithographic machines.',
		currency: 'EUR',
		country: 'NL',
		sector: 'Information Technology',
		industry: 'Semiconductors & Semiconductor Equipment',
		website: 'https://www.asml.com/',
		ipo: '1995-02-01',
		employees: 23860,
		marketCap: 498229.3,
		price: 1283.6
	};
	it('maps an overview, with the market cap in currency units and nothing invented', () => {
		expect(parseEulerpoolProfile(overview)).toEqual({
			name: 'ASML Holding NV',
			exchange: null,
			sector: 'Information Technology',
			industry: 'Semiconductors & Semiconductor Equipment',
			country: 'NL',
			ceo: null,
			website: 'https://www.asml.com/',
			ipoDate: '1995-02-01',
			currency: 'EUR',
			description: 'A Dutch manufacturer of lithographic machines.',
			employees: 23860,
			price: 1283.6,
			marketCap: 498_229_300_000,
			beta: null
		});
	});
	it('drops a website that is not a safe link', () => {
		expect(parseEulerpoolProfile({ name: 'X', website: 'javascript:alert(1)' })?.website).toBeNull();
	});
	it('is null when nothing in it is usable', () => {
		expect(parseEulerpoolProfile({})).toBeNull();
		expect(parseEulerpoolProfile({ name: '  ', employees: 'many' })).toBeNull();
	});
	it('rejects a body that is not an object', () => {
		for (const body of [[], 'x', null, 7]) expect(() => parseEulerpoolProfile(body)).toThrow(SourceError);
	});
});

describe('parseEulerpoolCurrency', () => {
	it('is the currency of an overview, or null', () => {
		expect(parseEulerpoolCurrency({ currency: 'EUR' })).toBe('EUR');
		expect(parseEulerpoolCurrency({ currency: '' })).toBeNull();
		expect(parseEulerpoolCurrency([])).toBeNull();
	});
});

describe('parseEulerpoolPrices', () => {
	it('takes the UTC date of each candle, whatever its hour, and sorts oldest first', () => {
		const points = parseEulerpoolPrices([
			{ timestamp: Date.parse('2026-11-05T14:30:00Z'), open: 1, high: 2, low: 1, close: 344.17 },
			{ timestamp: Date.parse('2026-11-03T21:00:00Z'), open: 1, high: 2, low: 1, close: 331.9 },
			{ timestamp: Date.parse('2026-11-04T08:00:00Z'), open: 1, high: 2, low: 1, close: 349.51 }
		]);
		expect(points).toEqual([
			{ date: '2026-11-03', close: 331.9, volume: null },
			{ date: '2026-11-04', close: 349.51, volume: null },
			{ date: '2026-11-05', close: 344.17, volume: null }
		]);
	});
	it('keeps the later of two candles on one day', () => {
		const points = parseEulerpoolPrices([
			{ timestamp: Date.parse('2026-11-05T08:00:00Z'), close: 1 },
			{ timestamp: Date.parse('2026-11-05T20:00:00Z'), close: 2 }
		]);
		expect(points).toEqual([{ date: '2026-11-05', close: 2, volume: null }]);
	});
	it('skips candles without a usable time or close', () => {
		const points = parseEulerpoolPrices([
			{ close: 1 },
			{ timestamp: 'x', close: 1 },
			{ timestamp: Date.parse('2026-11-05T08:00:00Z'), close: null },
			{ timestamp: 8.64e15 * 2, close: 1 },
			'junk',
			{ timestamp: Date.parse('2026-11-06T08:00:00Z'), close: 3 }
		]);
		expect(points).toEqual([{ date: '2026-11-06', close: 3, volume: null }]);
	});
	it('rejects a body that is not a list', () => {
		expect(() => parseEulerpoolPrices({})).toThrow(SourceError);
	});
});
