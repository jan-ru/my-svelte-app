import { describe, expect, it } from 'vitest';
import { formatPrice, formatSigned, formatVolume, oneYearWindow, summarise } from './prices';

const p = (date: string, close: number, volume: number | null = null) => ({ date, close, volume });

describe('summarise', () => {
	it('returns null for no points', () => {
		expect(summarise([])).toBeNull();
	});
	it('computes last close, day change and the range of closes', () => {
		const s = summarise([
			p('2026-10-20', 100, 5),
			p('2026-10-21', 120, 6),
			p('2026-10-22', 80, 7),
			p('2026-10-23', 90, 8)
		])!;
		expect(s.date).toBe('2026-10-23');
		expect(s.close).toBe(90);
		expect(s.change).toBe(10);
		expect(s.changePct).toBeCloseTo(12.5, 10);
		expect(s.high).toBe(120);
		expect(s.low).toBe(80);
		expect(s.volume).toBe(8);
	});
	it('has no change for a single point', () => {
		expect(summarise([p('2026-10-23', 50)])).toEqual({
			date: '2026-10-23',
			close: 50,
			change: null,
			changePct: null,
			high: 50,
			low: 50,
			volume: null
		});
	});
	it('has no percent when the previous close is zero', () => {
		const s = summarise([p('2026-10-22', 0), p('2026-10-23', 3)])!;
		expect(s.change).toBe(3);
		expect(s.changePct).toBeNull();
	});
});

describe('oneYearWindow', () => {
	it('spans exactly one year back, in UTC', () => {
		expect(oneYearWindow(new Date('2026-10-26T12:00:00Z'))).toEqual({ from: '2025-10-26', to: '2026-10-26' });
	});
	it('crosses a year boundary', () => {
		expect(oneYearWindow(new Date('2026-01-01T00:00:00Z'))).toEqual({ from: '2025-01-01', to: '2026-01-01' });
	});
	it('maps 29 February to 28 February of the previous year', () => {
		expect(oneYearWindow(new Date('2028-02-29T10:00:00Z'))).toEqual({ from: '2027-02-28', to: '2028-02-29' });
	});
	it('keeps 1 March after a leap day', () => {
		expect(oneYearWindow(new Date('2028-03-01T10:00:00Z'))).toEqual({ from: '2027-03-01', to: '2028-03-01' });
	});
});

describe('formatting', () => {
	it('formats prices with two decimals and thousands separators', () => {
		expect(formatPrice(189.5)).toBe('189.50');
		expect(formatPrice(12345.678)).toBe('12,345.68');
	});
	it('signs changes', () => {
		expect(formatSigned(1.234)).toBe('+1.23');
		expect(formatSigned(-0.5)).toBe('-0.50');
		expect(formatSigned(0)).toBe('0.00');
	});
	it('formats volume as a whole number', () => {
		expect(formatVolume(1_234_567.4)).toBe('1,234,567');
	});
});
