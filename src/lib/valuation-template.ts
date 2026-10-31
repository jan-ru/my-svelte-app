// src/lib/valuation-template.ts
// The Excel template for a private company: what a blank one holds, and how a filled-in sheet (as rows of cells)
// becomes `CompanyFigures`. Pure; reading and writing the .xlsx file is in `server/valuation-template.ts`.
import { MAX_NAME, MAX_YEARS, METRICS } from './valuation-company';
import type { CompanyFigures, FigureYear, Metric } from './valuation-data';
import { METRIC_LABELS } from './valuation-format';

export type Cell = string | number | boolean | null | undefined;

/** Row labels the parser accepts, lower-cased; English as in the template, plus common Dutch terms. */
const ALIASES: Readonly<Record<Metric, readonly string[]>> = {
	revenue: ['revenue', 'sales', 'omzet', 'netto-omzet', 'netto omzet'],
	ebitda: ['ebitda'],
	ebit: ['ebit', 'operating income', 'bedrijfsresultaat'],
	netIncome: ['net income', 'nettowinst', 'netto winst', 'nettoresultaat', 'resultaat na belasting'],
	bookEquity: ['book equity', 'equity', 'eigen vermogen'],
	investedCapital: ['invested capital', 'geïnvesteerd vermogen', 'geinvesteerd vermogen']
};

const label = (cell: Cell): string => String(cell ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** The rows of a blank template, with an example column of each kind. */
export function templateRows(thisYear: number): Cell[][] {
	const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
	return [
		['Company', 'Example BV'],
		['Currency', 'EUR'],
		['Net debt', 0],
		[],
		['Year', ...years],
		['Type', 'Actual', 'Actual', 'Forecast', 'Forecast'],
		...METRICS.map((m) => [METRIC_LABELS[m]]),
		[],
		['Amounts in units of the currency (not thousands). Type is Actual or Forecast. Leave a figure empty if unknown.']
	];
}

export type TemplateResult = { readonly ok: true; readonly figures: CompanyFigures } | { readonly ok: false; readonly error: string };

const fail = (error: string): TemplateResult => ({ ok: false, error });

function amount(cell: Cell): number | null | undefined {
	if (cell === null || cell === undefined || (typeof cell === 'string' && cell.trim() === '')) return null;
	const value = typeof cell === 'number' ? cell : Number(String(cell).replace(/[\s,]/g, ''));
	return Number.isFinite(value) ? value : undefined;
}

/** Read a filled-in template. Labels are matched in column A, in any order; year columns run from column B. */
export function parseTemplateRows(rows: readonly (readonly Cell[])[]): TemplateResult {
	const find = (...names: string[]) => rows.find((r) => names.includes(label(r[0])));

	const name = String(find('company', 'bedrijf')?.[1] ?? '').trim();
	if (!name) return fail('Fill in the company name next to "Company".');
	if (name.length > MAX_NAME) return fail(`The company name is longer than ${MAX_NAME} characters.`);

	const currency = String(find('currency', 'valuta')?.[1] ?? '').trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(currency)) return fail('Fill in a three-letter currency code next to "Currency", such as EUR.');

	const netDebtCell = find('net debt', 'netto schuld')?.[1];
	const netDebt = amount(netDebtCell);
	if (netDebt === undefined) return fail('"Net debt" is not a number.');

	const yearRow = find('year', 'jaar');
	const typeRow = find('type', 'soort');
	if (!yearRow) return fail('The "Year" row is missing.');
	const columns = yearRow
		.map((cell, col) => ({ col, year: String(cell ?? '').trim().replace(/\.0$/, '') }))
		.slice(1)
		.filter((c) => c.year !== '');
	if (columns.length === 0) return fail('The "Year" row has no years.');
	if (columns.length > MAX_YEARS) return fail(`The template holds at most ${MAX_YEARS} years.`);
	const bad = columns.find((c) => !/^\d{4}$/.test(c.year));
	if (bad) return fail(`"${bad.year}" in the "Year" row is not a year.`);

	const metricRows = METRICS.map((m) => ({ m, row: rows.find((r) => ALIASES[m].includes(label(r[0]))) }));
	if (!metricRows.some((r) => r.row)) return fail('None of the figure rows (Revenue, EBITDA, ...) were found.');

	const years: FigureYear[] = [];
	for (const { col, year } of columns) {
		const kind = label(typeRow?.[col]);
		if (kind !== 'actual' && kind !== 'forecast' && kind !== 'realisatie' && kind !== 'prognose') {
			return fail(`Set the type for ${year} to Actual or Forecast.`);
		}
		const values: Partial<Record<Metric, number | null>> = {};
		for (const { m, row } of metricRows) {
			const value = amount(row?.[col]);
			if (value === undefined) return fail(`${METRIC_LABELS[m]} for ${year} is not a number.`);
			values[m] = value;
		}
		years.push({ fiscalYear: year, kind: kind === 'actual' || kind === 'realisatie' ? 'actual' : 'forecast', values });
	}

	const sorted = years.toSorted((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear));
	if (new Set(sorted.map((y) => y.fiscalYear)).size !== sorted.length) return fail('A year appears twice.');
	return { ok: true, figures: { name, currency, origin: 'manual', netDebt, years: sorted } };
}
