import { beforeEach, describe, expect, it, vi } from 'vitest';

type Env = Record<'SITE_PASSWORD' | 'SESSION_SECRET' | 'ISR_BYPASS_TOKEN' | 'FMP_API_KEY', string | undefined>;
const env = vi.hoisted((): Env => ({
	SITE_PASSWORD: 'pw',
	SESSION_SECRET: 's'.repeat(32),
	ISR_BYPASS_TOKEN: 't'.repeat(40),
	FMP_API_KEY: undefined
}));
vi.mock('$app/env/private', () => env);
vi.mock('#lib/server/financials', () => ({ loadFinancials: vi.fn(async () => ({ kind: 'stub' })) }));

import { BYPASS_COOKIE, LEGACY_COOKIE_PATH } from '#lib/server/access';
import { SESSION_COOKIE } from '#lib/server/auth';
import { actions, load } from './+page.server';

type Call = { name: string; value?: string; options: Record<string, unknown> };
function fakeCookies() {
	const sets: Call[] = [];
	const deletes: Call[] = [];
	return {
		sets,
		deletes,
		cookies: {
			set: (name: string, value: string, options: Record<string, unknown>) => sets.push({ name, value, options }),
			delete: (name: string, options: Record<string, unknown>) => deletes.push({ name, options })
		}
	};
}

async function redirected(run: () => unknown): Promise<{ status: number; location: string }> {
	try {
		await run();
	} catch (e) {
		const r = e as { status?: number; location?: string };
		if (typeof r.status === 'number' && typeof r.location === 'string')
			return { status: r.status, location: r.location };
		throw e;
	}
	throw new Error('expected a redirect');
}

let ip = 0;
const login = (query: string, password: string, cookies: ReturnType<typeof fakeCookies>['cookies']) =>
	(actions.login as unknown as (e: unknown) => unknown)({
		request: new Request('http://x.test/financials?/login', {
			method: 'POST',
			body: new URLSearchParams({ password })
		}),
		cookies,
		// each test gets its own address so the rate limiter never interferes
		getClientAddress: () => `10.0.0.${++ip}`,
		url: new URL(`http://x.test/financials${query}`)
	});
const logout = (query: string, cookies: ReturnType<typeof fakeCookies>['cookies']) =>
	(actions.logout as unknown as (e: unknown) => unknown)({ cookies, url: new URL(`http://x.test/financials${query}`) });

beforeEach(() => {
	env.SITE_PASSWORD = 'pw';
	env.SESSION_SECRET = 's'.repeat(32);
	env.ISR_BYPASS_TOKEN = 't'.repeat(40);
});

describe('login action', () => {
	it('sets the site-wide session cookie and the bypass cookie, and clears the legacy-path cookie', async () => {
		const c = fakeCookies();
		const r = await redirected(() => login('?/login&from=%2Fcompanies', 'pw', c.cookies));
		expect(r).toEqual({ status: 303, location: '/companies' });
		const session = c.sets.find((s) => s.name === SESSION_COOKIE);
		expect(session?.options).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
		const bypass = c.sets.find((s) => s.name === BYPASS_COOKIE);
		expect(bypass?.value).toBe('t'.repeat(40));
		expect(bypass?.options).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
		expect(c.deletes).toEqual([{ name: SESSION_COOKIE, options: { path: LEGACY_COOKIE_PATH } }]);
	});

	it.each([undefined, 'short'])('sets no bypass cookie without a usable token (%s)', async (token) => {
		env.ISR_BYPASS_TOKEN = token;
		const c = fakeCookies();
		await redirected(() => login('?/login', 'pw', c.cookies));
		expect(c.sets.map((s) => s.name)).toEqual([SESSION_COOKIE]);
	});

	it('only honours an allow-listed from', async () => {
		const ok = await redirected(() => login('?/login&from=%2Fabout', 'pw', fakeCookies().cookies));
		expect(ok.location).toBe('/about');
		for (const from of ['https%3A%2F%2Fevil.test', '%2F%2Fevil.test', '%2Fcompanies%3Fx%3D1']) {
			const r = await redirected(() => login(`?/login&from=${from}`, 'pw', fakeCookies().cookies));
			expect(r.location).toBe('/financials');
		}
	});

	it('sets nothing for a wrong password', async () => {
		const c = fakeCookies();
		const result = (await login('?/login', 'nope', c.cookies)) as { status: number };
		expect(result.status).toBe(401);
		expect(c.sets).toEqual([]);
	});

	it('fails closed when the password or secret is not configured', async () => {
		env.SESSION_SECRET = undefined;
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const c = fakeCookies();
		expect(((await login('?/login', 'pw', c.cookies)) as { status: number }).status).toBe(503);
		expect(c.sets).toEqual([]);
		spy.mockRestore();
	});
});

