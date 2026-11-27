/** The pages built on the NYU Stern (Damodaran) files and the World Bank, in reading order: overview, list, lookup. */
export const EXPLORE_LINKS = [
	{ href: '/countries', label: 'Countries' },
	{ href: '/industries', label: 'Industries' },
	{ href: '/companies', label: 'Companies' },
	{ href: '/classification', label: 'Find Industry' }
] as const;

export const EXPLORE_HOME = EXPLORE_LINKS[0].href;

export const inExplore = (pathname: string): boolean => EXPLORE_LINKS.some((l) => l.href === pathname);

/** The sections of the About page, in order: the "On this page" menu links to each heading's `id`. */
export const ABOUT_SECTIONS = [
	{ id: 'pages', label: 'Pages' },
	{ id: 'access', label: 'Public and signed in' },
	{ id: 'sources', label: 'Data sources' }
] as const;

export interface MainLink {
	readonly href: string;
	readonly label: string;
	readonly current: boolean;
}

/**
 * The work pages of the menubar, with the one for `pathname` marked, from broad to narrow: countries and industries,
 * multiples per industry, one company, its valuation. About sits apart, on the right (`aboutLink`).
 */
export function mainLinks(pathname: string): readonly MainLink[] {
	return [
		{ href: EXPLORE_HOME, label: 'Explore', current: inExplore(pathname) },
		{ href: '/', label: 'Multiples', current: pathname === '/' },
		{ href: '/financials', label: 'Financials', current: pathname === '/financials' },
		{ href: '/financials/valuation', label: 'Valuation', current: pathname === '/financials/valuation' }
	];
}

/** The About link on the right of the bar, next to Settings and Log in. */
export const aboutLink = (pathname: string): MainLink => ({
	href: '/about',
	label: 'About',
	current: pathname === '/about'
});
