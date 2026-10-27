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

/** Round tick values covering [min, max] with a little padding; unlike `niceTicks` the range need not include 0. */
export function priceTicks(
	min: number,
	max: number,
	count = 5
): { ticks: number[]; min: number; max: number } {
	const pad = max === min ? Math.abs(min) * 0.05 || 1 : (max - min) * 0.05;
	let lo = min - pad;
	const hi = max + pad;
	if (min >= 0) lo = Math.max(0, lo);

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_MONTH_TICKS = 12;

/** The first point of each month, as x-axis labels; the year is added on the first label and on January. */
export function monthTicks(points: readonly { date: string }[]): { index: number; label: string }[] {
	let starts: { index: number; month: number; year: string }[] = [];
	points.forEach((p, index) => {
		const month = Number(p.date.slice(5, 7)) - 1;
		if (index === 0 || month !== Number(points[index - 1].date.slice(5, 7)) - 1) {
			starts.push({ index, month, year: p.date.slice(2, 4) });
		}
	});
	// a partial first month would put two labels almost on top of each other
	if (starts.length > 1 && starts[1].index - starts[0].index < points.length / 24) starts = starts.slice(1);
	const excess = starts.length - MAX_MONTH_TICKS;
	if (excess === 1) starts = starts.slice(1);
	else if (excess > 1) {
		const stride = Math.ceil(starts.length / MAX_MONTH_TICKS);
		starts = starts.filter((_, i) => i % stride === 0);
	}
	return starts.map((s, i) => ({
		index: s.index,
		label: i === 0 || s.month === 0 ? `${MONTHS[s.month]} '${s.year}` : MONTHS[s.month]
	}));
}
