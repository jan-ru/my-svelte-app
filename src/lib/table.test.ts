import { describe, expect, it } from 'vitest';
import { isNegative } from './table';

describe('isNegative', () => {
	it.each(['-1,234.5', '\u22121.0', '(12.5)', ' -3', '-0.21'])('is true for %s', (cell) => {
		expect(isNegative(cell)).toBe(true);
	});
	it.each(['1,234.5', 'n/a', '', '0.0', '+3.2', '2026-10-01', 'a-b'])('is false for %j', (cell) => {
		expect(isNegative(cell)).toBe(false);
	});
});
