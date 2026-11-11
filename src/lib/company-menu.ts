import { TABS, navHref, parseNav, type Nav, type Tab } from './financials-nav';
import { valuationLink } from './valuation/nav';

export interface MenuItem {
	readonly href: string;
	readonly label: string;
	readonly current: boolean;
}

/**
 * The side menu of the two company pages: the Financials tabs, then Valuation, all for the same ticker. `nav` keeps
 * the statement, period and source of the Financials page; without it the tabs open at their defaults.
 */
export function companyMenu(o: {
	readonly symbol: string;
	readonly current: Tab | 'valuation';
	readonly nav?: Nav;
}): readonly MenuItem[] {
	const base = o.nav ?? parseNav(new URLSearchParams());
	return [
		...TABS.map((t) => ({
			href: navHref({ ...base, tab: t.id }, o.symbol),
			label: t.label,
			current: o.current === t.id
		})),
		{ href: valuationLink(o.symbol, base.source), label: 'Valuation', current: o.current === 'valuation' }
	];
}
