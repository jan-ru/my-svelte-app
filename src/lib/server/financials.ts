// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable, formatEstimate, formatRatio } from '../statements';
import type { StatementTable } from '../statements';
import type { Nav, Period, Tab } from '../financials-nav';
import { effectivePeriod, resolveSource, sourceKeyName, sourceLabel } from '../source';
import type { Source } from '../source';
import type { Kind, NewsItem, Peer, PricePoint, PriceTarget, Profile, SupplyChain } from '../source-data';
import { failureKind, sourceFailureMessage } from './source-error';
import {
	fetchersOf,
	keyOf,
	type RatiosFetcher,
	type PriceTargetFetcher,
	type SourceFetchers
} from './financial-sources';

export type FinancialsView =
	| { state: 'locked' }
	| { state: 'unconfigured' }
	| { state: 'idle' }
	| { state: 'invalid' }
	| {
			state: 'ready';
			symbol: string;
			title: string;
			table: StatementTable | null;
			message: string | null;
			target?: PriceTarget | null;
	  }
	| { state: 'peers'; symbol: string; peers: Peer[]; message: string | null }
	| { state: 'supply'; symbol: string; chain: SupplyChain | null; message: string | null }
	| { state: 'profile'; symbol: string; profile: Profile | null; message: string | null }
	| { state: 'news'; symbol: string; items: NewsItem[]; message: string | null }
	| { state: 'price'; symbol: string; points: PricePoint[]; message: string | null };

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

function failure(what: string, symbol: string, error: unknown, source: Source): string {
	console.error(`${sourceLabel(source)} ${what} for ${symbol} failed (${failureKind(error)})`);
	return sourceFailureMessage(error, symbol, sourceLabel(source), sourceKeyName(source) ?? undefined);
}

/** What a tab loader needs: the ticker, the key, the one source that serves this view and that source's fetchers. */
interface TabContext {
	symbol: string;
	apiKey: string;
	source: Source;
	fetchers: SourceFetchers;
	nav: Nav;
}
type TabLoader = (ctx: TabContext) => Promise<FinancialsView>;

/** Run one fetch for a tab: its result, or `empty` and a message for the visitor when it fails (the failure is logged). */
async function attempt<T>(
	what: string,
	ctx: TabContext,
	empty: T,
	run: () => Promise<T>
): Promise<{ value: T; error: string | null }> {
	try {
		return { value: await run(), error: null };
	} catch (error) {
		return { value: empty, error: failure(what, ctx.symbol, error, ctx.source) };
	}
}

async function loadProfile(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, fetchers } = ctx;
	const { value: profile, error } = await attempt('profile', ctx, null, () => fetchers.profile(symbol, apiKey));
	return {
		state: 'profile',
		symbol,
		profile,
		message: error ?? (profile ? null : `No company profile found for ${symbol}.`)
	};
}

async function loadNews(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, source, fetchers } = ctx;
	const fetchNews = fetchers.news;
	if (!fetchNews) {
		const message = `${sourceLabel(source)} has no company news. Choose FMP or Yahoo Finance.`;
		return { state: 'news', symbol, items: [], message };
	}
	const { value: items, error } = await attempt('news', ctx, [], () => fetchNews(symbol, apiKey));
	return {
		state: 'news',
		symbol,
		items,
		message: error ?? (items.length ? null : `No recent news found for ${symbol}.`)
	};
}

async function loadPrices(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, fetchers } = ctx;
	const { value: points, error } = await attempt('price history', ctx, [], () => fetchers.prices(symbol, apiKey));
	return {
		state: 'price',
		symbol,
		points,
		message: error ?? (points.length ? null : `No price history found for ${symbol}.`)
	};
}

async function loadSupply(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, source, fetchers } = ctx;
	const fetchChain = fetchers.supplyChain;
	if (!fetchChain) {
		const message = `The supply chain is only available from Eulerpool, not ${sourceLabel(source)}. Choose Eulerpool.`;
		return { state: 'supply', symbol, chain: null, message };
	}
	const { value, error } = await attempt<SupplyChain | null>('supply chain', ctx, null, () =>
		fetchChain(symbol, apiKey)
	);
	const chain = value && value.total > 0 ? value : null;
	return {
		state: 'supply',
		symbol,
		chain,
		message: error ?? (chain ? null : `Eulerpool lists no suppliers or customers for ${symbol}.`)
	};
}

const unavailable = (what: string, source: Source) =>
	`${what} are only available from Financial Modeling Prep, not ${sourceLabel(source)}. Choose FMP for a US ticker.`;

async function loadPeers(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, source, fetchers } = ctx;
	const fetchPeers = fetchers.peers;
	if (!fetchPeers) return { state: 'peers', symbol, peers: [], message: unavailable('Peers', source) };
	const { value: peers, error } = await attempt('peers', ctx, [], () => fetchPeers(symbol, apiKey));
	return { state: 'peers', symbol, peers, message: error ?? (peers.length ? null : `No peers found for ${symbol}.`) };
}

