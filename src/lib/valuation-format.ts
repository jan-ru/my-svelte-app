// src/lib/valuation-format.ts
// Labels and number formatting for the valuation page. Pure; also runs in the browser.
import type { Metric, MissingReason } from './valuation-data';

export const METRIC_LABELS: Readonly<Record<Metric, string>> = {
	revenue: 'Revenue',
	ebitda: 'EBITDA',
	ebit: 'EBIT',
	netIncome: 'Net income',
	bookEquity: 'Book equity',
	investedCapital: 'Invested capital'
};

export const REASON_TEXT: Readonly<Record<MissingReason, string>> = {
	'unknown-multiple': 'Unknown multiple.',
	'no-metric': 'The company figure for this multiple is missing.',
	'non-positive-metric': 'The company figure is zero or negative, so this multiple says nothing.',
	'no-net-debt': 'Net debt is missing, so enterprise value cannot be turned into equity value.',
	'no-band': 'No peer has a usable value for this multiple.'
};

/** A unit to show amounts in, so a small private company and a large listed one both read well. */
export interface Scale {
	readonly divisor: number;
	/** For a heading: "millions of EUR". */
	readonly label: string;
}

/** Millions from 10 million up, thousands from 10 thousand up, otherwise units; chosen from the largest value. */
export function scaleFor(values: readonly (number | null | undefined)[]): Scale {
	const max = Math.max(0, ...values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.abs(v) : 0)));
	if (max >= 1e7) return { divisor: 1e6, label: 'millions' };
	if (max >= 1e4) return { divisor: 1e3, label: 'thousands' };
	return { divisor: 1, label: 'units' };
}

const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** An amount in the scale's unit, negative in brackets as in the samples; 'n/a' when missing. */
export function formatAmount(value: number | null | undefined, scale: Scale): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
	const scaled = value / scale.divisor;
	const text = (scale.divisor === 1e6 ? oneDecimal : whole).format(Math.abs(scaled));
	return scaled < 0 && text !== '0' && text !== '0.0' ? `(${text})` : text;
}
