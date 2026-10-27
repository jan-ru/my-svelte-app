// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable } from '../statements';
import type { StatementTable } from '../statements';
import type { Nav, Period } from '../financials-nav';
import { oneYearWindow } from '../prices';
import { effectivePeriod, resolveSource, sourceLabel } from '../source';
import type { Source } from '../source';
import { createCache } from './cache';
import { FmpError, fetchStatement } from './fmp';
import type { Kind, Statement } from './fmp';
import { fetchNews, fetchPrices, fetchProfile } from './fmp-info';
import type { NewsItem, PricePoint, Profile } from './fmp-info';
import { fetchYahooNews, fetchYahooPrices, fetchYahooProfile, fetchYahooStatement } from './yahoo';

export type StatementFetcher = (kind: Kind, symbol: string, apiKey: string, period: Period) => Promise<Statement>;

export type ProfileFetcher = (symbol: string, apiKey: string) => Promise<Profile | null>;
export type NewsFetcher = (symbol: string, apiKey: string) => Promise<NewsItem[]>;
export type PricesFetcher = (symbol: string, apiKey: string) => Promise<PricePoint[]>;

/** One complete set of fetchers per source; a view uses exactly one set. */
export interface SourceFetchers {
	statement: StatementFetcher;
	profile: ProfileFetcher;
	news: NewsFetcher;
	prices: PricesFetcher;
}

export type FinancialsView =
	| { state: 'locked' }
	| { state: 'unconfigured' }
	| { state: 'idle' }
	| { state: 'invalid' }
	| { state: 'ready'; symbol: string; title: string; table: StatementTable | null; message: string | null }
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
					prices: input.pricesFetcher ?? cachedPrices
				}
			: { ...yahooFetchers, ...input.yahoo };
	if (input.nav.tab === 'company') return loadProfile(symbol, apiKey, fetchers.profile, source);
	if (input.nav.tab === 'news') return loadNews(symbol, apiKey, fetchers.news, source);
	if (input.nav.tab === 'price') return loadPrices(symbol, apiKey, fetchers.prices, source);

	const { statement: kind } = input.nav;
	// a source that cannot serve the period gets the annual view instead (FMP has no TTM on this plan)
	const period = effectivePeriod(source, input.nav.period);
	const title = statementTitle(kind, period);
	try {
		const table = buildTable(await fetchers.statement(kind, symbol, apiKey, period), period);
		if (table.columns.length === 0) {
			const what = period === 'ttm' ? 'trailing-twelve-month figures' : 'annual statements';
			return { state: 'ready', symbol, title, table: null, message: `No ${what} found for ${symbol}.` };
		}
		return { state: 'ready', symbol, title, table, message: null };
	} catch (error) {
		return { state: 'ready', symbol, title, table: null, message: failure(`${kind} ${period} statement`, symbol, error, source) };
	}
}
