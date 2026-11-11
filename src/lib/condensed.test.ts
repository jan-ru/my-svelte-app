import { describe, expect, it } from 'vitest';
import { CONDENSED_BALANCE, condenseBalance } from './condensed';
import type { Statement } from './source-data';

const year = (fiscalYear: string, values: Record<string, number | null>) => ({
	fiscalYear,
	date: `${fiscalYear}-12-31`,
	currency: 'USD',
	values
});

describe('condenseBalance', () => {
	it('keeps the condensed lines in a fixed order and drops the rest (FMP names)', () => {
		const statement: Statement = {
			lines: ['deferredRevenue', 'totalAssets', 'cashAndShortTermInvestments', 'totalStockholdersEquity'],
			years: [
				year('2024', {
					deferredRevenue: 1,
					totalAssets: 300,
					cashAndShortTermInvestments: 50,
					totalStockholdersEquity: 90
				}),
				year('2023', {
					deferredRevenue: 2,
					totalAssets: 280,
					cashAndShortTermInvestments: 40,
					totalStockholdersEquity: 80
				})
			]
		};
		const out = condenseBalance(statement);
		expect(out.lines).toEqual(['cashAndShortTermInvestments', 'totalAssets', 'totalEquity']);
		expect(out.years.map((y) => y.values.totalEquity)).toEqual([90, 80]);
		expect(out.years[0]?.fiscalYear).toBe('2024');
	});
	it('understands Yahoo names', () => {
		const statement: Statement = {
			lines: ['currentAssets', 'stockholdersEquity', 'netPPE'],
			years: [year('2024', { currentAssets: 10, stockholdersEquity: 5, netPPE: 3 })]
		};
		expect(condenseBalance(statement).lines).toEqual([
			'otherCurrentAssets',
			'totalCurrentAssets',
			'propertyPlantAndEquipment',
			'totalEquity'
		]);
	});
	it('uses a later name when the first has no figure, and shows a missing year as null', () => {
		const statement: Statement = {
			lines: ['netReceivables', 'accountsReceivable'],
			years: [year('2024', { netReceivables: null, accountsReceivable: 7 }), year('2023', { accountsReceivable: null })]
		};
		const out = condenseBalance(statement);
		expect(out.lines).toEqual(['receivables']);
		expect(out.years.map((y) => y.values.receivables)).toEqual([7, null]);
	});
	it('works out the other lines as what is left of each subtotal, so the rows add up', () => {
		const values = {
			cashAndShortTermInvestments: 100,
			netReceivables: 50,
			inventory: 10,
			otherCurrentAssets: 999, // the source's own figure is replaced by the remainder
			totalCurrentAssets: 190,
			propertyPlantEquipmentNet: 80,
			goodwillAndIntangibleAssets: 20,
			totalAssets: 340,
			accountPayables: 60,
			shortTermDebt: 15,
			totalCurrentLiabilities: 100,
			longTermDebt: 70,
			totalLiabilities: 210
		};
		const statement: Statement = { lines: Object.keys(values), years: [year('2024', values)] };
		const v = condenseBalance(statement).years[0]?.values ?? {};
		expect(v.otherCurrentAssets).toBe(30); // 190 - 100 - 50 - 10
		expect(v.otherNonCurrentAssets).toBe(50); // 340 - 190 - 80 - 20
		expect(v.otherCurrentLiabilities).toBe(25); // 100 - 60 - 15
		expect(v.otherNonCurrentLiabilities).toBe(40); // 210 - 100 - 70
		expect(
			(v.cashAndShortTermInvestments ?? 0) + (v.receivables ?? 0) + (v.inventory ?? 0) + (v.otherCurrentAssets ?? 0)
		).toBe(v.totalCurrentAssets);
	});
	it("falls back to the source's own other figure when a subtotal is missing", () => {
		const statement: Statement = {
			lines: ['otherCurrentAssets', 'totalAssets'],
			years: [year('2024', { otherCurrentAssets: 12, totalAssets: 100 })]
		};
		const v = condenseBalance(statement).years[0]?.values ?? {};
		expect(v.otherCurrentAssets).toBe(12);
		expect(v.otherNonCurrentAssets).toBeNull();
	});
	it('returns the statement unchanged when no line is known', () => {
		const statement: Statement = { lines: ['mystery'], years: [year('2024', { mystery: 1 })] };
		expect(condenseBalance(statement)).toBe(statement);
	});
	it('has unique keys', () => {
		const keys = CONDENSED_BALANCE.map((l) => l.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
