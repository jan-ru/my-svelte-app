import { describe, expect, it } from 'vitest';
import {
	BYPASS_COOKIE,
	ISR_EXPIRATION_SECONDS,
	LEGACY_COOKIE_PATH,
	bypassToken,
	isInteractive,
	isRevalidation,
	isrConfig,
	pageParams,
	sessionCookieOptions
} from './access';

const TOKEN = 'a'.repeat(32);

describe('bypassToken', () => {
	it('needs at least 32 characters', () => {
		expect(bypassToken(TOKEN)).toBe(TOKEN);
		expect(bypassToken('a'.repeat(31))).toBeUndefined();
		expect(bypassToken('')).toBeUndefined();
		expect(bypassToken(undefined)).toBeUndefined();
	});
});

describe('isrConfig', () => {
	it('turns ISR on for a usable token, one day, ignoring query strings', () => {
		expect(isrConfig(TOKEN)).toEqual({ isr: { expiration: ISR_EXPIRATION_SECONDS, bypassToken: TOKEN, allowQuery: [] } });
		expect(ISR_EXPIRATION_SECONDS).toBe(86400);
	});
	it('turns ISR off without a usable token', () => {
		expect(isrConfig(undefined)).toEqual({ isr: false });
		expect(isrConfig('short')).toEqual({ isr: false });
	});
});

describe('isInteractive', () => {
	it('is never true without a session', () => {
		expect(isInteractive(false, TOKEN, TOKEN)).toBe(false);
		expect(isInteractive(false, undefined, undefined)).toBe(false);
	});
	it('needs the matching bypass cookie when the cache is on', () => {
		expect(isInteractive(true, TOKEN, TOKEN)).toBe(true);
		expect(isInteractive(true, undefined, TOKEN)).toBe(false);
		expect(isInteractive(true, 'b'.repeat(32), TOKEN)).toBe(false);
		expect(isInteractive(true, TOKEN.slice(1), TOKEN)).toBe(false);
	});
	it('follows the session alone when the cache is off', () => {
		expect(isInteractive(true, undefined, undefined)).toBe(true);
		expect(isInteractive(true, undefined, 'short')).toBe(true);
	});
});

describe('isRevalidation', () => {
	it('detects the Vercel revalidation header', () => {
		expect(isRevalidation(new Headers({ 'x-prerender-revalidate': TOKEN }))).toBe(true);
		expect(isRevalidation(new Headers())).toBe(false);
	});
});

describe('pageParams', () => {
	const url = new URL('https://x.test/companies?country=Japan&page=3');
	it('hands the real query to interactive requests', () => {
		expect(pageParams(true, url).get('country')).toBe('Japan');
	});
	it('hands an empty query to anonymous requests', () => {
		expect([...pageParams(false, url)]).toEqual([]);
	});
});

describe('cookie constants', () => {
	it('uses the name Vercel looks for, and a site-wide session cookie', () => {
		expect(BYPASS_COOKIE).toBe('__prerender_bypass');
		expect(LEGACY_COOKIE_PATH).toBe('/financials');
		expect(sessionCookieOptions()).toEqual({ path: '/', httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 });
	});
});
