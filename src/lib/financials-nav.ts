import { parseSymbol } from './symbol';
import { parseSource, type Source } from './source';

export const TABS = [
	{ id: 'financials', label: 'Financials' },
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

export type Tab = (typeof TABS)[number]['id'];
export type StatementId = (typeof STATEMENTS)[number]['id'];
export type Period = (typeof PERIODS)[number]['id'];
export interface Nav {
	tab: Tab;
	statement: StatementId;
	period: Period;
	/** The source the visitor asked for; the effective one also depends on the ticker (see `resolveSource`). */
	source?: Source;
}

const pick = <T extends string>(options: readonly { id: T }[], value: string | null, fallback: T): T =>
	options.find((o) => o.id === value)?.id ?? fallback;

export function parseNav(params: URLSearchParams): Nav {
	const source = parseSource(params.get('source'));
	return {
		tab: pick(TABS, params.get('tab'), 'financials'),
		statement: pick(STATEMENTS, params.get('statement'), 'income'),
		period: pick(PERIODS, params.get('period'), 'annual'),
		...(source ? { source } : {})
	};
}

export function navHref(nav: Nav, symbol: string): string {
	const sp = new URLSearchParams();
	if (symbol) sp.set('symbol', symbol);
	sp.set('tab', nav.tab);
	sp.set('statement', nav.statement);
	sp.set('period', nav.period);
	if (nav.source) sp.set('source', nav.source);
	return `/financials?${sp}`;
}

/** Form action for the login form that keeps the page state in the URL (`?/login&symbol=...`). */
export function loginAction(nav: Nav, symbol: string): string {
	if (!symbol) return '?/login';
	return `?/login&${navHref(nav, symbol).split('?')[1]}`;
}

/** Where to go after logging in: back to the ticker that was asked for, else the plain page. Always a local path. */
export function afterLogin(params: URLSearchParams): string {
	const symbol = parseSymbol(params.get('symbol'));
	return symbol ? navHref(parseNav(params), symbol) : '/financials';
}
