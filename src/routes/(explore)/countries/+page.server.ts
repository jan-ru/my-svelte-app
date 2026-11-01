import companies from '#lib/data/companies.json';
import gdp from '#lib/data/gdp.json';
import type { CompanyData } from '#lib/companies';
import type { GdpData } from '#lib/gdp';
import { isrConfig, pageParams } from '#lib/server/access';
import { parseSizeNav } from '#lib/size-nav';
import { countriesView } from '#lib/size-view';
import type { PageServerLoad } from './$types';

const data: CompanyData = companies;
const gdpData: GdpData = gdp;

// The page is cached for anonymous visitors; logged-in browsers skip the cache.
export const config = isrConfig(process.env.ISR_BYPASS_TOKEN);

export const load: PageServerLoad = ({ url, locals, setHeaders }) => {
	// Anonymous requests get an empty query, so what the cache stores never depends on who asked first.
	const params = pageParams(locals.interactive, url);
	const nav = parseSizeNav(
		params,
		{ countries: data.countries, industries: data.industries, sectors: data.sectors },
		'/countries'
	);
	setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' });
	return {
		nav,
		view: countriesView(data, gdpData, nav),
		// the selector lists are only needed (and only shown) for logged-in visitors
		countries: locals.interactive ? data.countries : [],
		industries: locals.interactive ? data.industries : [],
		generated: data.generated
	};
};
