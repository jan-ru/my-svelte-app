/** Local pages the login may send the visitor back to. An allow-list, so `from` can never become an open redirect. */
export const RETURN_PATHS = [
	'/',
	'/classification',
	'/companies',
	'/countries',
	'/industries',
	'/about',
	'/financials',
	'/financials/valuation'
] as const;
export type ReturnPath = (typeof RETURN_PATHS)[number];

export function returnPath(raw: string | null | undefined): ReturnPath | null {
	return RETURN_PATHS.find((path) => path === raw) ?? null;
}
