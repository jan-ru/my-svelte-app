import { describe, expect, it } from 'vitest';
import { parseTemplateRows, templateRows, type Cell } from './valuation-template';
import { at } from '#lib/at';

/** The blank template with figures typed in, as a sheet would come back. */
function filled(): Cell[][] {
	const rows = templateRows(2026).map((r) => [...r]);
	at(rows, 0)[1] = 'ACCENSS BV';
	at(rows, 2)[1] = 25_000;
	const set = (label: string, ...values: Cell[]) => {
		const r = rows.find((x) => x[0] === label)!;
		r.push(...values);
	};
	set('Revenue', 202_433, 236_730, '180,677', 207_779);
	set('EBITDA', -6_905, 61_970, 4_340, 4_991);
	set('Net income', null, '', 3_057, 3_472);
	return rows;
}

describe('templateRows', () => {
	it('has the labels, two actual and two forecast years around the given year', () => {
		const rows = templateRows(2026);
		expect(rows[4]).toEqual(['Year', 2024, 2025, 2026, 2027]);
		expect(rows[5]).toEqual(['Type', 'Actual', 'Actual', 'Forecast', 'Forecast']);
		expect(rows.map((r) => r[0])).toEqual(
			expect.arrayContaining(['Company', 'Currency', 'Net debt', 'Revenue', 'EBITDA', 'Invested capital'])
		);
	});
});

describe('parseTemplateRows', () => {
	it('reads a filled-in template into figures, oldest year first', () => {
		const result = parseTemplateRows(filled());
		if (!result.ok) throw new Error(result.error);
		const { figures } = result;
		expect(figures).toMatchObject({ name: 'ACCENSS BV', currency: 'EUR', origin: 'manual', netDebt: 25_000 });
		expect(figures.years.map((y) => [y.fiscalYear, y.kind])).toEqual([
			['2024', 'actual'],
			['2025', 'actual'],
			['2026', 'forecast'],
			['2027', 'forecast']
		]);
		expect(figures.years[2]?.values).toEqual({
			revenue: 180_677,
			ebitda: 4_340,
			ebit: null,
			netIncome: 3_057,
			bookEquity: null,
			investedCapital: null
		});
		expect(figures.years[0]?.values.netIncome).toBeNull();
	});
	it('accepts Dutch labels, any row order, lower-case currency, years as text and an empty net debt', () => {
		const rows: Cell[][] = [
			['Jaar', '2026', '2025.0'],
			['Soort', 'Prognose', 'Realisatie'],
			['Omzet', 120, 100],
			['Bedrijf', 'Voorbeeld BV'],
			['Valuta', 'eur'],
			['Netto schuld', null]
		];
		const result = parseTemplateRows(rows);
		if (!result.ok) throw new Error(result.error);
		expect(result.figures.currency).toBe('EUR');
		expect(result.figures.netDebt).toBeNull();
		expect(result.figures.years.map((y) => [y.fiscalYear, y.kind, y.values.revenue])).toEqual([
			['2025', 'actual', 100],
			['2026', 'forecast', 120]
		]);
	});
	const edit = (f: (rows: Cell[][]) => void) => {
		const rows = filled();
		f(rows);
		return rows;
	};
	const row = (rows: Cell[][], label: string) => rows.find((r) => r[0] === label)!;
	it.each([
		['no name', edit((r) => (row(r, 'Company')[1] = '')), 'Fill in the company name'],
		['a long name', edit((r) => (row(r, 'Company')[1] = 'x'.repeat(81))), 'longer than 80'],
		['a bad currency', edit((r) => (row(r, 'Currency')[1] = 'euro')), 'three-letter currency'],
		['a bad net debt', edit((r) => (row(r, 'Net debt')[1] = 'lots')), '"Net debt" is not a number'],
		['no year row', edit((r) => (row(r, 'Year')[0] = 'Period')), 'The "Year" row is missing'],
		['no years', edit((r) => (r[4] = ['Year'])), 'has no years'],
		[
			'too many years',
			edit((r) => (r[4] = ['Year', ...Array.from({ length: 13 }, (_, i) => 2000 + i)])),
			'at most 12 years'
		],
		['a bad year', edit((r) => (row(r, 'Year')[2] = 'FY25')), '"FY25" in the "Year" row is not a year'],
		[
			'no figure rows',
			[
				['Company', 'A'],
				['Currency', 'EUR'],
				['Year', 2025],
				['Type', 'Actual']
			],
			'None of the figure rows'
		],
		['a bad type', edit((r) => (row(r, 'Type')[3] = 'Budget')), 'Set the type for 2026'],
		['a bad figure', edit((r) => (row(r, 'EBITDA')[2] = 'n.v.t.')), 'EBITDA for 2025 is not a number'],
		['a repeated year', edit((r) => (row(r, 'Year')[2] = 2024)), 'A year appears twice']
	])('explains %s', (_what, rows, message) => {
		const result = parseTemplateRows(rows);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain(message);
	});
});
