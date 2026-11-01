import crosswalk from '#lib/data/crosswalk.json';
import { MAX_REVERSE, industries, reverseTrace, searchSbi, trace, type Crosswalk } from '#lib/crosswalk';
import { isrConfig, pageParams } from '#lib/server/access';
import type { PageServerLoad } from './$types';

const data: Crosswalk = crosswalk;

// The page is cached for anonymous visitors; logged-in browsers skip the cache.
export const config = isrConfig(process.env.ISR_BYPASS_TOKEN);

export const load: PageServerLoad = ({ url, locals, setHeaders }) => {
	const params = pageParams(locals.interactive, url);
	const q = (params.get('q') ?? '').slice(0, 100);
	const code = (params.get('code') ?? '').slice(0, 10);
	const industry = (params.get('industry') ?? '').slice(0, 100);
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
