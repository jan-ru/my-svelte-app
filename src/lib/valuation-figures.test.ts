import { describe, expect, it } from 'vitest';
import type { Statement, StatementYear } from './source-data';
import { figuresFromStatements, netDebtOf, peerMultiples } from './valuation-figures';
import type { CompanyFigures } from './valuation-data';

const year = (
	fiscalYear: string,
	values: Record<string, number | null>,
	currency: string | null = 'EUR'
): StatementYear => ({
	fiscalYear,
	date: `${fiscalYear}-12-31`,
	currency,
	values
});
const statement = (...years: StatementYear[]): Statement => ({ lines: [], years });

describe('netDebtOf', () => {
	it('prefers reported net debt, else debt minus cash, else null', () => {
		expect(netDebtOf(year('2025', { netDebt: 50, totalDebt: 1, cashAndCashEquivalents: 1 }))).toBe(50);
		expect(netDebtOf(year('2025', { totalDebt: 80, cashAndCashEquivalents: 30 }))).toBe(50);
		expect(netDebtOf(year('2025', { totalDebt: 80 }))).toBeNull();
		expect(netDebtOf(undefined)).toBeNull();
	});
});

describe('figuresFromStatements', () => {
	it('builds actual years oldest first from FMP lines and appends later estimate years', () => {
		const figures = figuresFromStatements({
			name: 'Example',
			origin: 'fmp',
			income: statement(
				year('2025', { revenue: 1000, ebitda: 200, ebit: 150, netIncome: 90 }),
				year('2024', { revenue: 900, ebitda: null, ebit: 120, netIncome: 70 })
			),
			balance: statement(
				year('2025', { totalStockholdersEquity: 400, netDebt: 100 }),
				year('2024', { totalStockholdersEquity: 350 })
			),
			estimates: statement(
				year('2027', { revenueAvg: 1300, ebitdaAvg: 280, ebitAvg: 210, netIncomeAvg: 120 }),
				year('2026', { revenueAvg: 1150, ebitdaAvg: 240, ebitAvg: 180, netIncomeAvg: 100 }),
				year('2025', { revenueAvg: 990 })
			),
			currency: 'USD'
		});
		expect(figures).toEqual<CompanyFigures>({
			name: 'Example',
			currency: 'EUR',
			origin: 'fmp',
			netDebt: 100,
			years: [
				{
					fiscalYear: '2024',
					kind: 'actual',
					values: { revenue: 900, ebitda: null, ebit: 120, netIncome: 70, bookEquity: 350, investedCapital: null }
				},
				{
					fiscalYear: '2025',
					kind: 'actual',
					values: { revenue: 1000, ebitda: 200, ebit: 150, netIncome: 90, bookEquity: 400, investedCapital: 500 }
				},
				{ fiscalYear: '2026', kind: 'forecast', values: { revenue: 1150, ebitda: 240, ebit: 180, netIncome: 100 } },
				{ fiscalYear: '2027', kind: 'forecast', values: { revenue: 1300, ebitda: 280, ebit: 210, netIncome: 120 } }
			]
		});
	});
	it('reads Yahoo line names and falls back to the given currency', () => {
		const figures = figuresFromStatements({
			name: 'Yahoo Co',
			origin: 'yahoo',
			income: statement(year('2025', { totalRevenue: 500, operatingIncome: 60, ebitda: 80, netIncome: 40 }, null)),
			balance: statement(year('2025', { stockholdersEquity: 300, totalDebt: 120, cashAndCashEquivalents: 20 })),
			estimates: null,
			currency: 'JPY'
		})!;
		expect(figures.currency).toBe('JPY');
		expect(figures.netDebt).toBe(100);
		expect(figures.years).toEqual([
			{
				fiscalYear: '2025',
				kind: 'actual',
				values: { revenue: 500, ebitda: 80, ebit: 60, netIncome: 40, bookEquity: 300, investedCapital: 400 }
			}
		]);
	});
	it('defaults the currency to USD and works without a balance sheet', () => {
		const figures = figuresFromStatements({
			name: 'X',
			origin: 'fmp',
			income: statement(year('2025', { revenue: 1 }, null)),
			balance: null,
			estimates: null,
			currency: null
		})!;
		expect(figures.currency).toBe('USD');
		expect(figures.netDebt).toBeNull();
		expect(figures.years[0]?.values.bookEquity).toBeNull();
	});
	it('is null without income years', () => {
		expect(
			figuresFromStatements({
				name: 'X',
				origin: 'fmp',
				income: statement(),
				balance: null,
				estimates: null,
				currency: null
			})
		).toBeNull();
	});
});

describe('peerMultiples', () => {
	const figures: CompanyFigures = {
		name: 'Peer',
		currency: 'USD',
		origin: 'fmp',
		netDebt: 200,
		years: [
			{
				fiscalYear: '2025',
				kind: 'actual',
				values: { revenue: 1000, ebitda: 100, ebit: -5, netIncome: 50, bookEquity: 400, investedCapital: 600 }
			},
			{ fiscalYear: '2026', kind: 'forecast', values: { netIncome: 80 } }
		]
	};
	it('divides EV or market cap by the figure each multiple uses', () => {
		const { symbol, name, multiples } = peerMultiples('PEER', 'Peer Inc', figures, 800);
		expect(symbol).toBe('PEER');
		expect(name).toBe('Peer Inc');
		expect(multiples).toEqual({
			ev_ebitda: 10,
			ev_ebit: null,
			pe_trailing: 16,
			pe_forward: 10,
			pe_current: 16,
			pbv: 2,
			ev_ic: 1000 / 600,
			ps: 0.8,
			ev_sales: 1
		});
	});
	it('has no EV multiples without net debt, and none at all without figures or a positive market cap', () => {
		const noDebt = peerMultiples('P', 'P', { ...figures, netDebt: null }, 800).multiples;
		expect(noDebt.ev_ebitda).toBeNull();
		expect(noDebt.ps).toBe(0.8);
		expect(Object.values(peerMultiples('P', 'P', null, 800).multiples).every((v) => v === null)).toBe(true);
		expect(Object.values(peerMultiples('P', 'P', figures, 0).multiples).every((v) => v === null)).toBe(true);
		expect(Object.values(peerMultiples('P', 'P', figures, null).multiples).every((v) => v === null)).toBe(true);
	});
	it('has no EV multiple when the enterprise value is not positive', () => {
		expect(peerMultiples('P', 'P', { ...figures, netDebt: -900 }, 800).multiples.ev_sales).toBeNull();
	});
});
