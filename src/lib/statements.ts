// src/lib/statements.ts
import type { Period } from './financials-nav';
import type { Statement } from './source-data';

export interface StatementTable {
	currency: string | null;
	columns: { year: string; date: string }[];
	rows: { key: string; label: string; cells: string[] }[];
}

const ABBREVIATIONS = /\b(ebitda|ebit|eps|ppe|sga|rd)\b/gi;

export function humanise(key: string): string {
	const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
	const sentence = words.charAt(0).toUpperCase() + words.slice(1);
	return sentence.replace(ABBREVIATIONS, (m) => m.toUpperCase());
}

const millions = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatValue(key: string, value: number | null): string {
	if (value === null) return 'n/a';
	if (/^eps|eps$/i.test(key)) return value.toFixed(2);
	return millions.format(value / 1_000_000);
}

/** Ratios and multiples are plain numbers, not amounts in millions. */
export function formatRatio(_key: string, value: number | null): string {
	return value === null ? 'n/a' : value.toFixed(2);
}

/** Estimates and earnings: analyst counts are whole numbers, EPS is per share, everything else is an amount in millions. */
export function formatEstimate(key: string, value: number | null): string {
	if (value === null) return 'n/a';
	if (/^num/i.test(key)) return String(Math.round(value));
	return formatValue(key, value);
}

export function buildTable(
	statement: Statement,
	period: Period = 'annual',
	format: (key: string, value: number | null) => string = formatValue
): StatementTable {
	if (statement.years.length === 0) return { currency: null, columns: [], rows: [] };
	return {
		currency: statement.years[0].currency,
		columns: statement.years.map((y) => ({ year: period === 'ttm' ? 'TTM' : y.fiscalYear, date: y.date })),
		rows: statement.lines.map((key) => ({
			key,
			label: humanise(key),
			cells: statement.years.map((y) => format(key, y.values[key] ?? null))
		}))
	};
}
