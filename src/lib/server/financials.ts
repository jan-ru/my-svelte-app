// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable, formatEstimate, formatRatio } from '../statements';
import type { StatementTable } from '../statements';
import type { Nav, Period } from '../financials-nav';
import { oneYearWindow } from '../prices';
import { effectivePeriod, resolveSource, sourceLabel } from '../source';
import type { Source } from '../source';
import { createCache } from './cache';
import { FmpError, fetchEarnings, fetchEstimates, fetchRatios, fetchStatement } from './fmp';
import type { Kind, Statement } from './fmp';
import { fetchNews, fetchPeers, fetchPriceTarget, fetchPrices, fetchProfile } from './fmp-info';
import type { NewsItem, Peer, PricePoint, PriceTarget, Profile } from './fmp-info';
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

const cache = createCache<Statement>({ ttlMs: 24 * 60 * 60 * 1000 });

/** One cache entry per statement and period, so a failure of one is never stored as a result. */
export const cachedFetcher: StatementFetcher = (kind, symbol, apiKey, period) =>
	cache.get(period === 'ttm' ? `${kind}:${symbol}:ttm` : `${kind}:${symbol}`, () =>
		fetchStatement(kind, symbol, apiKey, period)
	);

const DAY_MS = 24 * 60 * 60 * 1000;
const ratiosCache = createCache<Statement>({ ttlMs: DAY_MS });
const estimatesCache = createCache<Statement>({ ttlMs: DAY_MS });
const targetCache = createCache<PriceTarget | null>({ ttlMs: DAY_MS });
const earningsCache = createCache<Statement>({ ttlMs: 6 * 60 * 60 * 1000 });
const peersCache = createCache<Peer[]>({ ttlMs: DAY_MS });
export const cachedRatios: RatiosFetcher = (symbol, apiKey) =>
	ratiosCache.get(symbol, () => fetchRatios(symbol, apiKey));
export const cachedEstimates: RatiosFetcher = (symbol, apiKey) =>
	estimatesCache.get(symbol, () => fetchEstimates(symbol, apiKey));
export const cachedPriceTarget: PriceTargetFetcher = (symbol, apiKey) =>
	targetCache.get(symbol, () => fetchPriceTarget(symbol, apiKey));
export const cachedEarnings: RatiosFetcher = (symbol, apiKey) =>
	earningsCache.get(symbol, () => fetchEarnings(symbol, apiKey));
export const cachedPeers: PeersFetcher = (symbol, apiKey) =>
	peersCache.get(symbol, () => fetchPeers(symbol, apiKey));

export const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
export const NEWS_TTL_MS = 15 * 60 * 1000;
export const PRICES_TTL_MS = 60 * 60 * 1000;
const profileCache = createCache<Profile | null>({ ttlMs: PROFILE_TTL_MS, now: () => Date.now() });
const newsCache = createCache<NewsItem[]>({ ttlMs: NEWS_TTL_MS, now: () => Date.now() });
const pricesCache = createCache<PricePoint[]>({ ttlMs: PRICES_TTL_MS, now: () => Date.now() });
export const cachedProfile: ProfileFetcher = (symbol, apiKey) =>
	profileCache.get(symbol, () => fetchProfile(symbol, apiKey));
export const cachedNews: NewsFetcher = (symbol, apiKey) =>
	newsCache.get(symbol, () => fetchNews(symbol, apiKey));
export const cachedPrices: PricesFetcher = (symbol, apiKey) =>
	pricesCache.get(symbol, () => {
		const { from, to } = oneYearWindow(new Date());
		return fetchPrices(symbol, apiKey, from, to);
	});

const yahooStatementCache = createCache<Statement>({ ttlMs: 24 * 60 * 60 * 1000, now: () => Date.now() });
const yahooProfileCache = createCache<Profile | null>({ ttlMs: PROFILE_TTL_MS, now: () => Date.now() });
const yahooNewsCache = createCache<NewsItem[]>({ ttlMs: NEWS_TTL_MS, now: () => Date.now() });
const yahooPricesCache = createCache<PricePoint[]>({ ttlMs: PRICES_TTL_MS, now: () => Date.now() });

