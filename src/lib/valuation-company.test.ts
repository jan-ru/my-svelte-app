import { describe, expect, it } from 'vitest';
import { MAX_ENCODED, MAX_YEARS, decodeCompany, encodeCompany } from './valuation-company';
import type { CompanyFigures } from './valuation-data';

const full = (revenue: number | null) => ({
	revenue,
	ebitda: 2,
	ebit: null,
	netIncome: -3.5,
	bookEquity: null,
	investedCapital: null
});
const company: CompanyFigures = {
	name: 'Café Ölmann BV',
	currency: 'EUR',
	origin: 'manual',
	netDebt: -500,
	years: [
		{ fiscalYear: '2025', kind: 'actual', values: full(1000) },
		{ fiscalYear: '2026', kind: 'forecast', values: full(null) }
	]
};
const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const row = (year: unknown = '2025', actual: unknown = 1, values: unknown[] = [1, 2, 3, 4, 5, 6]) => [
	year,
	actual,
	...values
];

describe('encodeCompany and decodeCompany', () => {
	it('round-trip, including non-ASCII names, and stay URL-safe', () => {
		const encoded = encodeCompany(company);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeCompany(encoded)).toEqual(company);
	});
	it('fill missing figures with null', () => {
		const sparse: CompanyFigures = {
			...company,
			years: [{ fiscalYear: '2025', kind: 'actual', values: { revenue: 5 } }]
		};
		expect(decodeCompany(encodeCompany(sparse))?.years[0]?.values).toEqual({
			revenue: 5,
			ebitda: null,
			ebit: null,
			netIncome: null,
			bookEquity: null,
			investedCapital: null
		});
	});
	it.each([
		['nothing', null],
		['an empty string', ''],
		['too long', 'a'.repeat(MAX_ENCODED + 1)],
		['not base64', '%%%'],
		['not UTF-8', btoa('\xff\xfe').replace(/=+$/, '')],
		['not JSON', b64('x').slice(0, -2) + 'zz'],
		['not an array', b64({ a: 1 })],
		['the wrong length', b64(['A', 'EUR', 0])],
		['an empty name', b64([' ', 'EUR', 0, [row()]])],
		['a long name', b64(['x'.repeat(81), 'EUR', 0, [row()]])],
		['a bad currency', b64(['A', 'euro', 0, [row()]])],
		['a bad net debt', b64(['A', 'EUR', 'x', [row()]])],
		['no years', b64(['A', 'EUR', 0, []])],
		['too many years', b64(['A', 'EUR', 0, Array.from({ length: MAX_YEARS + 1 }, () => row())])],
		['a bad year', b64(['A', 'EUR', 0, [row('25')]])],
		['a bad kind', b64(['A', 'EUR', 0, [row('2025', 2)]])],
		['a bad figure', b64(['A', 'EUR', 0, [row('2025', 1, [1, 2, 3, 4, 5, 'x'])]])],
		['a short year row', b64(['A', 'EUR', 0, [['2025', 1, 1]]])]
	])('decodeCompany rejects %s', (_what, raw) => {
		expect(decodeCompany(raw)).toBeNull();
	});
});
