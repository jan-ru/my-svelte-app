import { FMP_API_KEY, SESSION_SECRET, SITE_PASSWORD } from '$app/env/private';
import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_MS, createSession, passwordMatches } from '#lib/server/auth';
import { loadFinancials } from '#lib/server/financials';
import { createRateLimiter } from '#lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const COOKIE_PATH = '/financials';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	return {
		configured: Boolean(SITE_PASSWORD && SESSION_SECRET),
		view: await loadFinancials({
			authed: locals.authed,
			rawSymbol: url.searchParams.get('symbol'),
			apiKey: FMP_API_KEY
		})
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

		const ip = getClientAddress();
		if (limiter.isLimited(ip)) return fail(429, { message: 'Too many attempts. Try again later.' });

		const submitted = String((await request.formData()).get('password') ?? '');
		if (!passwordMatches(submitted, password)) {
			limiter.recordFailure(ip);
			return fail(401, { message: 'Wrong password.' });
		}

		limiter.reset(ip);
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
