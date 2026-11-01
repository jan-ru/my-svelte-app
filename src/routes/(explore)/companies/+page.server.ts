import companies from '#lib/data/companies.json';
import crosswalk from '#lib/data/crosswalk.json';
import { previewOf, queryCompanies, type CompanyData } from '#lib/companies';
import { isrConfig, pageParams } from '#lib/server/access';
import type { PageServerLoad } from './$types';

const data: CompanyData = companies;
const { sicTitles } = crosswalk;

const text = (value: string | null, max: number) => (value ?? '').slice(0, max);

// The page is cached for anonymous visitors; logged-in browsers skip the cache.
export const config = isrConfig(process.env.ISR_BYPASS_TOKEN);

export const load: PageServerLoad = ({ url, locals, setHeaders }) => {
	// Anonymous requests get an empty query, so what the cache stores never depends on who asked first.
	const params = pageParams(locals.interactive, url);
	const industry = text(params.get('industry'), 100);
	const sicParam = params.get('sic') ?? '';
	const sic = /^\d{4}$/.test(sicParam) ? sicParam : '';
	const country = text(params.get('country'), 100);
	const region = text(params.get('region'), 100);
	const sector = text(params.get('sector'), 100);
	const q = text(params.get('q'), 100);
	const page = Number.parseInt(params.get('page') ?? '1', 10);

	setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' });
	const result = queryCompanies(data, { industry, sic, country, region, sector, q, page });
	return {
		filters: { industry, sic, country, region, sector, q },
		result: locals.interactive ? result : previewOf(result),
		preview: !locals.interactive,
		industries: data.industries,
		regions: data.groups,
		sectors: [...data.sectors].sort((a, b) => a.localeCompare(b)),
		unknownIndustry: industry !== '' && !data.industries.includes(industry),
		sicTitle: sic ? (sicTitles[sic] ?? '') : '',
		generated: data.generated
	};
};
