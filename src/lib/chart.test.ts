import { describe, expect, it } from 'vitest';
import { LOW_FIRMS_THRESHOLD, PALETTE, formatMultiple, monthTicks, niceTicks, priceTicks } from './chart';

describe('niceTicks', () => {
	it('rounds a positive range up to round steps', () => {
		expect(niceTicks(0, 18.4)).toEqual({ ticks: [0, 5, 10, 15, 20], min: 0, max: 20 });
	});

	it('copes with a large maximum', () => {
		expect(niceTicks(0, 132)).toEqual({ ticks: [0, 50, 100, 150], min: 0, max: 150 });
	});

	it('uses 2-steps for small ranges', () => {
		expect(niceTicks(0, 7.2)).toEqual({ ticks: [0, 2, 4, 6, 8], min: 0, max: 8 });
	});

	it('extends below zero for negative values', () => {
		expect(niceTicks(-3, 12)).toEqual({ ticks: [-5, 0, 5, 10, 15], min: -5, max: 15 });
	});

	it('always includes zero', () => {
		const { min, max } = niceTicks(40, 90);
		expect(min).toBe(0);
		expect(max).toBeGreaterThanOrEqual(90);
	});

	it('returns a usable range when everything is zero', () => {
		expect(niceTicks(0, 0)).toEqual({ ticks: [0, 1], min: 0, max: 1 });
	});
});

describe('formatMultiple', () => {
	it('formats with one decimal and an x', () => {
		expect(formatMultiple(18.44)).toBe('18.4x');
		expect(formatMultiple(0)).toBe('0.0x');
	});

	it('shows n/a for missing values', () => {
		expect(formatMultiple(null)).toBe('n/a');
	});
});

describe('constants', () => {
	it('has a colour for each of the 4 series and a small-sample threshold of 10', () => {
		expect(PALETTE).toHaveLength(4);
		expect(LOW_FIRMS_THRESHOLD).toBe(10);
	});
});

describe('priceTicks', () => {
	it('pads the range and does not force 0', () => {
		expect(priceTicks(180, 230)).toEqual({ ticks: [160, 180, 200, 220, 240], min: 160, max: 240 });
	});
	it('covers the data', () => {
		const { min, max } = priceTicks(33.3, 47.9);
		expect(min).toBeLessThanOrEqual(33.3);
		expect(max).toBeGreaterThanOrEqual(47.9);
		expect(min).toBeGreaterThan(0);
	});
	it('handles a flat series', () => {
		const { ticks, min, max } = priceTicks(100, 100);
		expect(min).toBeLessThan(100);
		expect(max).toBeGreaterThan(100);
		expect(ticks.length).toBeGreaterThanOrEqual(2);
	});
	it('never goes below zero for non-negative data', () => {
		expect(priceTicks(0.2, 1).min).toBeGreaterThanOrEqual(0);
		expect(priceTicks(0, 0).min).toBeGreaterThanOrEqual(0);
		expect(priceTicks(0, 0).max).toBeGreaterThan(0);
	});
});

describe('monthTicks', () => {
	const days = (start: string, count: number) =>
		Array.from({ length: count }, (_, i) => ({
			date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10)
		}));

	it('returns [] for no points', () => {
		expect(monthTicks([])).toEqual([]);
	});
	it('marks the first point of each month and adds the year to the first and to January', () => {
		const points = [
			{ date: '2025-12-30' },
			{ date: '2026-01-02' },
			{ date: '2026-01-05' },
			{ date: '2026-02-02' },
			{ date: '2026-02-03' },
			{ date: '2026-03-02' }
		];
		expect(monthTicks(points)).toEqual([
			{ index: 0, label: "Dec '25" },
			{ index: 1, label: "Jan '26" },
			{ index: 3, label: 'Feb' },
			{ index: 5, label: 'Mar' }
		]);
	});
	it('drops a first label that would sit right next to the second', () => {
		const ticks = monthTicks(days('2025-10-28', 365));
		expect(ticks[0].label).toBe("Nov '25");
		expect(ticks).toHaveLength(12);
	});
	it('keeps a first label that has room', () => {
		const ticks = monthTicks(days('2025-10-01', 200));
		expect(ticks[0]).toEqual({ index: 0, label: "Oct '25" });
	});
	it('thins long series to at most 12 labels', () => {
		const ticks = monthTicks(days('2023-01-01', 1095));
		expect(ticks.length).toBeLessThanOrEqual(12);
		expect(ticks.length).toBeGreaterThan(2);
	});
});
