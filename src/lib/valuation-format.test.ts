import { describe, expect, it } from 'vitest';
import { formatAmount, scaleFor } from './valuation-format';

describe('scaleFor', () => {
	it('picks millions, thousands or units from the largest absolute value', () => {
		expect(scaleFor([1, -2.5e7, null])).toEqual({ divisor: 1e6, label: 'millions' });
		expect(scaleFor([123_503, undefined])).toEqual({ divisor: 1e3, label: 'thousands' });
		expect(scaleFor([999, Number.NaN])).toEqual({ divisor: 1, label: 'units' });
		expect(scaleFor([])).toEqual({ divisor: 1, label: 'units' });
	});
});

describe('formatAmount', () => {
	const millions = scaleFor([1e8]);
	const thousands = scaleFor([1e5]);
	it('formats in the scale with negatives in brackets', () => {
		expect(formatAmount(123_456_789, millions)).toBe('123.5');
		expect(formatAmount(-39_781, thousands)).toBe('(40)');
		expect(formatAmount(-1, millions)).toBe('0.0');
	});
	it('shows n/a for a missing value', () => {
		expect(formatAmount(null, millions)).toBe('n/a');
		expect(formatAmount(undefined, millions)).toBe('n/a');
		expect(formatAmount(Number.POSITIVE_INFINITY, millions)).toBe('n/a');
	});
});
