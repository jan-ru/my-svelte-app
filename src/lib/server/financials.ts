// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable, formatEstimate, formatRatio } from '../statements';
import type { StatementTable } from '../statements';
import type { Nav, Period, Tab } from '../financials-nav';
import { oneYearWindow } from '../prices';
import { effectivePeriod, resolveSource, sourceLabel } from '../source';
import type { Source } from '../source';
import type { Kind, NewsItem, Peer, PricePoint, PriceTarget, Profile, Statement } from '../source-data';
import { cached } from './cache';
import { fetchEarnings, fetchEstimates, fetchRatios, fetchStatement } from './fmp';
import { fetchNews, fetchPeers, fetchPriceTarget, fetchPrices, fetchProfile } from './fmp-info';
import { SourceError } from './source-error';
import { fetchYahooNews, fetchYahooPrices, fetchYahooProfile, fetchYahooStatement } from './yahoo';

export type StatementFetcher = (kind: Kind, symbol: string, apiKey: string, period: Period) => Promise<Statement>;

/** Ratios, estimates and earnings all arrive in the shape of a statement. */
export type RatiosFetcher = (symbol: string, apiKey: string) => Promise<Statement>;
export type PriceTargetFetcher = (symbol: string, apiKey: string) => Promise<PriceTarget | null>;
export type PeersFetcher = (symbol: string, apiKey: string) => Promise<Peer[]>;
export type ProfileFetcher = (symbol: string, apiKey: string) => Promise<Profile | null>;
export type NewsFetcher = (symbol: string, apiKey: string) => Promise<NewsItem[]>;
export type PricesFetcher = (symbol: string, apiKey: string) => Promise<PricePoint[]>;

/** One complete set of fetchers per source; a view uses exactly one set. */
export interface SourceFetchers {
	statement: StatementFetcher;
	profile: ProfileFetcher;
	news: NewsFetcher;
	prices: PricesFetcher;
	/** Absent for a source that lacks them (Yahoo); the view then says so. */
	ratios?: RatiosFetcher;
	estimates?: RatiosFetcher;
	priceTarget?: PriceTargetFetcher;
	earnings?: RatiosFetcher;
	peers?: PeersFetcher;
}

export type FinancialsView =
	| { state: 'locked' }
	| { state: 'unconfigured' }
	| { state: 'idle' }
	| { state: 'invalid' }
	| { state: 'ready'; symbol: string; title: string; table: StatementTable | null; message: string | null; target?: PriceTarget | null }
	| { state: 'peers'; symbol: string; peers: Peer[]; message: string | null }
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

const DAY_MS = 24 * 60 * 60 * 1000;
export const PROFILE_TTL_MS = DAY_MS;
export const NEWS_TTL_MS = 15 * 60 * 1000;
export const PRICES_TTL_MS = 60 * 60 * 1000;
const EARNINGS_TTL_MS = 6 * 60 * 60 * 1000;

const bySymbol = (symbol: string, _apiKey: string) => symbol;
/** One cache entry per statement and period, so a failure of one is never stored as a result. */
const byStatement = (kind: Kind, symbol: string, _apiKey: string, period: Period) => `${kind}:${symbol}:${period}`;
const lastYear = () => oneYearWindow(new Date());

export const cachedFetcher: StatementFetcher = cached(DAY_MS, byStatement, fetchStatement);
export const cachedProfile: ProfileFetcher = cached(PROFILE_TTL_MS, bySymbol, (symbol, apiKey) => fetchProfile(symbol, apiKey));
export const cachedNews: NewsFetcher = cached(NEWS_TTL_MS, bySymbol, (symbol, apiKey) => fetchNews(symbol, apiKey));
export const cachedPrices: PricesFetcher = cached(PRICES_TTL_MS, bySymbol, (symbol, apiKey) => {
	const { from, to } = lastYear();
	return fetchPrices(symbol, apiKey, from, to);
});

/** Everything FMP serves. Tests replace single members through `loadFinancials({ fmp })`. */
export const fmpFetchers: SourceFetchers = {
	statement: cachedFetcher,
	profile: cachedProfile,
	news: cachedNews,
	prices: cachedPrices,
	ratios: cached(DAY_MS, bySymbol, (symbol, apiKey) => fetchRatios(symbol, apiKey)),
	estimates: cached(DAY_MS, bySymbol, (symbol, apiKey) => fetchEstimates(symbol, apiKey)),
	priceTarget: cached(DAY_MS, bySymbol, (symbol, apiKey) => fetchPriceTarget(symbol, apiKey)),
	earnings: cached(EARNINGS_TTL_MS, bySymbol, (symbol, apiKey) => fetchEarnings(symbol, apiKey)),
	peers: cached(DAY_MS, bySymbol, (symbol, apiKey) => fetchPeers(symbol, apiKey))
};

/** Everything Yahoo serves; ratios, estimates, earnings and peers are FMP only. */
export const yahooFetchers: SourceFetchers = {
	statement: cached(DAY_MS, byStatement, (kind, symbol, _apiKey, period) => fetchYahooStatement(kind, symbol, period)),
	profile: cached(PROFILE_TTL_MS, bySymbol, (symbol) => fetchYahooProfile(symbol)),
	news: cached(NEWS_TTL_MS, bySymbol, (symbol) => fetchYahooNews(symbol)),
	prices: cached(PRICES_TTL_MS, bySymbol, (symbol) => {
		const { from, to } = lastYear();
		return fetchYahooPrices(symbol, from, to);
	})
};

