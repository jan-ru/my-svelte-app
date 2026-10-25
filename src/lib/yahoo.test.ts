import { describe, expect, it } from 'vitest';
import { yahooQuote, yahooSearch } from './yahoo';

const quote = (s: string) => `https://finance.yahoo.com/quote/${s}`;

describe('yahooQuote', () => {
	it('adds the Yahoo suffix for the exchange', () => {
		expect(yahooQuote('ENXTAM:ABN')).toBe(quote('ABN.AS'));
		expect(yahooQuote('TSE:8411')).toBe(quote('8411.T'));
	});
	it('uses the bare symbol on US exchanges and a dash for share classes', () => {
		expect(yahooQuote('NasdaqGS:AAPL')).toBe(quote('AAPL'));
		expect(yahooQuote('NYSE:BRK.A')).toBe(quote('BRK-A'));
	});
	it('pads Hong Kong codes to four digits', () => {
		expect(yahooQuote('SEHK:700')).toBe(quote('0700.HK'));
	});
	it('drops the leading A from Korean codes', () => {
		expect(yahooQuote('KOSDAQ:A366030')).toBe(quote('366030.KQ'));
		expect(yahooQuote('KOSE:A078520')).toBe(quote('078520.KS'));
	});
	it('drops spaces and asterisks from Mexican share classes', () => {
		expect(yahooQuote('BMV:AMX B')).toBe(quote('AMXB.MX'));
		expect(yahooQuote('BMV:ALSEA *')).toBe(quote('ALSEA.MX'));
	});
	it('has no quote page for unmapped exchanges, odd symbols or missing tickers', () => {
		expect(yahooQuote('XSAT:ABC')).toBeNull();
		expect(yahooQuote('PSE:AEV')).toBeNull();
		expect(yahooQuote('BSE:523395')).toBeNull();
		expect(yahooQuote('KOSE:A B')).toBeNull();
		expect(yahooQuote('-')).toBeNull();
	});
});

describe('yahooSearch', () => {
	it('searches for the symbol', () => {
		expect(yahooSearch('KOSE:A B')).toBe('https://finance.yahoo.com/lookup?s=A%20B');
	});
	it('searches numeric BSE scrip codes by company name', () => {
		expect(yahooSearch('BSE:523395', '3M India Limited (BSE:523395)')).toBe(
			'https://finance.yahoo.com/lookup?s=3M%20India%20Limited'
		);
	});
	it('returns null without a symbol', () => {
		expect(yahooSearch('-')).toBeNull();
	});
});
