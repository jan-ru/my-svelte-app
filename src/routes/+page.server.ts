import { buildLayout } from '$lib/layout';
import { DEFAULT_SELECTION, parseParams } from '$lib/params';
import { getComparison, getIndustries } from '$lib/server/compare';
import type { PageServerLoad } from './$types';

const CACHEABLE = 'public, s-maxage=86400, stale-while-revalidate=86400';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const view = parseParams(url.searchParams);

	let industries: string[] = [];
	let loadError: string | null = null;
	try {
		industries = await getIndustries();
	} catch {
		loadError = 'The NYU data could not be loaded right now.';
	}

	if (industries.length > 0) {
		const known = view.selection.industries.filter((name) => industries.includes(name));
		const askedForSome = url.searchParams.getAll('i').some((v) => v !== '');
		view.selection.industries =
			known.length === 0 && askedForSome ? [...DEFAULT_SELECTION.industries] : known;
	}

	const { selection, layout } = view;
	const ready =
		selection.multiples.length > 0 && selection.regions.length > 0 && selection.industries.length > 0;

	if (loadError || !ready) {
		setHeaders({ 'cache-control': 'no-store' });
		return { view, industries, loadError, model: null, updated: null };
	}

	const comparison = await getComparison(selection);
	const partial = Object.keys(comparison.errors).length > 0;
	setHeaders({ 'cache-control': partial ? 'no-store' : CACHEABLE });

	return {
		view,
		industries,
		loadError: null,
		model: buildLayout(selection, layout, comparison),
		updated: comparison.updated
	};
};