export const yahooFetchers: SourceFetchers = {
	statement: (kind, symbol, _apiKey, period) =>
		yahooStatementCache.get(`${kind}:${symbol}:${period}`, () => fetchYahooStatement(kind, symbol, period)),
	profile: (symbol) => yahooProfileCache.get(symbol, () => fetchYahooProfile(symbol)),
	news: (symbol) => yahooNewsCache.get(symbol, () => fetchYahooNews(symbol)),
	prices: (symbol) =>
		yahooPricesCache.get(symbol, () => {
			const { from, to } = oneYearWindow(new Date());
			return fetchYahooPrices(symbol, from, to);
		})
};

function messageFor(error: unknown, symbol: string, source: Source): string {
	const label = sourceLabel(source);
	if (error instanceof FmpError) {
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
	console.error(`${sourceLabel(source)} ${what} for ${symbol} failed (${error instanceof FmpError ? error.kind : 'error'})`);
	return messageFor(error, symbol, source);
}

async function loadProfile(symbol: string, apiKey: string, fetcher: ProfileFetcher, source: Source): Promise<FinancialsView> {
	try {
		const profile = await fetcher(symbol, apiKey);
		return {
			state: 'profile',
			symbol,
			profile,
			message: profile ? null : `No company profile found for ${symbol}.`
		};
	} catch (error) {
		return { state: 'profile', symbol, profile: null, message: failure('profile', symbol, error, source) };
	}
}

async function loadNews(symbol: string, apiKey: string, fetcher: NewsFetcher, source: Source): Promise<FinancialsView> {
	try {
		const items = await fetcher(symbol, apiKey);
		return { state: 'news', symbol, items, message: items.length ? null : `No recent news found for ${symbol}.` };
	} catch (error) {
		return { state: 'news', symbol, items: [], message: failure('news', symbol, error, source) };
	}
}

async function loadPrices(symbol: string, apiKey: string, fetcher: PricesFetcher, source: Source): Promise<FinancialsView> {
	try {
		const points = await fetcher(symbol, apiKey);
		return { state: 'price', symbol, points, message: points.length ? null : `No price history found for ${symbol}.` };
	} catch (error) {
		return { state: 'price', symbol, points: [], message: failure('price history', symbol, error, source) };
	}
}

const unavailable = (what: string, source: Source) =>
	`${what} are only available from Financial Modeling Prep, not ${sourceLabel(source)}. Choose FMP for a US ticker.`;

/** A table tab that only FMP serves: ratios, estimates and earnings. */
async function loadFmpTable(o: {
	what: string;
	title: string;
	symbol: string;
	apiKey: string;
	source: Source;
	fetcher: RatiosFetcher | undefined;
	format: (key: string, value: number | null) => string;
	/** Optional extra: a failure here is logged but never hides the table. */
	targetFetcher?: PriceTargetFetcher;
}): Promise<FinancialsView> {
	const { what, title, symbol, apiKey, source } = o;
	if (!o.fetcher) return { state: 'ready', symbol, title, table: null, message: unavailable(what, source) };
	try {
		const targetPromise = o.targetFetcher
			? o.targetFetcher(symbol, apiKey).catch((error: unknown) => {
					failure('price target', symbol, error, source);
					return null;
				})
			: undefined;
		const statement = await o.fetcher(symbol, apiKey);
		// the reporting currency belongs to the filing; these are not amounts in it
		const table = { ...buildTable(statement, 'annual', o.format), currency: null };
		if (table.columns.length === 0) {
			return { state: 'ready', symbol, title, table: null, message: `${sourceLabel(source)} has no ${what.toLowerCase()} for ${symbol}.` };
		}
		return { state: 'ready', symbol, title, table, message: null, ...(targetPromise ? { target: await targetPromise } : {}) };
	} catch (error) {
		return { state: 'ready', symbol, title, table: null, message: failure(what.toLowerCase(), symbol, error, source) };
	}
}

async function loadPeers(symbol: string, apiKey: string, fetcher: PeersFetcher | undefined, source: Source): Promise<FinancialsView> {
	if (!fetcher) return { state: 'peers', symbol, peers: [], message: unavailable('Peers', source) };
	try {
		const peers = await fetcher(symbol, apiKey);
		return { state: 'peers', symbol, peers, message: peers.length ? null : `No peers found for ${symbol}.` };
	} catch (error) {
		return { state: 'peers', symbol, peers: [], message: failure('peers', symbol, error, source) };
	}
}

export async function loadFinancials(input: {
	authed: boolean;
	nav: Nav;
	rawSymbol: string | null;
	apiKey: string | undefined;
	/** FMP fetchers (tests inject these). */
	fetcher?: StatementFetcher;
	profileFetcher?: ProfileFetcher;
	newsFetcher?: NewsFetcher;
	pricesFetcher?: PricesFetcher;
	ratiosFetcher?: RatiosFetcher;
	estimatesFetcher?: RatiosFetcher;
	priceTargetFetcher?: PriceTargetFetcher;
	earningsFetcher?: RatiosFetcher;
	peersFetcher?: PeersFetcher;
	/** Yahoo fetchers (tests inject these). */
	yahoo?: Partial<SourceFetchers>;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	const symbol = parseSymbol(input.rawSymbol);
	const source = resolveSource(input.nav.source, symbol ?? '');
	// only FMP needs the key; Yahoo works without one
	if (source === 'fmp' && !input.apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	if (!symbol) return { state: 'invalid' };

	const apiKey = source === 'fmp' ? input.apiKey! : '';
	const fetchers: SourceFetchers =
		source === 'fmp'
			? {
					statement: input.fetcher ?? cachedFetcher,
					profile: input.profileFetcher ?? cachedProfile,
					news: input.newsFetcher ?? cachedNews,
					prices: input.pricesFetcher ?? cachedPrices,
					ratios: input.ratiosFetcher ?? cachedRatios,
					estimates: input.estimatesFetcher ?? cachedEstimates,
					priceTarget: input.priceTargetFetcher ?? cachedPriceTarget,
					earnings: input.earningsFetcher ?? cachedEarnings,
					peers: input.peersFetcher ?? cachedPeers
				}
			: { ...yahooFetchers, ...input.yahoo };
	if (input.nav.tab === 'company') return loadProfile(symbol, apiKey, fetchers.profile, source);
	if (input.nav.tab === 'news') return loadNews(symbol, apiKey, fetchers.news, source);
	if (input.nav.tab === 'price') return loadPrices(symbol, apiKey, fetchers.prices, source);
	const common = { symbol, apiKey, source };
	if (input.nav.tab === 'ratios') {
		return loadFmpTable({ ...common, what: 'Ratios', title: 'Financial ratios', fetcher: fetchers.ratios, format: formatRatio });
	}
	if (input.nav.tab === 'estimates') {
		return loadFmpTable({ ...common, what: 'Estimates', title: 'Analyst estimates', fetcher: fetchers.estimates, format: formatEstimate, targetFetcher: fetchers.priceTarget });
	}
	if (input.nav.tab === 'earnings') {
		return loadFmpTable({ ...common, what: 'Earnings', title: 'Earnings', fetcher: fetchers.earnings, format: formatEstimate });
	}
	if (input.nav.tab === 'peers') return loadPeers(symbol, apiKey, fetchers.peers, source);

	const { statement: kind } = input.nav;
	// a source that cannot serve the period gets the annual view instead (FMP has no TTM on this plan)
	const period = effectivePeriod(source, input.nav.period);
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
