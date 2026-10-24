/** Colour-blind-safe palette (Okabe-Ito), one colour per series position. */
export const PALETTE: readonly string[] = ['#0072B2', '#E69F00', '#009E73', '#CC79A7'];

/** Bars based on fewer firms than this are drawn hatched. */
export const LOW_FIRMS_THRESHOLD = 10;

export function formatMultiple(value: number | null): string {
	return value === null ? 'n/a' : `${value.toFixed(1)}x`;
}

/** Round tick values covering [min, max]; the range always includes 0. */
export function niceTicks(
	min: number,
	max: number,
	count = 5
): { ticks: number[]; min: number; max: number } {
	const lo = Math.min(0, min);
	const hi = Math.max(0, max);
	if (hi === lo) return { ticks: [0, 1], min: 0, max: 1 };

	const raw = (hi - lo) / (count - 1);
	const exp = Math.floor(Math.log10(raw));
	const fraction = raw / 10 ** exp;
	const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * 10 ** exp;

	const niceMin = Math.floor(lo / step) * step;
	const niceMax = Math.ceil(hi / step) * step;
	const n = Math.round((niceMax - niceMin) / step);
	const ticks = Array.from({ length: n + 1 }, (_, i) => Number((niceMin + i * step).toFixed(10)));
	return { ticks, min: ticks[0], max: ticks[ticks.length - 1] };
}
