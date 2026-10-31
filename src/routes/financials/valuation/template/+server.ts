import { error } from '@sveltejs/kit';
import { writeTemplate } from '#lib/server/valuation-template';
import type { RequestHandler } from './$types';

/** The blank private company template, for logged-in visitors (like the rest of /financials). */
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.authed) error(401, 'Log in to download the template.');
	return new Response(writeTemplate(new Date().getUTCFullYear()), {
		headers: {
			'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'content-disposition': 'attachment; filename="valuation-template.xlsx"',
			'cache-control': 'private, no-store'
		}
	});
};
