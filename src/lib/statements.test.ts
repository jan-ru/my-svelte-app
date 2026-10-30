// src/lib/statements.test.ts
import { describe, expect, it } from 'vitest';
import type { Statement } from './server/fmp';
import { buildTable, formatEstimate, formatRatio, formatValue, humanise } from './statements';

describe('humanise', () => {
	it('turns camelCase into a sentence', () => {
		expect(humanise('costOfRevenue')).toBe('Cost of revenue');
		expect(humanise('netIncome')).toBe('Net income');
	});
	it('upper-cases known abbreviations', () => {
		expect(humanise('ebitda')).toBe('EBITDA');
		expect(humanise('epsDiluted')).toBe('EPS diluted');
	});
});

describe('formatValue', () => {
	it('shows money in millions with one decimal', () => {
		expect(formatValue('revenue', 1_234_500_000)).toBe('1,234.5');
		expect(formatValue('netIncome', -2_000_000)).toBe('-2.0');
	});
	it('shows per-share figures with two decimals, unscaled', () => {
		expect(formatValue('eps', 1.256)).toBe('1.26');
		expect(formatValue('epsDiluted', 0.5)).toBe('0.50');
	});
	it('shows n/a for missing values', () => {
		expect(formatValue('revenue', null)).toBe('n/a');
	});
});

describe('buildTable', () => {
	const statement: Statement = {
		lines: ['revenue', 'eps'],
		years: [
			{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { revenue: 2_000_000, eps: 1 } },
			{ fiscalYear: '2023', date: '2023-12-31', currency: 'USD', values: { revenue: null } }
		]
	};
	it('has one column per year and one row per line', () => {
		const t = buildTable(statement);
		expect(t.currency).toBe('USD');
		expect(t.columns).toEqual([
			{ year: '2024', date: '2024-12-31' },
			{ year: '2023', date: '2023-12-31' }
		]);
		expect(t.rows).toEqual([
			{ key: 'revenue', label: 'Revenue', cells: ['2.0', 'n/a'] },
			{ key: 'eps', label: 'EPS', cells: ['1.00', 'n/a'] }
		]);
	});
	it('is empty without years', () => {
		expect(buildTable({ lines: [], years: [] })).toEqual({ currency: null, columns: [], rows: [] });
	});
});

describe('buildTable period', () => {
	const statement: Statement = {
		lines: ['revenue'],
		years: [{ fiscalYear: '', date: '2025-06-30', currency: 'USD', values: { revenue: 3_000_000 } }]
	};
	it('labels the column TTM for trailing twelve months', () => {
		expect(buildTable(statement, 'ttm').columns).toEqual([{ year: 'TTM', date: '2025-06-30' }]);
	});
	it('keeps the fiscal year for annual', () => {
		const annual = { ...statement, years: [{ ...statement.years[0], fiscalYear: '2024' }] };
		expect(buildTable(annual).columns[0].year).toBe('2024');
	});
});

describe('formatValue for Yahoo per-share keys', () => {
	it('shows EPS in whole currency units, whatever the key spelling', () => {
		expect(formatValue('dilutedEPS', 2.451)).toBe('2.45');
		expect(formatValue('basicEPS', 1)).toBe('1.00');
		expect(formatValue('epsdiluted', 2.45)).toBe('2.45');
		expect(formatValue('totalRevenue', 8_732_000_000)).toBe('8,732.0');
	});
});

describe('formatRatio', () => {
	it('shows a plain number with two decimals, not an amount in millions', () => {
		expect(formatRatio('priceToEarningsRatio', 28.456)).toBe('28.46');
		expect(formatRatio('grossProfitMargin', 0.4621)).toBe('0.46');
	});
	it('shows n/a for a missing value', () => {
		expect(formatRatio('priceToEarningsRatio', null)).toBe('n/a');
	});
	it('is used by buildTable when passed in', () => {
		const table = buildTable(
			{ lines: ['peRatio'], years: [{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { peRatio: 25 } }] },
			'annual',
			formatRatio
		);
		expect(table.rows[0].cells).toEqual(['25.00']);
	});
});

describe('formatEstimate', () => {
	it('shows analyst counts as whole numbers, EPS per share and amounts in millions', () => {
		expect(formatEstimate('numAnalystsEps', 31)).toBe('31');
		expect(formatEstimate('epsAvg', 8.123)).toBe('8.12');
		expect(formatEstimate('epsActual', 1.85)).toBe('1.85');
		expect(formatEstimate('revenueAvg', 5.1e11)).toBe('510,000.0');
		expect(formatEstimate('revenueActual', null)).toBe('n/a');
	});
});
