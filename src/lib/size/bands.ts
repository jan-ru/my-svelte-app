// src/lib/size/bands.ts
// Zooming a treemap through the ranking. The values on the size pages span about five orders of magnitude, so one
// treemap cannot show the small items legibly. A band is a run of the ranking whose largest item is at most
// BAND_RATIO times its smallest; each band gets the whole frame, and the items after it are one "more" tile in the
// bottom-right corner that links to the next band.
import { at } from '../at';
import type { TreemapItem } from './treemap';

/** The id of the "more" tile: a NUL character, which no country, industry or sector name contains. */
export const MORE_ID = '\u0000more';
/** The largest item of a band is at most this many times its smallest, so every label in it gets room. */
export const BAND_RATIO = 25;
/** A band holds at most this many items, however close their values are. */
export const BAND_MAX = 30;
/** A band holds at least this many items (a smaller last band joins the one before it). */
export const BAND_MIN = 5;
/** The fill of the "more" tile: a neutral grey, so it does not read as one more country or sector. */
export const MORE_FILL = '#D5DADD';

/** One band: its 1-based number, how many bands there are, and the 1-based ranks it covers. */
export interface Band {
	readonly index: number;
	readonly count: number;
	readonly first: number;
	readonly last: number;
}

/** A band of a ranking and the tiles to draw for it. */
export interface Banded {
	readonly band: Band;
	/** The band's items, then the "more" tile when smaller items follow. */
	readonly tiles: readonly TreemapItem[];
	/** How many items the "more" tile stands for (0 on the last band). */
	readonly rest: number;
}

/** The bands of values sorted largest first, as [start, end) index pairs that cover every value once. */
export function bandRanges(values: readonly number[]): readonly (readonly [number, number])[] {
	const ranges: [number, number][] = [];
	for (let start = 0; start < values.length;) {
		const floor = at(values, start) / BAND_RATIO;
		let end = start + 1;
		while (end < values.length && end - start < BAND_MAX && at(values, end) >= floor) end++;
		end = Math.min(values.length, Math.max(end, start + BAND_MIN));
		ranges.push([start, end]);
		start = end;
	}
	const last = ranges.at(-1);
	const before = ranges.at(-2);
	if (last && before && last[1] - last[0] < BAND_MIN) ranges.splice(-2, 2, [before[0], last[1]]);
	return ranges;
}

/**
 * The tiles of band `requested` (1-based; clamped to the bands there are) of `items`, which must be sorted largest
 * first. `moreLabel` names the "more" tile from the number of items it stands for. An empty list has one empty band.
 */
export function bandOf(items: readonly TreemapItem[], requested: number, moreLabel: (rest: number) => string): Banded {
	const ranges = bandRanges(items.map((i) => i.value));
	if (ranges.length === 0) return { band: { index: 1, count: 1, first: 0, last: 0 }, tiles: [], rest: 0 };
	const index = Math.min(Math.max(1, Math.trunc(requested)), ranges.length);
	const [start, end] = at(ranges, index - 1);
	const after = items.slice(end);
	const more: TreemapItem[] =
		after.length > 0
			? [
					{
						id: MORE_ID,
						label: moreLabel(after.length),
						value: after.reduce((s, i) => s + i.value, 0),
						fill: MORE_FILL,
						group: MORE_ID
					}
				]
			: [];
	return {
		band: { index, count: ranges.length, first: start + 1, last: end },
		tiles: [...items.slice(start, end), ...more],
		rest: after.length
	};
}
