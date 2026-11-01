import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	SESSION_SECRET: undefined as string | undefined,
	ISR_BYPASS_TOKEN: undefined as string | undefined
}));
vi.mock('$app/env/private', () => env);

import { BYPASS_COOKIE } from '#lib/server/access';
import { SESSION_COOKIE, createSession } from '#lib/server/auth';
import { handle } from './hooks.server';

const SECRET = 's'.repeat(32);
const TOKEN = 't'.repeat(40);
const LOADER_HEADER = 'public, s-maxage=86400, stale-while-revalidate=86400';

type Locals = { authed?: boolean; interactive?: boolean };

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

const session = () => createSession(SECRET);

beforeEach(() => {
	env.SESSION_SECRET = SECRET;
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
			cookies: { [SESSION_COOKIE]: session(), [BYPASS_COOKIE]: TOKEN }
		});
		expect(locals).toEqual({ authed: true, interactive: true });
		expect(cache).toBe('private, no-store');
	});

	it('keeps a session without the bypass cookie anonymous and leaves the loader header', async () => {
		const { locals, cache } = await run('/companies', { cookies: { [SESSION_COOKIE]: session() } });
		expect(locals).toEqual({ authed: true, interactive: false });
		expect(cache).toBe(LOADER_HEADER);
	});

	it('ignores a forged bypass cookie without a session', async () => {
		const { locals, cache } = await run('/companies', { cookies: { [BYPASS_COOKIE]: TOKEN } });
		expect(locals).toEqual({ authed: false, interactive: false });
		expect(cache).toBe(LOADER_HEADER);
	});

	it('always renders the anonymous view for a revalidation request (C1)', async () => {
		const { locals, cache } = await run('/companies', {
			cookies: { [SESSION_COOKIE]: session(), [BYPASS_COOKIE]: TOKEN },
			headers: { 'x-prerender-revalidate': TOKEN }
		});
		expect(locals.interactive).toBe(false);
		expect(cache).toBe(LOADER_HEADER);
	});

	it('is private and uncached on /financials, with or without a session', async () => {
		expect((await run('/financials')).cache).toBe('private, no-store');
		expect((await run('/financials', { cookies: { [SESSION_COOKIE]: session() } })).cache).toBe('private, no-store');
	});

	it.each([undefined, 'short'])('drops the public header when the token is unusable (%s) (I2)', async (token) => {
		env.ISR_BYPASS_TOKEN = token;
		const anon = await run('/companies');
		expect(anon.locals.interactive).toBe(false);
		expect(anon.cache).toBe('private, no-store');
		const authed = await run('/companies', { cookies: { [SESSION_COOKIE]: session() } });
		expect(authed.locals).toEqual({ authed: true, interactive: true });
		expect(authed.cache).toBe('private, no-store');
	});

	it('fails closed without SESSION_SECRET', async () => {
		env.SESSION_SECRET = undefined;
		const { locals } = await run('/companies', { cookies: { [SESSION_COOKIE]: session(), [BYPASS_COOKIE]: TOKEN } });
		expect(locals).toEqual({ authed: false, interactive: false });
	});
});
