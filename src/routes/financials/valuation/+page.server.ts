import { FMP_API_KEY, SESSION_SECRET, SITE_PASSWORD } from '$app/env/private';
import { getIndustries } from '#lib/server/compare';
import { loadValuation } from '#lib/server/valuation';
import { parseValuationNav } from '#lib/valuation-nav';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	// the industry list is only needed once someone can use the page
	const industries = locals.authed
		? await getIndustries().catch((error: unknown) => {
				console.error('valuation: could not load the NYU industry list', error);
				return [];
			})
		: [];
	const nav = parseValuationNav(url.searchParams, industries);
	return {
		configured: Boolean(SITE_PASSWORD && SESSION_SECRET),
		nav,
		industries,
		view: await loadValuation({
			authed: locals.authed,
			nav,
			rawSymbol: url.searchParams.get('symbol'),
			apiKey: FMP_API_KEY
		})
	};
};
