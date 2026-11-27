import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	SESSION_SECRET: undefined as string | undefined,
	ALLOWED_EMAILS: undefined as string | undefined,
	ADMIN_EMAILS: undefined as string | undefined,
	PAGE_ACCESS: undefined as string | undefined,
	ISR_BYPASS_TOKEN: undefined as string | undefined
}));
vi.mock('$app/env/private', () => env);

import { BYPASS_COOKIE } from '#lib/server/access';
import { SESSION_COOKIE, createSession } from '#lib/server/session';
import { handle, handleError } from './hooks.server';

const SECRET = 's'.repeat(32);
const TOKEN = 't'.repeat(40);
const LOADER_HEADER = 'public, s-maxage=86400, stale-while-revalidate=86400';

type Locals = { authed?: boolean; interactive?: boolean; denied?: boolean; admin?: boolean; settings?: unknown };

async function run(path: string, opts: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}) {
	const cookies = opts.cookies ?? {};
	const locals: Locals = {};
	const event = {
		locals,
		url: new URL(`http://x.test${path}`),
		cookies: { get: (name: string) => cookies[name] },
		request: new Request(`http://x.test${path}`, { headers: opts.headers })
	};
	const resolve = vi.fn(async () => new Response('ok', { headers: { 'cache-control': LOADER_HEADER } }));
	const response = await (handle as unknown as (input: unknown) => Promise<Response>)({ event, resolve });
	return { locals, response, cache: response.headers.get('cache-control') };
}

const session = () => createSession(SECRET, 'person@example.test');

beforeEach(() => {
	env.SESSION_SECRET = SECRET;
	env.ALLOWED_EMAILS = 'person@example.test';
	env.ADMIN_EMAILS = undefined;
	env.PAGE_ACCESS = 'person@example.test=*';
	env.ISR_BYPASS_TOKEN = TOKEN;
});

describe('handle', () => {
	it('sets the security headers', async () => {
		const { response } = await run('/companies');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
		expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
	});

	it('treats a session plus the matching bypass cookie as interactive and private', async () => {
		const { locals, cache } = await run('/companies', {
			cookies: { [SESSION_COOKIE]: await session(), [BYPASS_COOKIE]: TOKEN }
		});
		expect(locals).toEqual({ authed: true, interactive: true, denied: false, admin: false });
		expect(cache).toBe('private, no-store');
	});

	it('keeps a session without the bypass cookie anonymous and leaves the loader header', async () => {
		const { locals, cache } = await run('/companies', { cookies: { [SESSION_COOKIE]: await session() } });
		expect(locals).toEqual({ authed: true, interactive: false, denied: false, admin: false });
		expect(cache).toBe(LOADER_HEADER);
	});

	it('ignores a forged bypass cookie without a session', async () => {
		const { locals, cache } = await run('/companies', { cookies: { [BYPASS_COOKIE]: TOKEN } });
		expect(locals).toEqual({ authed: false, interactive: false, denied: false, admin: false });
		expect(cache).toBe(LOADER_HEADER);
	});

	it('always renders the anonymous view for a revalidation request (C1)', async () => {
		const { locals, cache } = await run('/companies', {
			cookies: { [SESSION_COOKIE]: await session(), [BYPASS_COOKIE]: TOKEN },
			headers: { 'x-prerender-revalidate': TOKEN }
		});
		expect(locals.interactive).toBe(false);
		expect(cache).toBe(LOADER_HEADER);
	});

	it('is private and uncached on /financials, with or without a session', async () => {
		expect((await run('/financials')).cache).toBe('private, no-store');
		expect((await run('/financials', { cookies: { [SESSION_COOKIE]: await session() } })).cache).toBe(
			'private, no-store'
		);
	});

	it.each([undefined, 'short'])('drops the public header when the token is unusable (%s) (I2)', async (token) => {
		env.ISR_BYPASS_TOKEN = token;
		const anon = await run('/companies');
		expect(anon.locals.interactive).toBe(false);
		expect(anon.cache).toBe('private, no-store');
		const authed = await run('/companies', { cookies: { [SESSION_COOKIE]: await session() } });
		expect(authed.locals).toEqual({ authed: true, interactive: true, denied: false, admin: false });
		expect(authed.cache).toBe('private, no-store');
	});

	it('ends the session of an address taken off the list', async () => {
		const cookie = await session();
		env.ALLOWED_EMAILS = 'other@example.test';
		const { locals } = await run('/companies', { cookies: { [SESSION_COOKIE]: cookie, [BYPASS_COOKIE]: TOKEN } });
		expect(locals.authed).toBe(false);
		expect(locals.interactive).toBe(false);
	});

	it('fails closed without SESSION_SECRET', async () => {
		env.SESSION_SECRET = undefined;
		const { locals } = await run('/companies', {
			cookies: { [SESSION_COOKIE]: await session(), [BYPASS_COOKIE]: TOKEN }
		});
		expect(locals).toEqual({ authed: false, interactive: false, denied: false, admin: false });
	});
});

