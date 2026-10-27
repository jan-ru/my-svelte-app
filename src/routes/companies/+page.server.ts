import companies from '#lib/data/companies.json';
import crosswalk from '#lib/data/crosswalk.json';
import { queryCompanies, type CompanyData } from '#lib/companies';
import type { PageServerLoad } from './$types';

const data = companies as unknown as CompanyData;
const sicTitles = (crosswalk as unknown as { sicTitles: Record<string, string> }).sicTitles;

const text = (value: string | null, max: number) => (value ?? '').slice(0, max);

export const load: PageServerLoad = ({ url, setHeaders }) => {
	const industry = text(url.searchParams.get('industry'), 100);
	const sic = /^\d{4}$/.test(url.searchParams.get('sic') ?? '') ? url.searchParams.get('sic')! : '';
	const country = text(url.searchParams.get('country'), 100);
	const region = text(url.searchParams.get('region'), 100);
	const sector = text(url.searchParams.get('sector'), 100);
	const q = text(url.searchParams.get('q'), 100);
	const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);

	setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' });
	return {
		filters: { industry, sic, country, region, sector, q },
		result: queryCompanies(data, { industry, sic, country, region, sector, q, page }),
		industries: data.industries,
		regions: data.groups,
		sectors: [...data.sectors].sort((a, b) => a.localeCompare(b)),
		unknownIndustry: industry !== '' && !data.industries.includes(industry),
		sicTitle: sic ? (sicTitles[sic] ?? '') : '',
		generated: data.generated
	};
};
