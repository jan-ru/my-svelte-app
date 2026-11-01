import { describe, expect, it } from 'vitest';
import { navHref, parseNav } from './financials-nav';
import { returnPath } from './return-path';

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
		for (const tab of ['ratios', 'estimates', 'earnings', 'peers']) expect(parseNav(q(`tab=${tab}`)).tab).toBe(tab);
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

describe('login round trip', () => {
	it('keeps the ticker and page state through the login page', () => {
		const href = navHref({ tab: 'news', statement: 'income', period: 'annual', source: 'yahoo' }, 'AAPL');
		expect(returnPath(href)).toBe(href);
	});
});

describe('source parameter', () => {
	it('is absent from the nav unless a valid source is given', () => {
		expect(parseNav(q(''))).toEqual({ tab: 'financials', statement: 'income', period: 'annual' });
		expect('source' in parseNav(q('source=bloomberg'))).toBe(false);
		expect(parseNav(q('source=yahoo')).source).toBe('yahoo');
	});
	it('is written to the href only when present, after the period', () => {
		const nav = { tab: 'price', statement: 'income', period: 'annual' } as const;
		expect(navHref(nav, 'AAPL')).toBe('/financials?symbol=AAPL&tab=price&statement=income&period=annual');
		expect(navHref({ ...nav, source: 'yahoo' }, 'AAPL')).toBe(
			'/financials?symbol=AAPL&tab=price&statement=income&period=annual&source=yahoo'
		);
	});
});
