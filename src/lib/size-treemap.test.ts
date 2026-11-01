import { describe, expect, it } from 'vitest';
import { fit, nest, squarify, wrap } from './size-treemap';

const area = (r: { w: number; h: number }) => r.w * r.h;
const items = [
	{ id: 'a', label: 'A', value: 6 },
	{ id: 'b', label: 'B', value: 6 },
	{ id: 'c', label: 'C', value: 4 },
	{ id: 'd', label: 'D', value: 3 },
	{ id: 'e', label: 'E', value: 2 },
	{ id: 'f', label: 'F', value: 2 },
	{ id: 'g', label: 'G', value: 1 }
];

describe('squarify', () => {
	it('fills the rectangle and gives each item an area proportional to its value', () => {
		const rects = squarify(items, 600, 400);
		expect(rects.reduce((s, r) => s + area(r), 0)).toBeCloseTo(600 * 400, 6);
		const total = items.reduce((s, i) => s + i.value, 0);
		for (const r of rects) {
			const v = items.find((i) => i.id === r.id)!.value;
			expect(area(r)).toBeCloseTo((600 * 400 * v) / total, 6);
		}
	});
	it('keeps every rectangle inside the bounds and never overlaps two', () => {
		const rects = squarify(items, 600, 400);
		for (const r of rects) {
			expect(r.x).toBeGreaterThanOrEqual(-1e-9);
			expect(r.y).toBeGreaterThanOrEqual(-1e-9);
			expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-9);
			expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-9);
		}
		for (const a of rects) {
			for (const b of rects) {
				if (a === b) continue;
				const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
				const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
				expect(ox > 1e-6 && oy > 1e-6).toBe(false);
			}
		}
	});
	it('puts the largest item first', () => {
		expect(squarify(items, 600, 400)[0]?.id).toMatch(/^[ab]$/);
	});
	it('handles one item, zero and negative values, and an empty input', () => {
		expect(squarify([{ id: 'x', value: 5 }], 100, 50)).toEqual([{ id: 'x', x: 0, y: 0, w: 100, h: 50 }]);
		expect(
			squarify(
				[
					{ id: 'x', value: 0 },
					{ id: 'y', value: -3 }
				],
				100,
				50
			)
		).toEqual([]);
		expect(squarify([], 100, 50)).toEqual([]);
		expect(squarify(items, 0, 50)).toEqual([]);
	});
});

describe('fit', () => {
	it('keeps a label that fits, shortens one that does not, and drops it when there is no room', () => {
		expect(fit('Japan', 200)).toBe('Japan');
		expect(fit('Information Technology', 80)).toMatch(/…$/);
		expect(fit('Information Technology', 80).length).toBeLessThan('Information Technology'.length);
		expect(fit('Japan', 20)).toBe('');
	});
});

describe('wrap', () => {
	it('breaks on spaces, caps the lines with an ellipsis, and returns nothing when there is no room', () => {
		expect(wrap('Machinery', 100, 2)).toEqual(['Machinery']);
		expect(wrap('Software (System & Application)', 96, 2)).toEqual(['Software', '(System &…']);
		expect(wrap('Metals & Mining', 80, 2)).toEqual(['Metals &', 'Mining']);
		expect(wrap('Electronics', 40, 2).every((l) => l.length <= 5)).toBe(true);
		expect(wrap('Japan', 20, 2)).toEqual([]);
		expect(wrap('Japan', 100, 0)).toEqual([]);
	});
});

describe('nest', () => {
	const items = [
		{ id: 'a', value: 30, group: 'X' },
		{ id: 'b', value: 10, group: 'X' },
		{ id: 'c', value: 40, group: 'Y' },
		{ id: 'd', value: 20, group: 'Y' }
	];
	const { groups, tiles } = nest(items, 400, 200, 18, 2);
	it('sizes the groups by their totals and covers the canvas', () => {
		expect(groups).toHaveLength(2);
		const area = (g: { w: number; h: number }) => g.w * g.h;
		const x = groups.find((g) => g.id === 'X')!;
		const y = groups.find((g) => g.id === 'Y')!;
		expect(area(y) / area(x)).toBeCloseTo(60 / 40, 6);
		expect(x.value).toBe(40);
		expect(area(x) + area(y)).toBeCloseTo(400 * 200, 6);
	});
	it('puts every tile inside its group, below the header strip', () => {
		expect(tiles).toHaveLength(4);
		for (const t of tiles) {
			const g = groups.find((gr) => gr.id === items.find((i) => i.id === t.id)!.group)!;
			expect(t.x).toBeGreaterThanOrEqual(g.x - 1e-9);
			expect(t.y).toBeGreaterThanOrEqual(g.y + 18 - 1e-9);
			expect(t.x + t.w).toBeLessThanOrEqual(g.x + g.w + 1e-9);
			expect(t.y + t.h).toBeLessThanOrEqual(g.y + g.h + 1e-9);
		}
	});
	it('keeps the tile areas in proportion to the values inside a group', () => {
		const area = (id: string) => tiles.find((t) => t.id === id)!.w * tiles.find((t) => t.id === id)!.h;
		expect(area('a') / area('b')).toBeCloseTo(3, 6);
	});
	it('drops the tiles of a group that is too small for them but keeps its block', () => {
		const r = nest(
			[
				{ id: 'a', value: 1000, group: 'X' },
				{ id: 'b', value: 1, group: 'Y' }
			],
			100,
			100,
			18,
			2
		);
		expect(r.groups).toHaveLength(2);
		expect(r.tiles.map((t) => t.id)).toEqual(['a']);
	});
});
