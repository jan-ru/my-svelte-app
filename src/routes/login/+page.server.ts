import {
	ALLOWED_EMAILS,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	ISR_BYPASS_TOKEN,
	SESSION_SECRET
} from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { returnPath } from '#lib/return-path';
import { BYPASS_COOKIE, LEGACY_COOKIE_PATH, bypassToRestore, sessionCookieOptions } from '#lib/server/access';
import { SESSION_COOKIE, signInConfig } from '#lib/server/session';
import type { Actions, PageServerLoad } from './$types';

/** Where to go when no allow-listed page was given. */
const HOME = '/';

const errorOf = (raw: string | null): 'denied' | 'failed' | null => (raw === 'denied' || raw === 'failed' ? raw : null);

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

	const configured =
		signInConfig({
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
			sessionSecret: SESSION_SECRET,
			allowed: ALLOWED_EMAILS
		}) !== null;
	return { configured, from, error: errorOf(url.searchParams.get('error')) };
};

export const actions: Actions = {
	logout: ({ cookies, url }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		cookies.delete(BYPASS_COOKIE, { path: '/' });
		redirect(303, returnPath(url.searchParams.get('from')) ?? HOME);
	}
};
