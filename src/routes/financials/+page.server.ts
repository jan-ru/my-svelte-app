import { FMP_API_KEY, SESSION_SECRET, SITE_PASSWORD } from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { parseNav } from '#lib/financials-nav';
import { loginHref } from '#lib/return-path';
import { loadFinancials } from '#lib/server/financials';
import { parseSymbol } from '#lib/symbol';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	// Old login links (`/financials?from=...`) now go to the login page, which returns to that page.
	if (url.searchParams.has('from')) redirect(303, loginHref(url.searchParams.get('from')));
	const nav = parseNav(url.searchParams);
	const rawSymbol = url.searchParams.get('symbol');

	return {
		configured: Boolean(SITE_PASSWORD && SESSION_SECRET),
		nav,
		symbol: (rawSymbol && parseSymbol(rawSymbol)) || '',
		view: await loadFinancials({ authed: locals.authed, nav, rawSymbol, apiKey: FMP_API_KEY })
	};
};
