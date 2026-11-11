// The fetchers behind /financials: the shape of one source's set, the three sets (FMP, Yahoo, Eulerpool) with their
// caches, and the choice of set and key for a source. I/O wiring only; the tab loaders are in financials.ts.
import type { Period } from '../financials-nav';
import { oneYearWindow } from '../prices';
import type { Source } from '../source';
import type { Kind, NewsItem, Peer, PricePoint, PriceTarget, Profile, Statement, SupplyChain } from '../source-data';
import { cached } from './cache';
import {
	fetchEulerpoolPrices,
	fetchEulerpoolProfile,
	fetchEulerpoolStatement,
	fetchEulerpoolSupplyChain
} from './eulerpool';
import { fetchEarnings, fetchEstimates, fetchRatios, fetchStatement } from './fmp';
import { fetchNews, fetchPeers, fetchPriceTarget, fetchPrices, fetchProfile } from './fmp-info';
import { fetchYahooNews, fetchYahooPrices, fetchYahooProfile, fetchYahooStatement } from './yahoo';

export type StatementFetcher = (kind: Kind, symbol: string, apiKey: string, period: Period) => Promise<Statement>;

/** Ratios, estimates and earnings all arrive in the shape of a statement. */
export type RatiosFetcher = (symbol: string, apiKey: string) => Promise<Statement>;
export type PriceTargetFetcher = (symbol: string, apiKey: string) => Promise<PriceTarget | null>;
export type PeersFetcher = (symbol: string, apiKey: string) => Promise<Peer[]>;
export type ProfileFetcher = (symbol: string, apiKey: string) => Promise<Profile | null>;
export type NewsFetcher = (symbol: string, apiKey: string) => Promise<NewsItem[]>;
export type PricesFetcher = (symbol: string, apiKey: string) => Promise<PricePoint[]>;
export type SupplyChainFetcher = (symbol: string, apiKey: string) => Promise<SupplyChain>;

/** One complete set of fetchers per source; a view uses exactly one set. */
export interface SourceFetchers {
	statement: StatementFetcher;
	profile: ProfileFetcher;
	prices: PricesFetcher;
	/** Absent for a source that lacks them (Eulerpool has no company news); the view then says so. */
	news?: NewsFetcher;
	/** Absent for a source that lacks them (Yahoo, Eulerpool); the view then says so. */
	ratios?: RatiosFetcher;
	estimates?: RatiosFetcher;
	priceTarget?: PriceTargetFetcher;
	earnings?: RatiosFetcher;
	peers?: PeersFetcher;
	/** Eulerpool only; the tab says so for any other source. */
	supplyChain?: SupplyChainFetcher;
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
export const cachedProfile: ProfileFetcher = cached(PROFILE_TTL_MS, bySymbol, (symbol, apiKey) =>
	fetchProfile(symbol, apiKey)
);
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

/** Everything Eulerpool serves: statements (annual only), profile, prices and the supply chain. Ratios, estimates, earnings, peers and news are not offered. */
export const eulerpoolFetchers: SourceFetchers = {
	statement: cached(DAY_MS, byStatement, (kind, symbol, apiKey) => fetchEulerpoolStatement(kind, symbol, apiKey)),
	profile: cached(PROFILE_TTL_MS, bySymbol, (symbol, apiKey) => fetchEulerpoolProfile(symbol, apiKey)),
	prices: cached(PRICES_TTL_MS, bySymbol, (symbol, apiKey) => fetchEulerpoolPrices(symbol, apiKey)),
	supplyChain: cached(DAY_MS, bySymbol, (symbol, apiKey) => fetchEulerpoolSupplyChain(symbol, apiKey))
};

/** The fetchers of a source, with single members replaced (tests inject these). */
export function fetchersOf(
	source: Source,
	overrides: Partial<Record<Source, Partial<SourceFetchers>>> = {}
): SourceFetchers {
	const base = source === 'fmp' ? fmpFetchers : source === 'eulerpool' ? eulerpoolFetchers : yahooFetchers;
	return { ...base, ...overrides[source] };
}

/** The API key a source needs, or an empty string for a source without one. */
export function keyOf(
	source: Source,
	keys: { readonly fmp?: string | undefined; readonly eulerpool?: string | undefined }
): string {
	return source === 'fmp' ? (keys.fmp ?? '') : source === 'eulerpool' ? (keys.eulerpool ?? '') : '';
}
