import { ISR_BYPASS_TOKEN, SESSION_SECRET, SITE_PASSWORD } from '$app/env/private';
import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, createSession, passwordMatches } from '#lib/server/auth';
import { returnPath } from '#lib/return-path';
import {
	BYPASS_COOKIE,
	LEGACY_COOKIE_PATH,
	bypassToRestore,
	bypassToken,
	sessionCookieOptions
} from '#lib/server/access';
import { checkLogin, createRateLimiter } from '#lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

/** Where to go when no allow-listed page was given. */
const HOME = '/';

/** The submitted password; a file upload in its place counts as empty. */
const passwordOf = (form: FormData): string => {
	const value = form.get('password');
	return typeof value === 'string' ? value : '';
};

export const load: PageServerLoad = ({ locals, url, setHeaders, cookies }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const from = returnPath(url.searchParams.get('from'));

	if (locals.authed) {
		// Logged in but without the bypass cookie (cleared, or the token was rotated): give it back here, where
		// nothing is cached. Hooks never set cookies.
		const token = bypassToRestore(locals.authed, locals.interactive, ISR_BYPASS_TOKEN);
		if (token) cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
		redirect(303, from ?? HOME);
	}

	return { configured: Boolean(SITE_PASSWORD && SESSION_SECRET), from };
};

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress, url }) => {
		const password = SITE_PASSWORD ?? '';
		const secret = SESSION_SECRET ?? '';
		if (!password || !secret) {
			console.error('login attempted but SITE_PASSWORD or SESSION_SECRET is not set');
			return fail(503, { message: 'Logging in is not configured on this deployment.' });
		}

		// Read the body first: awaiting it between the limit check and the failure record would let
		// N parallel requests all pass the check. From here to checkLogin there is no await, so
		// check-and-record is atomic per instance (the limiter itself is per instance, best effort).
		const form = await request.formData();
		// The key is getClientAddress(), i.e. x-forwarded-for, which Vercel overwrites with the real client IP.
		const result = checkLogin(limiter, getClientAddress(), passwordOf(form), (submitted) =>
			passwordMatches(submitted, password)
		);
		if (result === 'limited') return fail(429, { message: 'Too many attempts. Try again later.' });
		if (result === 'wrong') return fail(401, { message: 'Wrong password.' });

		cookies.set(SESSION_COOKIE, createSession(secret), sessionCookieOptions());
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		const token = bypassToken(ISR_BYPASS_TOKEN);
		if (token) cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
		redirect(303, returnPath(url.searchParams.get('from')) ?? HOME);
	},

	logout: ({ cookies, url }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		cookies.delete(BYPASS_COOKIE, { path: '/' });
		redirect(303, returnPath(url.searchParams.get('from')) ?? HOME);
	}
};
