// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable } from '../statements';
import type { StatementTable } from '../statements';
import { createCache } from './cache';
import { FmpError, fetchStatement } from './fmp';
import type { Kind, Statement } from './fmp';

export type StatementFetcher = (kind: Kind, symbol: string, apiKey: string) => Promise<Statement>;

export type FinancialsView =
	| { state: 'locked' }
	| { state: 'unconfigured' }
	| { state: 'idle' }
	| { state: 'invalid' }
	| {
			state: 'ready';
			symbol: string;
			tables: { kind: Kind; title: string; table: StatementTable | null; message: string | null }[];
	  };

const KINDS: { kind: Kind; title: string }[] = [
	{ kind: 'income', title: 'Income statement' },
	{ kind: 'balance', title: 'Balance sheet' },
	{ kind: 'cashflow', title: 'Cash flow statement' }
];

const cache = createCache<Statement>({ ttlMs: 24 * 60 * 60 * 1000 });

/** One cache entry per statement, so a failure of one is never stored as a result. */
export const cachedFetcher: StatementFetcher = (kind, symbol, apiKey) =>
	cache.get(`${kind}:${symbol}`, () => fetchStatement(kind, symbol, apiKey));

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
	rawSymbol: string | null;
	apiKey: string | undefined;
	fetcher?: StatementFetcher;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	if (!input.apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	const symbol = parseSymbol(input.rawSymbol);
	if (!symbol) return { state: 'invalid' };

	const fetcher = input.fetcher ?? cachedFetcher;
	const apiKey = input.apiKey;
	const tables = await Promise.all(
		KINDS.map(async ({ kind, title }) => {
			try {
				const table = buildTable(await fetcher(kind, symbol, apiKey));
				if (table.columns.length === 0) {
					return { kind, title, table: null, message: `No annual statements found for ${symbol}.` };
				}
				return { kind, title, table, message: null };
			} catch (error) {
				const detail = error instanceof FmpError ? error.kind : 'error';
				console.error(`FMP ${kind} statement for ${symbol} failed (${detail})`);
				return { kind, title, table: null, message: messageFor(error, symbol) };
			}
		})
	);
	return { state: 'ready', symbol, tables };
}
