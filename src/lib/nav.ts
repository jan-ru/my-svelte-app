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
	{ id: 'access', label: 'Public and logged-in' },
	{ id: 'sources', label: 'Data sources' },
	{ id: 'status', label: 'Status' }
] as const;

export interface MainLink {
	readonly href: string;
	readonly label: string;
	readonly current: boolean;
}

/** The pages of the menubar, with the one for `pathname` marked. Result first, then reference data, then company data. */
export function mainLinks(pathname: string): readonly MainLink[] {
	return [
		{ href: '/', label: 'Multiples', current: pathname === '/' },
		{ href: EXPLORE_HOME, label: 'Explore', current: inExplore(pathname) },
		{ href: '/financials', label: 'Financials', current: pathname === '/financials' },
		{ href: '/financials/valuation', label: 'Valuation', current: pathname === '/financials/valuation' },
		{ href: '/about', label: 'About', current: pathname === '/about' }
	];
}
