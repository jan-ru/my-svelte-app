import { describe, expect, it } from 'vitest';
import { LOW_FIRMS_THRESHOLD, PALETTE, formatMultiple, niceTicks } from './chart';

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
