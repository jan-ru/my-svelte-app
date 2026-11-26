import { beforeEach, describe, expect, it, vi } from 'vitest';

type Env = Record<
	| 'GOOGLE_CLIENT_ID'
	| 'GOOGLE_CLIENT_SECRET'
	| 'ALLOWED_EMAILS'
	| 'SESSION_SECRET'
	| 'ISR_BYPASS_TOKEN'
	| 'FMP_API_KEY',
	string | undefined
>;
const env = vi.hoisted((): Env => ({
	GOOGLE_CLIENT_ID: 'id',
	GOOGLE_CLIENT_SECRET: 'cs',
	ALLOWED_EMAILS: 'person@example.test',
	SESSION_SECRET: 's'.repeat(32),
	ISR_BYPASS_TOKEN: 't'.repeat(40),
	FMP_API_KEY: undefined
}));
vi.mock('$app/env/private', () => env);

import { BYPASS_COOKIE, LEGACY_COOKIE_PATH } from '#lib/server/access';
import { SESSION_COOKIE } from '#lib/server/session';
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

const logout = (query: string, cookies: ReturnType<typeof fakeCookies>['cookies']) =>
	(actions.logout as unknown as (e: unknown) => unknown)({ cookies, url: new URL(`http://x.test/login${query}`) });

beforeEach(() => {
	env.GOOGLE_CLIENT_ID = 'id';
	env.GOOGLE_CLIENT_SECRET = 'cs';
	env.ALLOWED_EMAILS = 'person@example.test';
	env.SESSION_SECRET = 's'.repeat(32);
	env.ISR_BYPASS_TOKEN = 't'.repeat(40);
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

	it('falls back to the home page for an unknown from', async () => {
		const r = await redirected(() => logout('?/logout&from=https%3A%2F%2Fevil.test', fakeCookies().cookies));
		expect(r.location).toBe('/');
	});
});

describe('load', () => {
	const run = (query: string, locals: { authed: boolean; interactive: boolean }, cookies = fakeCookies().cookies) => {
		const setHeaders = vi.fn();
		return {
			setHeaders,
			result: () =>
				load({
					locals,
					url: new URL(`http://x.test/login${query}`),
					setHeaders,
					cookies
				} as unknown as Parameters<typeof load>[0])
		};
	};

	it('is private and uncached, and offers the sign-in with an allow-listed from', () => {
		const { setHeaders, result } = run('?from=%2Ffinancials', { authed: false, interactive: false });
		expect(result()).toEqual({ configured: true, from: '/financials', error: null });
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});

	it('drops a from outside the allow-list, passes a known error and says when sign-in is not configured', () => {
		env.ALLOWED_EMAILS = undefined;
		expect(run('?from=https%3A%2F%2Fevil.test&error=denied', { authed: false, interactive: false }).result()).toEqual({
			configured: false,
			from: null,
			error: 'denied'
		});
	});

	it('ignores an unknown error', () => {
		expect(run('?error=<script>', { authed: false, interactive: false }).result()).toMatchObject({ error: null });
	});

	it('gives a logged-in browser without the bypass cookie its cookie back and returns it to from', async () => {
		const c = fakeCookies();
		const r = await redirected(run('?from=%2Fcompanies', { authed: true, interactive: false }, c.cookies).result);
		expect(r).toEqual({ status: 303, location: '/companies' });
		expect(c.sets).toHaveLength(1);
		expect(c.sets[0]).toMatchObject({
			name: BYPASS_COOKIE,
			value: 't'.repeat(40),
			options: { path: '/', httpOnly: true }
		});
	});

	it('sends a logged-in browser home without a usable from', async () => {
		const r = await redirected(run('?from=https%3A%2F%2Fevil.test', { authed: true, interactive: true }).result);
		expect(r.location).toBe('/');
	});

	it.each([
		['already interactive', { authed: true, interactive: true }, 't'.repeat(40)],
		['no usable token', { authed: true, interactive: true }, undefined]
	])('sets no cookie when %s', async (_name, locals, token) => {
		env.ISR_BYPASS_TOKEN = token;
		const c = fakeCookies();
		await redirected(run('?from=%2Fcompanies', locals, c.cookies).result);
		expect(c.sets).toEqual([]);
	});
});
