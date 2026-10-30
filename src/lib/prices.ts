import type { PricePoint } from './source-data';

export interface PriceSummary {
	date: string;
	close: number;
	change: number | null;
	changePct: number | null;
	high: number;
	low: number;
	volume: number | null;
}

/** Summary of a series sorted oldest first; high and low are the highest and lowest close. */
export function summarise(points: readonly PricePoint[]): PriceSummary | null {
	const last = points.at(-1);
	if (!last) return null;
	const previous = points.length > 1 ? points[points.length - 2] : null;
	const closes = points.map((p) => p.close);
	const change = previous ? last.close - previous.close : null;
	return {
		date: last.date,
		close: last.close,
		change,
		changePct: change !== null && previous && previous.close !== 0 ? (change / previous.close) * 100 : null,
		high: Math.max(...closes),
		low: Math.min(...closes),
		volume: last.volume
	};
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** From one year before `today` to `today`, as UTC dates; 29 February maps to 28 February. */
export function oneYearWindow(today: Date): { from: string; to: string } {
	const y = today.getUTCFullYear();
	const m = today.getUTCMonth();
	const d = today.getUTCDate();
	let from = Date.UTC(y - 1, m, d);
	if (new Date(from).getUTCMonth() !== m) from = Date.UTC(y - 1, m + 1, 0);
	return { from: iso(from), to: iso(Date.UTC(y, m, d)) };
}

const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

export function formatPrice(value: number): string {
	return value.toLocaleString('en', TWO_DECIMALS);
}

export function formatSigned(value: number): string {
	const text = Math.abs(value).toLocaleString('en', TWO_DECIMALS);
	return value > 0 && text !== '0.00' ? `+${text}` : value < 0 && text !== '0.00' ? `-${text}` : text;
}

export function formatVolume(value: number): string {
	return Math.round(value).toLocaleString('en');
}
