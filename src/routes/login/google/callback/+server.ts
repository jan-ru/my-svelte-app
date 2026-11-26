// Finishes Sign in with Google (ADR-014): only an address on ALLOWED_EMAILS gets a session. Logs a keyed hash of the
// address, never the address, a token or Google's text.
import {
	ALLOWED_EMAILS,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	ISR_BYPASS_TOKEN,
	SESSION_SECRET
} from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { BYPASS_COOKIE, LEGACY_COOKIE_PATH, bypassToken, sessionCookieOptions } from '#lib/server/access';
import { finishSignIn } from '#lib/server/google';
import {
	OAUTH_COOKIE,
	OAUTH_PATH,
	SESSION_COOKIE,
	createSession,
	isAllowed,
	readOAuthCookie,
	signInConfig,
	userHash
} from '#lib/server/session';
import type { RequestHandler } from './$types';

const HOME = '/';

export const GET: RequestHandler = async ({ url, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const config = signInConfig({
		clientId: GOOGLE_CLIENT_ID,
		clientSecret: GOOGLE_CLIENT_SECRET,
		sessionSecret: SESSION_SECRET,
		allowed: ALLOWED_EMAILS
	});
	if (!config) redirect(303, '/login');

	const pending = await readOAuthCookie(cookies.get(OAUTH_COOKIE), config.sessionSecret);
	// single-use, whatever happens next
	cookies.delete(OAUTH_COOKIE, { path: OAUTH_PATH });
	if (!pending) {
		console.warn('login failed reason=cookie');
		redirect(303, '/login?error=failed');
	}

	const result = await finishSignIn({ id: config.clientId, secret: config.clientSecret }, url, pending);
	if (!result.ok) {
		console.warn(`login failed reason=${result.reason}`);
		redirect(303, result.reason === 'unverified' ? '/login?error=denied' : '/login?error=failed');
	}
	const user = await userHash(result.email, config.sessionSecret);
	if (!isAllowed(result.email, config.allowed)) {
		console.warn(`login refused user=${user}`);
		redirect(303, '/login?error=denied');
	}

	cookies.set(SESSION_COOKIE, await createSession(config.sessionSecret, result.email), sessionCookieOptions());
	cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
	const token = bypassToken(ISR_BYPASS_TOKEN);
	if (token) cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
	console.info(`login allowed user=${user}`);
	redirect(303, pending.from ?? HOME);
};
