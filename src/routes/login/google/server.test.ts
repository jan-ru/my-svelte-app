// The two routes of the Google sign-in. finishSignIn is replaced: google.test.ts tests it against a fake Google.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Env = Record<
	'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'ALLOWED_EMAILS' | 'SESSION_SECRET' | 'ISR_BYPASS_TOKEN',
	string | undefined
>;
const env = vi.hoisted((): Env => ({
	GOOGLE_CLIENT_ID: 'id',
	GOOGLE_CLIENT_SECRET: 'cs',
	ALLOWED_EMAILS: 'person@example.test',
	SESSION_SECRET: 's'.repeat(32),
	ISR_BYPASS_TOKEN: 't'.repeat(40)
}));
vi.mock('$app/env/private', () => env);
const finish = vi.hoisted(() => vi.fn());
vi.mock('#lib/server/google', async (actual) => ({
	...(await actual<typeof import('#lib/server/google')>()),
	finishSignIn: finish
}));

import { BYPASS_COOKIE, LEGACY_COOKIE_PATH } from '#lib/server/access';
import {
	OAUTH_COOKIE,
	OAUTH_PATH,
	SESSION_COOKIE,
	createOAuthCookie,
	parseAllowed,
	readOAuthCookie,
	verifySession
} from '#lib/server/session';
import { GET as start } from './+server';
import { GET as callback } from './callback/+server';

type Call = { name: string; value?: string; options: Record<string, unknown> };
function fakeCookies(jar: Record<string, string> = {}) {
	const sets: Call[] = [];
	const deletes: Call[] = [];
	return {
		sets,
		deletes,
		cookies: {
			get: (name: string) => jar[name],
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

const event = (path: string, cookies: ReturnType<typeof fakeCookies>['cookies']) => ({
	url: new URL(`https://app.example.test${path}`),
	cookies,
	setHeaders: vi.fn()
});
const call = (handler: unknown, e: unknown) => (handler as (e: unknown) => unknown)(e);

const pending = { state: 'st', nonce: 'no', verifier: 've', from: '/financials?symbol=AAPL' };
const withPending = async () => ({ [OAUTH_COOKIE]: await createOAuthCookie(env.SESSION_SECRET ?? '', pending) });
let logs: string[] = [];

beforeEach(() => {
	Object.assign(env, {
		GOOGLE_CLIENT_ID: 'id',
		GOOGLE_CLIENT_SECRET: 'cs',
		ALLOWED_EMAILS: 'person@example.test',
		SESSION_SECRET: 's'.repeat(32),
		ISR_BYPASS_TOKEN: 't'.repeat(40)
	});
	finish.mockReset();
	logs = [];
	for (const level of ['info', 'warn', 'error', 'log'] as const) {
		vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(' '));
		});
	}
});

