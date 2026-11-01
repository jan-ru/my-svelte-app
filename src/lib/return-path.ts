/** Local pages the login may send the visitor back to. An allow-list, so `from` can never become an open redirect. */
export const RETURN_PATHS = [
	'/',
	'/classification',
	'/companies',
	'/countries',
	'/industries',
	'/about',
	'/financials',
	'/financials/valuation'
] as const;
export type ReturnPath = (typeof RETURN_PATHS)[number];

/** Longer `from` values are refused; a page's own query string is far shorter. */
export const MAX_RETURN_LENGTH = 2048;

const ORIGIN = 'http://return.invalid';

/**
 * The local page to go back to after logging in or out: an allow-listed path, with its query string kept so a
 * ticker or selection survives the login. Anything that would leave the site, or names another path, is null.
 */
export function returnPath(raw: string | null | undefined): string | null {
	if (!raw || raw.length > MAX_RETURN_LENGTH || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\'))
		return null;
	let url: URL;
	try {
		url = new URL(raw, ORIGIN);
	} catch {
		return null;
	}
	if (url.origin !== ORIGIN) return null;
	const path = RETURN_PATHS.find((p) => p === url.pathname);
	return path ? `${path}${url.search}` : null;
}

/** The login page, with the page to return to when there is one. */
export function loginHref(from: string | null | undefined): string {
	const back = returnPath(from);
	return back ? `/login?from=${encodeURIComponent(back)}` : '/login';
}

/** The logout action, returning to `from` when it is an allow-listed page. */
export function logoutAction(from: string | null | undefined): string {
	const back = returnPath(from);
	return back ? `/login?/logout&from=${encodeURIComponent(back)}` : '/login?/logout';
}
