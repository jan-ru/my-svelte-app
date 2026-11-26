// Starts Sign in with Google (ADR-014): stores the state, nonce and PKCE verifier in a signed, short-lived cookie
// and sends the browser to Google.
import { ALLOWED_EMAILS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET } from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { returnPath } from '#lib/return-path';
import { authorizationUrl, newPending } from '#lib/server/google';
import { OAUTH_COOKIE, OAUTH_MS, OAUTH_PATH, createOAuthCookie, signInConfig } from '#lib/server/session';
import type { RequestHandler } from './$types';

const GOOGLE_ORIGIN = 'https://accounts.google.com';

export const GET: RequestHandler = async ({ url, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const config = signInConfig({
		clientId: GOOGLE_CLIENT_ID,
		clientSecret: GOOGLE_CLIENT_SECRET,
		sessionSecret: SESSION_SECRET,
		allowed: ALLOWED_EMAILS
	});
	if (!config) redirect(303, '/login');
	const pending = newPending(returnPath(url.searchParams.get('from')));
	cookies.set(OAUTH_COOKIE, await createOAuthCookie(config.sessionSecret, pending), {
		path: OAUTH_PATH,
		httpOnly: true,
		sameSite: 'lax',
		maxAge: OAUTH_MS / 1000
	});
	const to = await authorizationUrl({ id: config.clientId, secret: config.clientSecret }, url.origin, pending);
	// SvelteKit 3 refuses an external redirect unless its origin is listed
	redirect(303, to.href, { external: [GOOGLE_ORIGIN] });
};
