// src/lib/football-field.ts
// The geometry-free model of the football-field chart: one bar per method from low to high, the midpoint, the value
// at the sector multiple and the average across methods, on one shared value axis. Pure.
import { formatMultiple, niceTicks } from './chart';
import type { ValuationView } from './valuation-data';
import { METRIC_LABELS, formatAmount, scaleFor, type Scale } from './valuation-format';

export interface FieldRow {
	readonly label: string;
	/** What the multiple was applied to and the band used: "EBITDA 2025, 7.0x to 9.0x". */
	readonly detail: string;
	readonly manual: boolean;
	readonly low: number;
	readonly mid: number;
	readonly high: number;
	readonly sector: number | null;
}

export interface FieldModel {
	readonly rows: readonly FieldRow[];
	readonly ticks: readonly number[];
	readonly min: number;
	readonly max: number;
	readonly average: number | null;
	readonly scale: Scale;
	readonly currency: string;
	/** Methods without a range, by label, so the chart can say what it leaves out. */
	readonly skipped: readonly string[];
}

/** The chart model, or null when no method has a range. */
export function fieldModel(view: ValuationView): FieldModel | null {
	const rows: FieldRow[] = view.methods.flatMap((m) =>
		m.ok
			? [
					{
						label: m.label,
						detail: `${METRIC_LABELS[m.metric]} ${m.fiscalYear}, ${formatMultiple(m.band.low)} to ${formatMultiple(m.band.high)}`,
						manual: m.bandSource === 'manual',
						low: m.low,
						mid: m.mid,
						high: m.high,
						sector: m.sector
					}
				]
			: []
	);
	if (rows.length === 0) return null;
	const values = [
		...rows.flatMap((r) => [r.low, r.high, ...(r.sector === null ? [] : [r.sector])]),
		...(view.average === null ? [] : [view.average])
	];
	const { ticks, min, max } = niceTicks(Math.min(...values), Math.max(...values));
	return {
		rows,
		ticks,
		min,
		max,
		average: view.average,
		scale: scaleFor(values),
		currency: view.currency,
		skipped: view.methods.flatMap((m) => (m.ok ? [] : [m.label]))
	};
}

/** A one-line text version of a row, for the tooltip and the screen-reader summary. */
export function describeRow(row: FieldRow, model: FieldModel): string {
	const f = (v: number) => formatAmount(v, model.scale);
	const sector = row.sector === null ? '' : `, at sector ${f(row.sector)}`;
	return `${row.label} (${row.detail}${row.manual ? ', manual' : ''}): ${f(row.low)} to ${f(row.high)}, mid ${f(row.mid)}${sector}`;
}
