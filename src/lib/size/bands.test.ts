import { describe, expect, it } from 'vitest';
import { BAND_MAX, BAND_MIN, BAND_RATIO, MORE_FILL, MORE_ID, bandOf, bandRanges } from './bands';
import type { TreemapItem } from './treemap';

const items = (values: readonly number[]): TreemapItem[] =>
	values.map((value, i) => ({ id: `c${String(i)}`, label: `C${String(i)}`, value }));
const more = (n: number) => `${String(n)} smaller countries`;

describe('bandRanges', () => {
	it('has no bands for no values', () => {
		expect(bandRanges([])).toEqual([]);
	});
	it('keeps a short list in one band', () => {
		expect(bandRanges([3])).toEqual([[0, 1]]);
		expect(bandRanges([1000, 1])).toEqual([[0, 2]]);
	});
	it('starts a new band where a value falls below the largest one over BAND_RATIO', () => {
		const values = [2500, 900, 400, 200, 100, 99, 50, 30, 20, 10, 4, 3, 2, 2, 1];
		const ranges = bandRanges(values);
		expect(ranges).toEqual([
			[0, 5],
			[5, 15]
		]);
		// 100 is exactly 2500 / BAND_RATIO, so it is the last value of the first band
		expect(2500 / BAND_RATIO).toBe(100);
	});
	it('holds at most BAND_MAX items in a band, also when the values are equal', () => {
		const ranges = bandRanges(Array.from({ length: 2 * BAND_MAX + 3 }, () => 7));
		expect(ranges.map(([s, e]) => e - s)).toEqual([BAND_MAX, BAND_MAX + 3]);
	});
	it('gives every band at least BAND_MIN items and joins a smaller last band to the one before', () => {
		// each value is far below the one before, so the ratio alone would make a band of every value
		const values = [1e9, 1e7, 1e5, 1e3, 10, 1, 0.5];
		expect(bandRanges(values)).toEqual([[0, 7]]);
		const longer = [...values, 1e-3, 1e-5, 1e-7, 1e-9, 1e-11];
		expect(bandRanges(longer)).toEqual([
			[0, 5],
			[5, 12]
		]);
	});
	it('covers every value exactly once, in order', () => {
		const values = Array.from({ length: 200 }, (_, i) => 1e6 / (i + 1) ** 2);
		const ranges = bandRanges(values);
		expect(ranges[0]?.[0]).toBe(0);
		expect(ranges.at(-1)?.[1]).toBe(values.length);
		for (let i = 1; i < ranges.length; i++) expect(ranges[i]?.[0]).toBe(ranges[i - 1]?.[1]);
		for (const [start, end] of ranges) expect(end - start).toBeGreaterThanOrEqual(BAND_MIN);
	});
});

describe('bandOf', () => {
	const values = [2500, 900, 400, 200, 100, 99, 50, 30, 20, 10, 4, 3, 2, 2, 1];
	it('shows the first band and the rest as one "more" tile, pinned to the bottom-right', () => {
		const { band, tiles, rest } = bandOf(items(values), 1, more);
		expect(band).toEqual({ index: 1, count: 2, first: 1, last: 5 });
		expect(rest).toBe(10);
		expect(tiles.map((t) => t.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', MORE_ID]);
		expect(tiles.at(-1)).toEqual({
			id: MORE_ID,
			label: '10 smaller countries',
			value: 99 + 50 + 30 + 20 + 10 + 4 + 3 + 2 + 2 + 1,
			fill: MORE_FILL,
			group: MORE_ID
		});
	});
	it('has no "more" tile on the last band', () => {
		const { band, tiles, rest } = bandOf(items(values), 2, more);
		expect(band).toEqual({ index: 2, count: 2, first: 6, last: 15 });
		expect(rest).toBe(0);
		expect(tiles.map((t) => t.value)).toEqual(values.slice(5));
	});
	it('clamps the band asked for to the bands there are', () => {
		expect(bandOf(items(values), 9, more).band.index).toBe(2);
		expect(bandOf(items(values), 0, more).band.index).toBe(1);
		expect(bandOf(items(values), 1.7, more).band.index).toBe(1);
	});
	it('has one empty band for no items', () => {
		expect(bandOf([], 3, more)).toEqual({ band: { index: 1, count: 1, first: 0, last: 0 }, tiles: [], rest: 0 });
	});
	it('uses an id no real name can have', () => {
		expect(MORE_ID).toContain('\u0000');
	});
});
