// src/lib/statements.test.ts
import { describe, expect, it } from 'vitest';
import type { Statement } from './server/fmp';
import { buildTable, formatValue, humanise } from './statements';

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
