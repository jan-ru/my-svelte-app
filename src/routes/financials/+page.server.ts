import { FMP_API_KEY, SESSION_SECRET, SITE_PASSWORD } from '$app/env/private';
import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_MS, createSession, passwordMatches } from '#lib/server/auth';
import { parseNav } from '#lib/financials-nav';
import { loadFinancials } from '#lib/server/financials';
import { checkLogin, createRateLimiter } from '#lib/server/ratelimit';
import { parseSymbol } from '#lib/symbol';
import type { Actions, PageServerLoad } from './$types';

const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const COOKIE_PATH = '/financials';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const nav = parseNav(url.searchParams);
	const rawSymbol = url.searchParams.get('symbol');
	return {
		configured: Boolean(SITE_PASSWORD && SESSION_SECRET),
		nav,
		symbol: (rawSymbol && parseSymbol(rawSymbol)) || '',
		view: await loadFinancials({ authed: locals.authed, nav, rawSymbol, apiKey: FMP_API_KEY })
	};
};

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress }) => {
		const password = SITE_PASSWORD ?? '';
		const secret = SESSION_SECRET ?? '';
		if (!password || !secret) {
			console.error('financials login attempted but SITE_PASSWORD or SESSION_SECRET is not set');
			return fail(503, { message: 'This page is not configured.' });
		}

		// Read the body first: awaiting it between the limit check and the failure record would let
		// N parallel requests all pass the check. From here to checkLogin there is no await, so
		// check-and-record is atomic per instance (the limiter itself is per instance, best effort).
		const form = await request.formData();
		// The key is getClientAddress(), i.e. x-forwarded-for, which Vercel overwrites with the real client IP.
		const result = checkLogin(limiter, getClientAddress(), String(form.get('password') ?? ''), (submitted) =>
			passwordMatches(submitted, password)
		);
		if (result === 'limited') return fail(429, { message: 'Too many attempts. Try again later.' });
		if (result === 'wrong') return fail(401, { message: 'Wrong password.' });

		cookies.set(SESSION_COOKIE, createSession(secret), {
			path: COOKIE_PATH,
			httpOnly: true,
			sameSite: 'lax',
			maxAge: Math.floor(SESSION_MS / 1000)
		});
		redirect(303, '/financials');
	},

	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: COOKIE_PATH });
		redirect(303, '/financials');
	}
};
