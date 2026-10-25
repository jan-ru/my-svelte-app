import { describe, expect, it } from 'vitest';
import { yahooUrl } from './yahoo';

const quote = (s: string) => `https://finance.yahoo.com/quote/${s}`;

describe('yahooUrl', () => {
	it('adds the Yahoo suffix for the exchange', () => {
		expect(yahooUrl('ENXTAM:ABN')).toBe(quote('ABN.AS'));
		expect(yahooUrl('TSE:8411')).toBe(quote('8411.T'));
	});
	it('uses the bare symbol on US exchanges and a dash for share classes', () => {
		expect(yahooUrl('NasdaqGS:AAPL')).toBe(quote('AAPL'));
		expect(yahooUrl('NYSE:BRK.A')).toBe(quote('BRK-A'));
	});
	it('pads Hong Kong codes to four digits', () => {
		expect(yahooUrl('SEHK:700')).toBe(quote('0700.HK'));
	});
	it('falls back to a Yahoo lookup for unknown exchanges or odd symbols', () => {
		expect(yahooUrl('XSAT:ABC')).toBe('https://finance.yahoo.com/lookup?s=ABC');
		expect(yahooUrl('KOSE:A B')).toBe('https://finance.yahoo.com/lookup?s=A%20B');
	});
	it('looks up numeric BSE scrip codes by company name', () => {
		expect(yahooUrl('BSE:523395', '3M India Limited (BSE:523395)')).toBe(
			'https://finance.yahoo.com/lookup?s=3M%20India%20Limited'
		);
	});
	it('returns null without a usable ticker', () => {
		expect(yahooUrl('-')).toBeNull();
		expect(yahooUrl('')).toBeNull();
	});
});
