import { ISR_BYPASS_TOKEN, SESSION_SECRET } from '$app/env/private';
import { SESSION_COOKIE, verifySession } from '#lib/server/auth';
import { BYPASS_COOKIE, isInteractive } from '#lib/server/access';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	// Fails closed: with no SESSION_SECRET configured, verifySession is always false.
	event.locals.authed = verifySession(event.cookies.get(SESSION_COOKIE), SESSION_SECRET ?? '');
	event.locals.interactive = isInteractive(event.locals.authed, event.cookies.get(BYPASS_COOKIE), ISR_BYPASS_TOKEN);

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	// Interactive pages are per person; /financials is always dynamic.
	if (event.locals.interactive || event.url.pathname.startsWith('/financials')) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};
