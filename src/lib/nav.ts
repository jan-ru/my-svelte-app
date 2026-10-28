/** The pages built on the NYU Stern (Damodaran) files and the World Bank, in reading order: overview, list, lookup. */
export const EXPLORE_LINKS = [
	{ href: '/countries', label: 'Countries' },
	{ href: '/industries', label: 'Industries' },
	{ href: '/companies', label: 'Companies' },
	{ href: '/classification', label: 'Find industry' }
] as const;

export const EXPLORE_HOME = EXPLORE_LINKS[0].href;
export const EXPLORE_SOURCE = 'NYU Stern (Damodaran) and the World Bank';

export const inExplore = (pathname: string): boolean => EXPLORE_LINKS.some((l) => l.href === pathname);
