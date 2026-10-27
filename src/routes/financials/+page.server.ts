import { FMP_API_KEY, ISR_BYPASS_TOKEN, SESSION_SECRET, SITE_PASSWORD } from '$app/env/private';
import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, createSession, passwordMatches } from '#lib/server/auth';
import { afterLogin, parseNav } from '#lib/financials-nav';
import { returnPath } from '#lib/return-path';
import { BYPASS_COOKIE, LEGACY_COOKIE_PATH, bypassToken, sessionCookieOptions } from '#lib/server/access';
import { loadFinancials } from '#lib/server/financials';
import { checkLogin, createRateLimiter } from '#lib/server/ratelimit';
import { parseSymbol } from '#lib/symbol';
import type { Actions, PageServerLoad } from './$types';

const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

export const load: PageServerLoad = async ({ locals, url, setHeaders, cookies }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const nav = parseNav(url.searchParams);
	const rawSymbol = url.searchParams.get('symbol');
	const from = returnPath(url.searchParams.get('from'));

	// Logged in but without the bypass cookie (cleared, or the token was rotated): give it back here, where
	// nothing is cached, and return to the page the visitor came from. Hooks never set cookies.
	const token = bypassToken(ISR_BYPASS_TOKEN);
	if (locals.authed && token && !locals.interactive) {
		cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
		if (from) redirect(303, from);
	}

	return {
		configured: Boolean(SITE_PASSWORD && SESSION_SECRET),
		nav,
		from,
		symbol: (rawSymbol && parseSymbol(rawSymbol)) || '',
		view: await loadFinancials({ authed: locals.authed, nav, rawSymbol, apiKey: FMP_API_KEY })
	};
};

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress, url }) => {
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

		cookies.set(SESSION_COOKIE, createSession(secret), sessionCookieOptions());
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		const token = bypassToken(ISR_BYPASS_TOKEN);
		if (token) cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
		redirect(303, afterLogin(url.searchParams));
	},

	logout: async ({ cookies, url }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		cookies.delete(BYPASS_COOKIE, { path: '/' });
		redirect(303, returnPath(url.searchParams.get('from')) ?? '/financials');
	}
};
