import { ISR_BYPASS_TOKEN, SESSION_SECRET } from '$app/env/private';
import { SESSION_COOKIE, verifySession } from '#lib/server/auth';
import { BYPASS_COOKIE, bypassToken, isInteractive, isRevalidation } from '#lib/server/access';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	// Fails closed: with no SESSION_SECRET configured, verifySession is always false.
	event.locals.authed = verifySession(event.cookies.get(SESSION_COOKIE), SESSION_SECRET ?? '');
	// A revalidation request regenerates the cached public copy, so it always gets the anonymous view.
	event.locals.interactive =
		!isRevalidation(event.request.headers) &&
		isInteractive(event.locals.authed, event.cookies.get(BYPASS_COOKIE), ISR_BYPASS_TOKEN);

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	// Interactive pages are per person and /financials is always dynamic. Without a usable token ISR is off,
	// and a public header would still let the CDN cache by URL and show the anonymous copy to logged-in users.
	if (event.locals.interactive || event.url.pathname.startsWith('/financials') || !bypassToken(ISR_BYPASS_TOKEN)) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};