describe('logout action', () => {
	it('deletes the session at both paths and the bypass cookie, then returns to an allow-listed from', async () => {
		const c = fakeCookies();
		const r = await redirected(() => logout('?/logout&from=%2Fcompanies', c.cookies));
		expect(r).toEqual({ status: 303, location: '/companies' });
		expect(c.deletes).toEqual([
			{ name: SESSION_COOKIE, options: { path: '/' } },
			{ name: SESSION_COOKIE, options: { path: LEGACY_COOKIE_PATH } },
			{ name: BYPASS_COOKIE, options: { path: '/' } }
		]);
	});

	it('falls back to /financials for an unknown from', async () => {
		const r = await redirected(() => logout('?/logout&from=https%3A%2F%2Fevil.test', fakeCookies().cookies));
		expect(r.location).toBe('/financials');
	});
});

describe('load', () => {
	const run = (query: string, locals: { authed: boolean; interactive: boolean }, cookies = fakeCookies().cookies) => {
		const setHeaders = vi.fn();
		return {
			setHeaders,
			result: load({
				locals,
				url: new URL(`http://x.test/financials${query}`),
				setHeaders,
				cookies
			} as unknown as Parameters<typeof load>[0])
		};
	};

	it('is private and uncached', async () => {
		const { setHeaders, result } = run('', { authed: false, interactive: false });
		await result;
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});

	it('gives a logged-in browser without the bypass cookie its cookie back and returns it to an allow-listed from (M1)', async () => {
		const c = fakeCookies();
		const r = await redirected(() => run('?from=%2Fcompanies', { authed: true, interactive: false }, c.cookies).result);
		expect(r).toEqual({ status: 303, location: '/companies' });
		expect(c.sets).toHaveLength(1);
		expect(c.sets[0]).toMatchObject({
			name: BYPASS_COOKIE,
			value: 't'.repeat(40),
			options: { path: '/', httpOnly: true }
		});
	});

	it('sets the cookie but stays on the page without a from (M1)', async () => {
		const c = fakeCookies();
		const data = (await run('', { authed: true, interactive: false }, c.cookies).result) as { from: unknown };
		expect(c.sets.map((s) => s.name)).toEqual([BYPASS_COOKIE]);
		expect(data.from).toBeNull();
	});

	it('does not redirect to a from outside the allow-list (M1)', async () => {
		const c = fakeCookies();
		await run('?from=https%3A%2F%2Fevil.test', { authed: true, interactive: false }, c.cookies).result;
		expect(c.sets.map((s) => s.name)).toEqual([BYPASS_COOKIE]);
	});

	it.each([
		['already interactive', { authed: true, interactive: true }, 't'.repeat(40)],
		['not logged in', { authed: false, interactive: false }, 't'.repeat(40)],
		['no usable token', { authed: true, interactive: true }, undefined]
	])('sets no cookie when %s', async (_name, locals, token) => {
		env.ISR_BYPASS_TOKEN = token;
		const c = fakeCookies();
		await run('?from=%2Fcompanies', locals, c.cookies).result;
		expect(c.sets).toEqual([]);
	});
});