/** A table tab that only FMP serves: ratios, estimates and earnings. */
function fmpTable(o: {
	what: string;
	title: string;
	fetcher: (fetchers: SourceFetchers) => RatiosFetcher | undefined;
	format: (key: string, value: number | null) => string;
	/** Optional extra: a failure here is logged but never hides the table. */
	target?: (fetchers: SourceFetchers) => PriceTargetFetcher | undefined;
}): TabLoader {
	return async ({ symbol, apiKey, source, fetchers }) => {
		const { what, title } = o;
		const fetcher = o.fetcher(fetchers);
		if (!fetcher) return { state: 'ready', symbol, title, table: null, message: unavailable(what, source) };
		try {
			const targetPromise = o
				.target?.(fetchers)?.(symbol, apiKey)
				.catch((error: unknown) => {
					failure('price target', symbol, error, source);
					return null;
				});
			const statement = await fetcher(symbol, apiKey);
			// the reporting currency belongs to the filing; these are not amounts in it
			const table = { ...buildTable(statement, 'annual', o.format), currency: null };
			if (table.columns.length === 0) {
				return {
					state: 'ready',
					symbol,
					title,
					table: null,
					message: `${sourceLabel(source)} has no ${what.toLowerCase()} for ${symbol}.`
				};
			}
			return {
				state: 'ready',
				symbol,
				title,
				table,
				message: null,
				...(targetPromise ? { target: await targetPromise } : {})
			};
		} catch (error) {
			return {
				state: 'ready',
				symbol,
				title,
				table: null,
				message: failure(what.toLowerCase(), symbol, error, source)
			};
		}
	};
}

async function loadStatement({ symbol, apiKey, source, fetchers, nav }: TabContext): Promise<FinancialsView> {
	const { statement: kind } = nav;
	// a source that cannot serve the period gets the annual view instead (FMP has no TTM on this plan)
	const period = effectivePeriod(source, nav.period);
	const title = statementTitle(kind, period);
	try {
		const table = buildTable(await fetchers.statement(kind, symbol, apiKey, period), period);
		if (table.columns.length === 0) {
			const what = period === 'ttm' ? 'trailing-twelve-month figures' : 'annual statements';
			return {
				state: 'ready',
				symbol,
				title,
				table: null,
				message: `${sourceLabel(source)} has no ${what} for ${symbol}. Price, news and company data may still be available in the other tabs.`
			};
		}
		return { state: 'ready', symbol, title, table, message: null };
	} catch (error) {
		return {
			state: 'ready',
			symbol,
			title,
			table: null,
			message: failure(`${kind} ${period} statement`, symbol, error, source)
		};
	}
}

/** One loader per tab. Typed over every `Tab`, so a tab added to `TABS` does not compile until it has one. */
const TAB_LOADERS: Record<Tab, TabLoader> = {
	financials: loadStatement,
	ratios: fmpTable({ what: 'Ratios', title: 'Financial ratios', fetcher: (f) => f.ratios, format: formatRatio }),
	estimates: fmpTable({
		what: 'Estimates',
		title: 'Analyst estimates',
		fetcher: (f) => f.estimates,
		format: formatEstimate,
		target: (f) => f.priceTarget
	}),
	earnings: fmpTable({ what: 'Earnings', title: 'Earnings', fetcher: (f) => f.earnings, format: formatEstimate }),
	peers: loadPeers,
	supply: loadSupply,
	news: loadNews,
	price: loadPrices,
	company: loadProfile
};

export async function loadFinancials(input: {
	authed: boolean;
	nav: Nav;
	rawSymbol: string | null;
	apiKey: string | undefined;
	/** The Eulerpool key; `apiKey` is FMP's. */
	eulerpoolKey?: string | undefined;
	/** Replace single fetchers of a source (tests inject these). */
	fmp?: Partial<SourceFetchers>;
	yahoo?: Partial<SourceFetchers>;
	eulerpool?: Partial<SourceFetchers>;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	const symbol = parseSymbol(input.rawSymbol);
	const source = resolveSource(input.nav.source, symbol ?? '');
	// FMP and Eulerpool need a key; Yahoo works without one
	const apiKey = keyOf(source, { fmp: input.apiKey, eulerpool: input.eulerpoolKey });
	if (sourceKeyName(source) !== null && !apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	if (!symbol) return { state: 'invalid' };

	return TAB_LOADERS[input.nav.tab]({
		symbol,
		apiKey,
		source,
		fetchers: fetchersOf(source, { fmp: input.fmp, yahoo: input.yahoo, eulerpool: input.eulerpool }),
		nav: input.nav
	});
}
