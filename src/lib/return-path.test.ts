import { describe, expect, it } from 'vitest';
import { MAX_RETURN_LENGTH, RETURN_PATHS, loginHref, logoutAction, returnPath } from './return-path';

describe('returnPath', () => {
	it('accepts exactly the allow-listed local pages', () => {
		for (const p of RETURN_PATHS) expect(returnPath(p)).toBe(p);
	});
	it('keeps the query string of an allow-listed page', () => {
		expect(returnPath('/companies?q=bank&page=2')).toBe('/companies?q=bank&page=2');
		expect(returnPath('/financials?symbol=AAPL&tab=news')).toBe('/financials?symbol=AAPL&tab=news');
	});
	it('drops a fragment', () => {
		expect(returnPath('/about#sources')).toBe('/about');
	});
	it('rejects everything else', () => {
		for (const bad of [
			'//evil.com',
			'/\\evil.com',
			'https://evil.com',
			'https://evil.com/companies',
			'/financials/x',
			'/login',
			'/companies/../login',
			'',
			'companies',
			'?x=1',
			`/companies?q=${'x'.repeat(MAX_RETURN_LENGTH)}`,
			null,
			undefined
		]) {
			expect(returnPath(bad)).toBeNull();
		}
	});
});

describe('loginHref and logoutAction', () => {
	it('carry an allow-listed page back', () => {
		expect(loginHref('/companies?q=bank')).toBe('/login?from=%2Fcompanies%3Fq%3Dbank');
		expect(logoutAction('/about')).toBe('/login?/logout&from=%2Fabout');
	});
	it('leave out anything else', () => {
		expect(loginHref('https://evil.com')).toBe('/login');
		expect(loginHref(null)).toBe('/login');
		expect(logoutAction('/login')).toBe('/login?/logout');
	});
});
