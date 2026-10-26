// src/lib/statements.ts
import type { Statement } from './server/fmp';
import type { Period } from './financials-nav';

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
	if (/^eps/i.test(key)) return value.toFixed(2);
	return millions.format(value / 1_000_000);
}

export function buildTable(statement: Statement, period: Period = 'annual'): StatementTable {
	if (statement.years.length === 0) return { currency: null, columns: [], rows: [] };
	return {
		currency: statement.years[0].currency,
		columns: statement.years.map((y) => ({ year: period === 'ttm' ? 'TTM' : y.fiscalYear, date: y.date })),
		rows: statement.lines.map((key) => ({
			key,
			label: humanise(key),
			cells: statement.years.map((y) => formatValue(key, y.values[key] ?? null))
		}))
	};
}
