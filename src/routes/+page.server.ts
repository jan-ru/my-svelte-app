import { buildLayout } from '#lib/layout';
import { DISPLAY_PARAM, parseDisplay, parseParams } from '#lib/params';
import { getComparison, getIndustries } from '#lib/server/compare';
import { isrConfig, pageParams } from '#lib/server/access';
import type { PageServerLoad } from './$types';

export const config = { maxDuration: 30, ...isrConfig(process.env.ISR_BYPASS_TOKEN) };

const CACHEABLE = 'public, s-maxage=86400, stale-while-revalidate=86400';

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	let industries: string[] = [];
	let loadError: string | null = null;
	try {
		industries = await getIndustries();
	} catch (error) {
		console.error('could not load the NYU industry list', error);
		loadError = 'The NYU data could not be loaded right now.';
	}

	// parseParams filters against the known list before the cap, but its fallback defaults are not
	// filtered, so drop any default the data does not know.
	// The display (chart or table) is public: anonymous visitors may switch too, and `v` is part of the cache key.
	const params = pageParams(locals.interactive, url, [DISPLAY_PARAM]);
	const display = parseDisplay(params);
	const view = parseParams(params, industries.length > 0 ? industries : undefined);
	if (industries.length > 0) {
		view.selection.industries = view.selection.industries.filter((name) => industries.includes(name));
	}

	const { selection, layout } = view;
	const ready = selection.multiples.length > 0 && selection.regions.length > 0 && selection.industries.length > 0;

	if (loadError || !ready) {
		setHeaders({ 'cache-control': 'no-store' });
		return { view, display, industries, loadError, model: null, updated: null };
	}

	const comparison = await getComparison(selection);
	const partial = Object.keys(comparison.errors).length > 0;
	setHeaders({ 'cache-control': partial ? 'no-store' : CACHEABLE });

	return {
		view,
		display,
		industries,
		loadError: null,
		model: buildLayout(selection, layout, comparison),
		updated: comparison.updated
	};
};
