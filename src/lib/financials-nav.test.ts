import { describe, expect, it } from 'vitest';
import { navHref, parseNav } from './financials-nav';

const q = (s: string) => new URLSearchParams(s);

describe('parseNav', () => {
	it('defaults to financials / income / annual', () => {
		expect(parseNav(q(''))).toEqual({ tab: 'financials', statement: 'income', period: 'annual' });
	});
	it('accepts every valid value', () => {
		expect(parseNav(q('tab=price&statement=cashflow&period=ttm'))).toEqual({
			tab: 'price',
			statement: 'cashflow',
			period: 'ttm'
		});
		expect(parseNav(q('tab=news')).tab).toBe('news');
		expect(parseNav(q('tab=company')).tab).toBe('company');
		expect(parseNav(q('statement=balance')).statement).toBe('balance');
	});
	it('falls back to the default for unknown values', () => {
		expect(parseNav(q('tab=nope&statement=x&period=quarterly'))).toEqual({
			tab: 'financials',
			statement: 'income',
			period: 'annual'
		});
	});
});

describe('navHref', () => {
	const nav = { tab: 'financials', statement: 'balance', period: 'ttm' } as const;
	it('keeps the symbol and all three choices', () => {
		expect(navHref(nav, 'AAPL')).toBe('/financials?symbol=AAPL&tab=financials&statement=balance&period=ttm');
	});
	it('omits an empty symbol', () => {
		expect(navHref(nav, '')).toBe('/financials?tab=financials&statement=balance&period=ttm');
	});
	it('round-trips through parseNav', () => {
		const url = new URL(navHref(nav, 'BRK-B'), 'http://x');
		expect(parseNav(url.searchParams)).toEqual(nav);
		expect(url.searchParams.get('symbol')).toBe('BRK-B');
	});
});
