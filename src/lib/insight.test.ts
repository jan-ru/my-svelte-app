import { describe, expect, it } from 'vitest';
import { describeUpside, formatPrice, qualityRows, type QualityScore } from './insight';

/** Intl joins the code and the number with a no-break space, so the price never wraps between them. */
const plain = (text: string): string => text.replaceAll('\u00a0', ' ');

describe('formatPrice', () => {
	it('shows two decimals with the currency code', () => {
		expect(plain(formatPrice(278.517, 'USD'))).toBe('USD 278.52');
		expect(plain(formatPrice(1342.11, 'EUR'))).toBe('EUR 1,342.11');
	});
	it('falls back to a plain number for a missing or unknown currency', () => {
		expect(formatPrice(14.598, null)).toBe('14.60');
		expect(formatPrice(14.598, 'not a code')).toBe('14.60');
	});
	it('says n/a without a value', () => {
		expect(formatPrice(null, 'USD')).toBe('n/a');
	});
});

describe('describeUpside', () => {
	it('says in words which side of fair value the price is on, so the sign is not the only cue', () => {
		expect(describeUpside(4.56)).toBe('+4.6% (price below fair value)');
		expect(describeUpside(-18.66)).toBe('−18.7% (price above fair value)');
		expect(describeUpside(0)).toBe('0.0% (at fair value)');
		expect(describeUpside(null)).toBe('n/a');
	});
});

describe('qualityRows', () => {
	const quality: QualityScore = {
		score: 8,
		revenueGrowth10Y: 0.0594,
		revenueGrowth3Y: 0.0181,
		ebitGrowth10Y: 0.0645,
		ebitGrowth3Y: 0.0366,
		profitContinuity10Y: 10,
		netDebtToEbit: -2.046,
		ebitMaxDrawdown10Y: -0.1573,
		returnOnEquity: 1.519,
		roce: 0.6872,
		expectedReturn: 0.1507
	};
	it('labels and formats every figure behind the score', () => {
		const rows = Object.fromEntries(qualityRows(quality).map((r) => [r.label, r.value]));
		expect(rows['Revenue growth a year, last 10 years']).toBe('5.9%');
		expect(rows['Profitable years of the last 10']).toBe('10');
		expect(rows['Net debt to EBIT']).toBe('-2.0×');
		expect(rows['Worst EBIT drawdown, last 10 years']).toBe('-15.7%');
		expect(rows['Return on equity']).toBe('151.9%');
		expect(qualityRows(quality)).toHaveLength(10);
	});
	it('says n/a for a figure Eulerpool left out', () => {
		const rows = qualityRows({ ...quality, roce: null, profitContinuity10Y: null, netDebtToEbit: null });
		expect(rows.filter((r) => r.value === 'n/a')).toHaveLength(3);
	});
});
