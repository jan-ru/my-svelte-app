import { SESSION_MS, safeEqual } from './session';

/** The cookie name Vercel checks to skip the ISR cache for one browser. */
export const BYPASS_COOKIE = '__prerender_bypass';
export const ISR_EXPIRATION_SECONDS = 86400;
/**
 * The query parameters that reach a cached route (the adapter adds `__pathname`). Vercel drops every other parameter
 * before the function runs, even for a logged-in request that skips the cache, so the pages' own filter and selection
 * parameters must be listed or the interactive controls stop working. Each value gets its own cache entry. The
 * anonymous loaders ignore all of them except the few a page names as public in `pageParams` (the size pages' `band`),
 * so an entry holds the anonymous view for those values only, the same whoever asked first. The two `x-sveltekit-*`
 * parameters are SvelteKit's `__data.json` request parameters, which it reads before hooks run.
 */
export const ISR_ALLOW_QUERY = [
	// Home
	'm',
	'r',
	'i',
	'p',
	'x',
	'c',
	// Find Industry and Companies
	'q',
	'code',
	'industry',
	'sic',
	'country',
	'region',
	'sector',
	'page',
	// Countries and Industries
	'measure',
	'band',
	// SvelteKit data requests
	'x-sveltekit-invalidated',
	'x-sveltekit-trailing-slash'
] as const;
export const MIN_BYPASS_TOKEN_LENGTH = 32;
/** The session cookie used to be scoped to /financials; login and logout also clear that one. */
export const LEGACY_COOKIE_PATH = '/financials';

/** The token, or undefined when it is missing or too short to be safe (then the cache is off). */
export function bypassToken(raw: string | undefined): string | undefined {
	return raw && raw.length >= MIN_BYPASS_TOKEN_LENGTH ? raw : undefined;
}

/** Route `config` fragment: ISR for the public pages when a usable token exists, else no ISR. */
export function isrConfig(raw: string | undefined) {
	const token = bypassToken(raw);
	return token
		? { isr: { expiration: ISR_EXPIRATION_SECONDS, bypassToken: token, allowQuery: [...ISR_ALLOW_QUERY] } }
		: { isr: false as const };
}

/**
 * Interactive = a valid session and, when the cache is on, the bypass cookie equal to the token. A request that
 * can fill the ISR cache has no bypass cookie, so what gets cached is always the anonymous view.
 */
export function isInteractive(
	authed: boolean,
	bypassCookie: string | undefined,
	rawToken: string | undefined
): boolean {
	if (!authed) return false;
	const token = bypassToken(rawToken);
	if (!token) return true;
	return bypassCookie !== undefined && safeEqual(bypassCookie, token);
}

/**
 * Vercel treats `x-prerender-revalidate: <bypassToken>` as "regenerate this route and store the result". Every
 * logged-in browser holds that token in its bypass cookie, so such a request must never render the interactive view.
 */
export function isRevalidation(headers: Headers): boolean {
	return headers.has('x-prerender-revalidate');
}

/**
 * The bypass cookie a private (never cached) page should give back: the token when the browser is logged in but lost
 * the cookie (cleared, or the token was rotated), so the public pages become interactive again. Hooks never set
 * cookies, so /login, /financials and /financials/valuation do it.
 */
export function bypassToRestore(
	authed: boolean,
	interactive: boolean,
	rawToken: string | undefined
): string | undefined {
	return authed && !interactive ? bypassToken(rawToken) : undefined;
}

/**
 * The query a loader may read. Interactive requests get all of it. Anonymous requests get only the `publicKeys` a page
 * names, whose values are part of the cache key (`ISR_ALLOW_QUERY`), so what is cached for a URL depends on that URL
 * alone and never on who asked first; with none named, an anonymous request reads an empty query.
 */
export function pageParams(interactive: boolean, url: URL, publicKeys: readonly string[] = []): URLSearchParams {
	if (interactive) return url.searchParams;
	return new URLSearchParams([...url.searchParams].filter(([key]) => publicKeys.includes(key)));
}

/** Options for the session and bypass cookies: site-wide, HTTP-only, as long as the session. */
export function sessionCookieOptions() {
	return { path: '/', httpOnly: true, sameSite: 'lax' as const, maxAge: Math.floor(SESSION_MS / 1000) };
}
