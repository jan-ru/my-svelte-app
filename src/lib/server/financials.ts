// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable } from '../statements';
import type { StatementTable } from '../statements';
import type { Nav, Period } from '../financials-nav';
import { createCache } from './cache';
import { FmpError, fetchStatement } from './fmp';
import type { Kind, Statement } from './fmp';

export type StatementFetcher = (kind: Kind, symbol: string, apiKey: string, period: Period) => Promise<Statement>;

export type FinancialsView =
	| { state: 'locked' }
	| { state: 'unconfigured' }
	| { state: 'idle' }
	| { state: 'invalid' }
	| { state: 'soon' }
	| { state: 'ready'; symbol: string; title: string; table: StatementTable | null; message: string | null };

const TITLES: Record<Kind, string> = {
	income: 'Income statement',
	balance: 'Balance sheet',
	cashflow: 'Cash flow statement'
};

export function statementTitle(kind: Kind, period: Period): string {
	if (period === 'annual') return TITLES[kind];
	// a balance sheet is a snapshot, so FMP's "TTM" balance sheet is simply the latest one
	return kind === 'balance' ? 'Latest balance sheet' : `${TITLES[kind]} (trailing twelve months)`;
}

const cache = createCache<Statement>({ ttlMs: 24 * 60 * 60 * 1000 });

/** One cache entry per statement and period, so a failure of one is never stored as a result. */
export const cachedFetcher: StatementFetcher = (kind, symbol, apiKey, period) =>
	cache.get(period === 'ttm' ? `${kind}:${symbol}:ttm` : `${kind}:${symbol}`, () =>
		fetchStatement(kind, symbol, apiKey, period)
	);

function messageFor(error: unknown, symbol: string): string {
	if (error instanceof FmpError) {
		switch (error.kind) {
			case 'config':
				return 'The FMP key was not accepted. Check FMP_API_KEY.';
			case 'plan':
				return `FMP does not provide this for ${symbol} on your plan (${error.message}).`;
			case 'limit':
				return 'FMP rate limit reached. Try again in a minute.';
		}
	}
	return 'FMP is unavailable right now. Try again shortly.';
}

export async function loadFinancials(input: {
	authed: boolean;
	nav: Nav;
	rawSymbol: string | null;
	apiKey: string | undefined;
	fetcher?: StatementFetcher;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	if (input.nav.tab !== 'financials') return { state: 'soon' };
	if (!input.apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	const symbol = parseSymbol(input.rawSymbol);
	if (!symbol) return { state: 'invalid' };

	const { statement: kind, period } = input.nav;
	const title = statementTitle(kind, period);
	const fetcher = input.fetcher ?? cachedFetcher;
	try {
		const table = buildTable(await fetcher(kind, symbol, input.apiKey, period), period);
		if (table.columns.length === 0) {
			const what = period === 'ttm' ? 'trailing-twelve-month figures' : 'annual statements';
			return { state: 'ready', symbol, title, table: null, message: `No ${what} found for ${symbol}.` };
		}
		return { state: 'ready', symbol, title, table, message: null };
	} catch (error) {
		const detail = error instanceof FmpError ? error.kind : 'error';
		console.error(`FMP ${kind} ${period} statement for ${symbol} failed (${detail})`);
		return { state: 'ready', symbol, title, table: null, message: messageFor(error, symbol) };
	}
}
