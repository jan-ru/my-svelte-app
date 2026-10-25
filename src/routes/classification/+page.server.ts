import crosswalk from '$lib/data/crosswalk.json';
import { MAX_REVERSE, industries, reverseTrace, searchSbi, trace, type Crosswalk } from '$lib/crosswalk';
import type { PageServerLoad } from './$types';

const data = crosswalk as unknown as Crosswalk;

export const load: PageServerLoad = ({ url, setHeaders }) => {
	const q = (url.searchParams.get('q') ?? '').slice(0, 100);
	const code = (url.searchParams.get('code') ?? '').slice(0, 10);
	const industry = (url.searchParams.get('industry') ?? '').slice(0, 100);
	setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' });
	return {
		q,
		results: searchSbi(data, q),
		trace: trace(data, code),
		industry,
		industries: industries(data),
		reverse: reverseTrace(data, industry),
		maxReverse: MAX_REVERSE,
		generated: data.generated,
		companies: data.companies
	};
};