describe('handle: page access (ADR-015)', () => {
	const signedIn = async () => ({ [SESSION_COOKIE]: await session(), [BYPASS_COOKIE]: TOKEN });

	it('gives a person only the pages PAGE_ACCESS grants, and the anonymous view elsewhere', async () => {
		env.PAGE_ACCESS = 'person@example.test=/countries';
		const granted = await run('/countries', { cookies: await signedIn() });
		expect(granted.locals).toMatchObject({ authed: true, interactive: true, denied: false });
		const other = await run('/companies', { cookies: await signedIn() });
		expect(other.locals).toMatchObject({ authed: false, interactive: false, denied: true });
		expect(other.cache).toBe(LOADER_HEADER);
	});

	it('covers the paths below a page and leaves uncovered pages open', async () => {
		env.PAGE_ACCESS = 'person@example.test=/financials';
		expect((await run('/financials/valuation/template', { cookies: await signedIn() })).locals.authed).toBe(false);
		expect((await run('/login', { cookies: await signedIn() })).locals.authed).toBe(true);
	});

	it('fails closed when PAGE_ACCESS is unset', async () => {
		env.PAGE_ACCESS = undefined;
		const { locals } = await run('/', { cookies: await signedIn() });
		expect(locals).toMatchObject({ authed: false, denied: true });
	});

	it('gives an admin every page and the settings data, and no one else', async () => {
		env.PAGE_ACCESS = undefined;
		env.ADMIN_EMAILS = 'Person@Example.test';
		const page = await run('/financials/valuation', { cookies: await signedIn() });
		expect(page.locals).toMatchObject({ authed: true, admin: true, denied: false });
		expect(page.locals.settings).toBeUndefined();
		const settings = await run('/settings', { cookies: await signedIn() });
		expect(settings.locals.settings).toEqual({
			allowed: ['person@example.test'],
			admins: ['person@example.test'],
			rules: new Map()
		});
		expect(settings.cache).toBe('private, no-store');

		env.ADMIN_EMAILS = 'other@example.test';
		const notAdmin = await run('/settings', { cookies: await signedIn() });
		expect(notAdmin.locals).toMatchObject({ authed: false, admin: false });
		expect(notAdmin.locals.settings).toBeUndefined();
	});

	it('needs an admin on ALLOWED_EMAILS to sign in at all', async () => {
		env.ADMIN_EMAILS = 'person@example.test';
		env.ALLOWED_EMAILS = 'other@example.test';
		const { locals } = await run('/settings', { cookies: await signedIn() });
		expect(locals).toMatchObject({ authed: false, admin: false });
	});
});

describe('handleError', () => {
	type Input = Parameters<typeof handleError>[0];
	const event = { request: new Request('http://x.test/financials'), url: new URL('http://x.test/financials') };
	const call = (input: object) => handleError({ ...input, event } as unknown as Input);

	it('logs an unexpected error with a reference and hides its text', () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const result = call({ kind: 'unknown', error: new Error('https://api.example?apikey=secret') });
		expect(result).toEqual({ message: 'Something went wrong.', errorId: expect.any(String) });
		const errorId = (result as { errorId: string }).errorId;
		expect(log).toHaveBeenCalledWith(`unexpected error ${errorId} on GET /financials`, expect.any(Error));
		log.mockRestore();
	});

	it('leaves expected and framework errors as they are', () => {
		expect(call({ kind: 'app', error: { status: 401, message: 'Log in' } })).toBeUndefined();
		expect(call({ kind: 'framework', error: { status: 404, message: 'Not Found' } })).toBeUndefined();
	});
});
