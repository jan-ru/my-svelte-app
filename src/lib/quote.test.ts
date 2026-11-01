import { describe, expect, it } from 'vitest';
import { quoteLink } from './quote';

describe('quoteLink', () => {
	it('prefers Yahoo Finance', () => {
		expect(quoteLink('ENXTAM:ABN')).toEqual({
			url: 'https://finance.yahoo.com/quote/ABN.AS',
			source: 'YF',
			search: false
		});
	});
	it('uses Google Finance where Yahoo has no listing', () => {
		expect(quoteLink('BSE:523395', '3M India Limited (BSE:523395)')).toEqual({
			url: 'https://www.google.com/finance/quote/523395:BOM',
			source: 'GF',
			search: false
		});
		expect(quoteLink('KLSE:3REN')?.url).toBe('https://www.google.com/finance/quote/3REN:KLSE');
	});
	it('falls back to a Yahoo search, flagged as a search', () => {
		expect(quoteLink('PSE:AEV')).toEqual({
			url: 'https://finance.yahoo.com/lookup?s=AEV',
			source: 'YF',
			search: true
		});
	});
	it('returns null without a ticker', () => {
		expect(quoteLink('-')).toBeNull();
		expect(quoteLink('')).toBeNull();
	});
});
