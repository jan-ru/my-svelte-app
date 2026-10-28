import { createHash, timingSafeEqual } from 'node:crypto';
import { SESSION_MS } from './auth';

/** The cookie name Vercel checks to skip the ISR cache for one browser. */
export const BYPASS_COOKIE = '__prerender_bypass';
export const ISR_EXPIRATION_SECONDS = 86400;
/**
 * The query parameters that reach a cached route (the adapter adds `__pathname`). Vercel drops every other parameter
 * before the function runs, even for a logged-in request that skips the cache, so the pages' own filter and selection
 * parameters must be listed or the interactive controls stop working. Each value gets its own cache entry; the
 * anonymous loaders ignore them, so every entry holds the same anonymous view. The two `x-sveltekit-*` parameters are
 * SvelteKit's `__data.json` request parameters, which it reads before hooks run.
 */
export const ISR_ALLOW_QUERY = [
	// Home
	'm', 'r', 'i', 'p', 'x', 'c',
	// Find industry and Companies
	'q', 'code', 'industry', 'sic', 'country', 'region', 'sector', 'page',
	// Countries and Industries
	'measure',
	// SvelteKit data requests
	'x-sveltekit-invalidated', 'x-sveltekit-trailing-slash'
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

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Interactive = a valid session and, when the cache is on, the bypass cookie equal to the token. A request that
 * can fill the ISR cache has no bypass cookie, so what gets cached is always the anonymous view.
 */
export function isInteractive(authed: boolean, bypassCookie: string | undefined, rawToken: string | undefined): boolean {
	if (!authed) return false;
	const token = bypassToken(rawToken);
	if (!token) return true;
	return bypassCookie !== undefined && timingSafeEqual(digest(bypassCookie), digest(token));
}

/**
 * Vercel treats `x-prerender-revalidate: <bypassToken>` as "regenerate this route and store the result". Every
 * logged-in browser holds that token in its bypass cookie, so such a request must never render the interactive view.
 */
export function isRevalidation(headers: Headers): boolean {
	return headers.has('x-prerender-revalidate');
}

/** Anonymous requests never read the real query string, so a bot's first request cannot change what is cached. */
export function pageParams(interactive: boolean, url: URL): URLSearchParams {
	return interactive ? url.searchParams : new URLSearchParams();
}

/** Options for the session and bypass cookies: site-wide, HTTP-only, as long as the session. */
export function sessionCookieOptions() {
	return { path: '/', httpOnly: true, sameSite: 'lax' as const, maxAge: Math.floor(SESSION_MS / 1000) };
}
