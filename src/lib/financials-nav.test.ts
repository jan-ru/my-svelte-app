import { describe, expect, it } from 'vitest';
import { afterLogin, loginAction, navHref, parseNav } from './financials-nav';

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

describe('login round trip', () => {
	const nav = { tab: 'price', statement: 'balance', period: 'ttm' } as const;
	it('puts the page state on the login action, after the action name', () => {
		expect(loginAction(nav, 'AAPL')).toBe('?/login&symbol=AAPL&tab=price&statement=balance&period=ttm');
	});
	it('keeps the plain action when there is no ticker', () => {
		expect(loginAction(nav, '')).toBe('?/login');
	});
	it('sends the visitor back to the ticker they asked for', () => {
		expect(afterLogin(q('symbol=aapl&tab=news'))).toBe('/financials?symbol=AAPL&tab=news&statement=income&period=annual');
	});
	it('goes to the plain page without a usable ticker', () => {
		expect(afterLogin(q(''))).toBe('/financials');
		expect(afterLogin(q('symbol=A%26B&tab=news'))).toBe('/financials');
	});
	it('only ever redirects to a local /financials path', () => {
		expect(afterLogin(q('symbol=//evil.com&next=https://evil.com'))).toBe('/financials');
		expect(afterLogin(q('symbol=X&tab=//evil.com')).startsWith('/financials?')).toBe(true);
	});
});
