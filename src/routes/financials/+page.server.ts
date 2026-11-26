import {
	ALLOWED_EMAILS,
	EULERPOOL_API_KEY,
	FMP_API_KEY,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	ISR_BYPASS_TOKEN,
	SESSION_SECRET
} from '$app/env/private';
import { BYPASS_COOKIE, bypassToRestore, sessionCookieOptions } from '#lib/server/access';
import { signInConfig } from '#lib/server/session';
import { redirect } from '@sveltejs/kit';
import { parseNav } from '#lib/financials-nav';
import { loginHref } from '#lib/return-path';
import { loadFinancials } from '#lib/server/financials';
import { parseSymbol } from '#lib/symbol';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, setHeaders, cookies }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	// a logged-in browser that lost the bypass cookie gets it back here, so the public pages are interactive again
	const bypass = bypassToRestore(locals.authed, locals.interactive, ISR_BYPASS_TOKEN);
	if (bypass) cookies.set(BYPASS_COOKIE, bypass, sessionCookieOptions());
	// Old login links (`/financials?from=...`) now go to the login page, which returns to that page.
	if (url.searchParams.has('from')) redirect(303, loginHref(url.searchParams.get('from')));
	const nav = parseNav(url.searchParams);
	const rawSymbol = url.searchParams.get('symbol');

	return {
		configured:
			signInConfig({
				clientId: GOOGLE_CLIENT_ID,
				clientSecret: GOOGLE_CLIENT_SECRET,
				sessionSecret: SESSION_SECRET,
				allowed: ALLOWED_EMAILS
			}) !== null,
		nav,
		symbol: (rawSymbol && parseSymbol(rawSymbol)) || '',
		view: await loadFinancials({
			authed: locals.authed,
			nav,
			rawSymbol,
			apiKey: FMP_API_KEY,
			eulerpoolKey: EULERPOOL_API_KEY
		})
	};
};