function messageFor(error: unknown, symbol: string, source: Source): string {
	const label = sourceLabel(source);
	if (error instanceof SourceError) {
		switch (error.kind) {
			case 'config':
				return 'The FMP key was not accepted. Check FMP_API_KEY.';
			case 'plan':
				return `${label} does not provide this for ${symbol} on your plan (${error.message}).`;
			case 'limit':
				return `${label} rate limit reached. Try again in a minute.`;
		}
	}
	return `${label} is unavailable right now. Try again shortly.`;
}

function failure(what: string, symbol: string, error: unknown, source: Source): string {
	console.error(`${sourceLabel(source)} ${what} for ${symbol} failed (${error instanceof SourceError ? error.kind : 'error'})`);
	return messageFor(error, symbol, source);
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
async function attempt<T>(what: string, ctx: TabContext, empty: T, run: () => Promise<T>): Promise<{ value: T; error: string | null }> {
	try {
		return { value: await run(), error: null };
	} catch (error) {
		return { value: empty, error: failure(what, ctx.symbol, error, ctx.source) };
	}
}

async function loadProfile(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, fetchers } = ctx;
	const { value: profile, error } = await attempt('profile', ctx, null, () => fetchers.profile(symbol, apiKey));
	return { state: 'profile', symbol, profile, message: error ?? (profile ? null : `No company profile found for ${symbol}.`) };
}

async function loadNews(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, fetchers } = ctx;
	const { value: items, error } = await attempt('news', ctx, [], () => fetchers.news(symbol, apiKey));
	return { state: 'news', symbol, items, message: error ?? (items.length ? null : `No recent news found for ${symbol}.`) };
}

async function loadPrices(ctx: TabContext): Promise<FinancialsView> {
	const { symbol, apiKey, fetchers } = ctx;
	const { value: points, error } = await attempt('price history', ctx, [], () => fetchers.prices(symbol, apiKey));
	return { state: 'price', symbol, points, message: error ?? (points.length ? null : `No price history found for ${symbol}.`) };
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
			const targetPromise = o.target?.(fetchers)?.(symbol, apiKey).catch((error: unknown) => {
				failure('price target', symbol, error, source);
				return null;
			});
			const statement = await fetcher(symbol, apiKey);
			// the reporting currency belongs to the filing; these are not amounts in it
			const table = { ...buildTable(statement, 'annual', o.format), currency: null };
			if (table.columns.length === 0) {
				return { state: 'ready', symbol, title, table: null, message: `${sourceLabel(source)} has no ${what.toLowerCase()} for ${symbol}.` };
			}
			return { state: 'ready', symbol, title, table, message: null, ...(targetPromise ? { target: await targetPromise } : {}) };
		} catch (error) {
			return { state: 'ready', symbol, title, table: null, message: failure(what.toLowerCase(), symbol, error, source) };
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
			return { state: 'ready', symbol, title, table: null, message: `${sourceLabel(source)} has no ${what} for ${symbol}. Price, news and company data may still be available in the other tabs.` };
		}
		return { state: 'ready', symbol, title, table, message: null };
	} catch (error) {
		return { state: 'ready', symbol, title, table: null, message: failure(`${kind} ${period} statement`, symbol, error, source) };
	}
}

/** One loader per tab. Typed over every `Tab`, so a tab added to `TABS` does not compile until it has one. */
const TAB_LOADERS: Record<Tab, TabLoader> = {
	financials: loadStatement,
	ratios: fmpTable({ what: 'Ratios', title: 'Financial ratios', fetcher: (f) => f.ratios, format: formatRatio }),
	estimates: fmpTable({ what: 'Estimates', title: 'Analyst estimates', fetcher: (f) => f.estimates, format: formatEstimate, target: (f) => f.priceTarget }),
	earnings: fmpTable({ what: 'Earnings', title: 'Earnings', fetcher: (f) => f.earnings, format: formatEstimate }),
	peers: loadPeers,
	news: loadNews,
	price: loadPrices,
	company: loadProfile
};

export async function loadFinancials(input: {
	authed: boolean;
	nav: Nav;
	rawSymbol: string | null;
	apiKey: string | undefined;
	/** Replace single FMP or Yahoo fetchers (tests inject these). */
	fmp?: Partial<SourceFetchers>;
	yahoo?: Partial<SourceFetchers>;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	const symbol = parseSymbol(input.rawSymbol);
	const source = resolveSource(input.nav.source, symbol ?? '');
	// only FMP needs the key; Yahoo works without one
	if (source === 'fmp' && !input.apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	if (!symbol) return { state: 'invalid' };

	const fetchers: SourceFetchers =
		source === 'fmp' ? { ...fmpFetchers, ...input.fmp } : { ...yahooFetchers, ...input.yahoo };
	return TAB_LOADERS[input.nav.tab]({
		symbol,
		apiKey: source === 'fmp' ? input.apiKey! : '',
		source,
		fetchers,
		nav: input.nav
	});
}
