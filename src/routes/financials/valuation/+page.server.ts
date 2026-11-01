import { FMP_API_KEY, SESSION_SECRET, SITE_PASSWORD } from '$app/env/private';
import { fail, redirect } from '@sveltejs/kit';
import { getIndustries } from '#lib/server/compare';
import { loadValuation } from '#lib/server/valuation';
import { MAX_UPLOAD_BYTES, readTemplate } from '#lib/server/valuation-template';
import { encodeCompany, MAX_ENCODED } from '#lib/valuation-company';
import { parseValuationNav, valuationHref } from '#lib/valuation-nav';
import type { Actions, PageServerLoad } from './$types';

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

export const actions: Actions = {
	/** Reads an uploaded template once and sends the figures on in the URL; the file itself is never stored. */
	upload: async ({ locals, request, url }) => {
		if (!locals.authed) return fail(401, { message: 'Log in to upload figures.' });
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { message: 'Choose a filled-in template to upload.' });
		if (file.size > MAX_UPLOAD_BYTES) return fail(413, { message: 'That file is too large for a template.' });
		const result = readTemplate(new Uint8Array(await file.arrayBuffer()));
		if (!result.ok) return fail(400, { message: result.error });
		if (encodeCompany(result.figures).length > MAX_ENCODED)
			return fail(400, { message: 'The template holds too many figures.' });
		// industries are not known here; an industry in the query is kept as it was
		const industry = url.searchParams.get('industry');
		const nav = parseValuationNav(url.searchParams, industry ? [industry] : []);
		redirect(303, valuationHref({ ...nav, symbol: '', company: result.figures }));
	}
};