describe('GET /login/google', () => {
	it('stores the pending sign-in and sends the browser to Google', async () => {
		const jar = fakeCookies();
		const r = await redirected(() => call(start, event('/login/google?from=%2Ffinancials', jar.cookies)));
		expect(r.status).toBe(303);
		const to = new URL(r.location);
		expect(to.origin).toBe('https://accounts.google.com');
		expect(to.searchParams.get('redirect_uri')).toBe('https://app.example.test/login/google/callback');
		const set = jar.sets.find((c) => c.name === OAUTH_COOKIE);
		expect(set?.options).toMatchObject({ path: OAUTH_PATH, httpOnly: true, sameSite: 'lax', maxAge: 600 });
		const stored = await readOAuthCookie(set?.value, env.SESSION_SECRET ?? '');
		expect(stored?.state).toBe(to.searchParams.get('state'));
		expect(stored?.from).toBe('/financials');
	});
	it('is never cached', async () => {
		const jar = fakeCookies();
		const e = event('/login/google', jar.cookies);
		await redirected(() => call(start, e));
		expect(e.setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});
	it('drops a from outside the allow-list', async () => {
		const jar = fakeCookies();
		await redirected(() => call(start, event('/login/google?from=https%3A%2F%2Fevil.test', jar.cookies)));
		const stored = await readOAuthCookie(jar.sets[0]?.value, env.SESSION_SECRET ?? '');
		expect(stored?.from).toBeNull();
	});
	it('goes back to /login when sign-in is not configured here', async () => {
		env.GOOGLE_CLIENT_ID = undefined;
		const jar = fakeCookies();
		expect(await redirected(() => call(start, event('/login/google', jar.cookies)))).toEqual({
			status: 303,
			location: '/login'
		});
		expect(jar.sets).toEqual([]);
	});
});

describe('GET /login/google/callback', () => {
	const at = '/login/google/callback?code=c&state=st';

	it('is never cached', async () => {
		const jar = fakeCookies();
		const e = event(at, jar.cookies);
		await redirected(() => call(callback, e));
		expect(e.setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});
	it('logs in an address on the list and returns to from', async () => {
		finish.mockResolvedValue({ ok: true, email: 'person@example.test' });
		const jar = fakeCookies(await withPending());
		const r = await redirected(() => call(callback, event(at, jar.cookies)));
		expect(r).toEqual({ status: 303, location: '/financials?symbol=AAPL' });
		const session = jar.sets.find((c) => c.name === SESSION_COOKIE);
		expect(await verifySession(session?.value, env.SESSION_SECRET ?? '', parseAllowed(env.ALLOWED_EMAILS))).toBe(
			'person@example.test'
		);
		expect(session?.options).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
		expect(jar.sets.find((c) => c.name === BYPASS_COOKIE)?.value).toBe(env.ISR_BYPASS_TOKEN);
		expect(jar.deletes).toContainEqual({ name: OAUTH_COOKIE, options: { path: OAUTH_PATH } });
		expect(jar.deletes).toContainEqual({ name: SESSION_COOKIE, options: { path: LEGACY_COOKIE_PATH } });
		expect(logs).toEqual([expect.stringMatching(/^login allowed user=[0-9a-f]{8}$/)]);
	});
	it('refuses an address not on the list, without a session', async () => {
		finish.mockResolvedValue({ ok: true, email: 'other@example.test' });
		const jar = fakeCookies(await withPending());
		expect(await redirected(() => call(callback, event(at, jar.cookies)))).toEqual({
			status: 303,
			location: '/login?error=denied'
		});
		expect(jar.sets).toEqual([]);
		expect(logs).toEqual([expect.stringMatching(/^login refused user=[0-9a-f]{8}$/)]);
	});
	it('refuses an address Google has not verified', async () => {
		finish.mockResolvedValue({ ok: false, reason: 'unverified' });
		const jar = fakeCookies(await withPending());
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login?error=denied');
		expect(jar.sets).toEqual([]);
		expect(logs).toEqual(['login failed reason=unverified']);
	});
	it.each(['state', 'google', 'exchange'] as const)('fails without a session when the reason is %s', async (reason) => {
		finish.mockResolvedValue({ ok: false, reason });
		const jar = fakeCookies(await withPending());
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login?error=failed');
		expect(jar.sets).toEqual([]);
		expect(logs).toEqual([`login failed reason=${reason}`]);
	});
	it('fails without the pending cookie, and never asks Google', async () => {
		const jar = fakeCookies();
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login?error=failed');
		expect(finish).not.toHaveBeenCalled();
		expect(logs).toEqual(['login failed reason=cookie']);
	});
	it('returns home when the pending sign-in had no from', async () => {
		finish.mockResolvedValue({ ok: true, email: 'person@example.test' });
		const jar = fakeCookies({
			[OAUTH_COOKIE]: await createOAuthCookie(env.SESSION_SECRET ?? '', { ...pending, from: null })
		});
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/');
	});
	it('never logs or redirects with the address', async () => {
		finish.mockResolvedValue({ ok: true, email: 'other@example.test' });
		const jar = fakeCookies(await withPending());
		const r = await redirected(() => call(callback, event(at, jar.cookies)));
		expect(`${r.location} ${logs.join(' ')}`).not.toContain('example.test');
	});
	it('goes back to /login when sign-in is not configured here', async () => {
		env.ALLOWED_EMAILS = '';
		const jar = fakeCookies(await withPending());
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login');
		expect(finish).not.toHaveBeenCalled();
	});
});
