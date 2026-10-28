import { describe, expect, it } from 'vitest';
import { fit, squarify } from './size-treemap';

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
		expect(squarify(items, 600, 400)[0].id).toMatch(/^[ab]$/);
	});
	it('handles one item, zero and negative values, and an empty input', () => {
		expect(squarify([{ id: 'x', label: 'X', value: 5 }], 100, 50)).toEqual([{ id: 'x', x: 0, y: 0, w: 100, h: 50 }]);
		expect(squarify([{ id: 'x', label: 'X', value: 0 }, { id: 'y', label: 'Y', value: -3 }], 100, 50)).toEqual([]);
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
