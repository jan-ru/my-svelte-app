import { ADMIN_EMAILS, ALLOWED_EMAILS, ISR_BYPASS_TOKEN, PAGE_ACCESS, SESSION_SECRET } from '$app/env/private';
import { SESSION_COOKIE, parseAllowed, verifySession } from '#lib/server/session';
import { BYPASS_COOKIE, bypassToken, isInteractive, isRevalidation } from '#lib/server/access';
import { SETTINGS_PATH, mayUse, parsePageAccess } from '#lib/server/page-access';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	// Fails closed: with no SESSION_SECRET or an empty ALLOWED_EMAILS, nobody is logged in. An address taken off the
	// list ends its session at the next request after the redeploy (ADR-014).
	const allowed = parseAllowed(ALLOWED_EMAILS);
	const email = await verifySession(event.cookies.get(SESSION_COOKIE), SESSION_SECRET ?? '', allowed);
	// Which pages that person may use comes from ADMIN_EMAILS and PAGE_ACCESS, checked on every request (ADR-015).
	// SvelteKit gives a data request the page's own path, so a page's data is covered by the page's permission.
	const admins = parseAllowed(ADMIN_EMAILS);
	const rules = parsePageAccess(PAGE_ACCESS);
	const { pathname } = event.url;
	const permitted = email !== null && mayUse(email, pathname, admins, rules);
	event.locals.authed = permitted;
	event.locals.denied = email !== null && !permitted;
	event.locals.admin = email !== null && admins.has(email);
	if (event.locals.admin && pathname === SETTINGS_PATH) {
		event.locals.settings = { allowed: [...allowed].sort(), admins: [...admins].sort(), rules };
	}
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
	if (
		event.locals.interactive ||
		pathname.startsWith('/financials') ||
		pathname.startsWith(SETTINGS_PATH) ||
		!bypassToken(ISR_BYPASS_TOKEN)
	) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};

/**
 * Unexpected errors are logged with a reference and the visitor gets only a generic message and that reference,
 * never the error text (which could hold an upstream URL). Expected and framework errors keep their safe message.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	const errorId = crypto.randomUUID();
	console.error(`unexpected error ${errorId} on ${event.request.method} ${event.url.pathname}`, error);
	return { message: 'Something went wrong.', errorId };
};
