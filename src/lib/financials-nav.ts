import { parseSource, type Source } from './source';

export const TABS = [
	{ id: 'financials', label: 'Financials' },
	{ id: 'ratios', label: 'Ratios' },
	{ id: 'estimates', label: 'Estimates' },
	{ id: 'earnings', label: 'Earnings' },
	{ id: 'peers', label: 'Peers' },
	{ id: 'supply', label: 'Supply chain (test)' },
	{ id: 'news', label: 'News' },
	{ id: 'price', label: 'Stock Price' },
	{ id: 'company', label: 'Company Data' }
] as const;
export const STATEMENTS = [
	{ id: 'income', label: 'Income Statement' },
	{ id: 'balance', label: 'Balance Sheet' },
	{ id: 'cashflow', label: 'Cash Flow' }
] as const;
export const PERIODS = [
	{ id: 'annual', label: 'Latest 5 years' },
	{ id: 'ttm', label: 'TTM' }
] as const;

export const DETAILS = [
	{ id: 'condensed', label: 'Condensed' },
	{ id: 'full', label: 'Full' }
] as const;

export type Tab = (typeof TABS)[number]['id'];
export type StatementId = (typeof STATEMENTS)[number]['id'];
export type Period = (typeof PERIODS)[number]['id'];
export type Detail = (typeof DETAILS)[number]['id'];
export interface Nav {
	tab: Tab;
	statement: StatementId;
	period: Period;
	/** How many lines the balance sheet shows; unset means condensed. Only the balance sheet has it. */
	detail?: Detail;
	/** The source the visitor asked for; the effective one also depends on the ticker (see `resolveSource`). */
	source?: Source;
}

const pick = <T extends string>(options: readonly { id: T }[], value: string | null, fallback: T): T =>
	options.find((o) => o.id === value)?.id ?? fallback;

export function parseNav(params: URLSearchParams): Nav {
	const source = parseSource(params.get('source'));
	const detail = DETAILS.find((d) => d.id === params.get('detail'))?.id;
	return {
		tab: pick(TABS, params.get('tab'), 'financials'),
		statement: pick(STATEMENTS, params.get('statement'), 'income'),
		period: pick(PERIODS, params.get('period'), 'annual'),
		...(detail ? { detail } : {}),
		...(source ? { source } : {})
	};
}

export function navHref(nav: Nav, symbol: string): string {
	const sp = new URLSearchParams();
	if (symbol) sp.set('symbol', symbol);
	sp.set('tab', nav.tab);
	sp.set('statement', nav.statement);
	sp.set('period', nav.period);
	if (nav.detail) sp.set('detail', nav.detail);
	if (nav.source) sp.set('source', nav.source);
	return `/financials?${sp}`;
}
