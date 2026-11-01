// src/lib/server/yahoo.ts
import type { Period } from '../financials-nav';
import { NEWS_LIMIT } from '../source-data';
import type { Kind, NewsItem, PricePoint, Profile, Statement } from '../source-data';
import { field, num, str } from './coerce';
import { SourceError } from './source-error';
import { parseYahooNews, parseYahooPrices, parseYahooProfile, parseYahooStatement } from './yahoo-parse';

type ModuleOptions = { validateResult: false };
type SummaryModule = 'assetProfile' | 'financialData' | 'price';
type StatementModule = 'financials' | 'balance-sheet' | 'cash-flow';

/** The few `yahoo-finance2` calls we use, so tests can pass a fake. Results are `unknown` on purpose: our parsers validate them. */
export interface YahooClient {
	chart(
		symbol: string,
		options: { period1: Date; period2: Date; interval: '1d' },
		moduleOptions?: ModuleOptions
	): Promise<unknown>;
	quoteSummary(symbol: string, options: { modules: SummaryModule[] }, moduleOptions?: ModuleOptions): Promise<unknown>;
	search(
		query: string,
		options: { newsCount: number; quotesCount: number },
		moduleOptions?: ModuleOptions
	): Promise<unknown>;
	fundamentalsTimeSeries(
		symbol: string,
		options: { period1: Date; type: 'annual' | 'trailing'; module: StatementModule },
		moduleOptions?: ModuleOptions
	): Promise<unknown>;
}

// Our parsers check every field, so the library's own (strict, often outdated) result validation stays off.
const OPTIONS: ModuleOptions = { validateResult: false };
const MODULES: Record<Kind, StatementModule> = { income: 'financials', balance: 'balance-sheet', cashflow: 'cash-flow' };

let shared: Promise<YahooClient> | undefined;

/** One client per server instance, created on first use so other pages never load the library. */
export function defaultClient(): Promise<YahooClient> {
	shared ??= import('yahoo-finance2').then(({ default: YahooFinance }) => {
		const yf = new YahooFinance({
			suppressNotices: ['yahooSurvey'],
			logger: { info() {}, warn() {}, error() {}, debug() {}, dir() {} }
		});
		return {
			chart: (symbol, options, moduleOptions) => yf.chart(symbol, options, moduleOptions),
			quoteSummary: (symbol, options, moduleOptions) => yf.quoteSummary(symbol, options, moduleOptions),
			search: (query, options, moduleOptions) => yf.search(query, options, moduleOptions),
			fundamentalsTimeSeries: (symbol, options, moduleOptions) => yf.fundamentalsTimeSeries(symbol, options, moduleOptions)
		} satisfies YahooClient;
	});
	return shared;
}

const NOT_FOUND = /not found|no data found|no fundamentals|delisted|invalid symbol/i;
const RATE_LIMITED = /429|too many requests/i;

/** Fixed messages only: library errors can carry URLs and tokens. */
function mapError(error: unknown): SourceError {
	if (error instanceof SourceError) return error;
	const text = error instanceof Error ? `${error.name} ${error.message}` : '';
	if (RATE_LIMITED.test(text)) return new SourceError('limit', 'Yahoo Finance rate limit reached');
	return new SourceError('unavailable', 'Yahoo Finance is unavailable');
}

async function tolerant<T>(run: () => Promise<T>, empty: T): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof Error && NOT_FOUND.test(error.message)) return empty;
		throw mapError(error);
	}
}

export function fetchYahooPrices(symbol: string, from: string, to: string, client?: YahooClient): Promise<PricePoint[]> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		const result = await c.chart(
			symbol,
			{ period1: new Date(`${from}T00:00:00Z`), period2: new Date(`${to}T23:59:59Z`), interval: '1d' },
			OPTIONS
		);
		return parseYahooPrices(field(result, 'quotes'), num(field(field(result, 'meta'), 'gmtoffset')) ?? 0);
	}, []);
}

export function fetchYahooProfile(symbol: string, client?: YahooClient): Promise<Profile | null> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		return parseYahooProfile(await c.quoteSummary(symbol, { modules: ['assetProfile', 'price'] }, OPTIONS));
	}, null);
}

/** Yahoo's news is a text search, so search for the company name; the bare ticker finds little outside the US. */
export function fetchYahooNews(symbol: string, client?: YahooClient): Promise<NewsItem[]> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		let query = symbol;
		try {
			const price = field(await c.quoteSummary(symbol, { modules: ['price'] }, OPTIONS), 'price');
			query = str(field(price, 'longName')) ?? str(field(price, 'shortName')) ?? symbol;
		} catch {
			// the ticker is a fine fallback query
		}
		const result = await c.search(query, { newsCount: NEWS_LIMIT, quotesCount: 0 }, OPTIONS);
		return parseYahooNews(field(result, 'news') ?? []);
	}, []);
}

async function reportingCurrency(c: YahooClient, symbol: string): Promise<string | null> {
	try {
		const s = await c.quoteSummary(symbol, { modules: ['financialData', 'price'] }, OPTIONS);
		return str(field(field(s, 'financialData'), 'financialCurrency')) ?? str(field(field(s, 'price'), 'currency'));
	} catch {
		return null;
	}
}

export function fetchYahooStatement(kind: Kind, symbol: string, period: Period, client?: YahooClient): Promise<Statement> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		const module = MODULES[kind];
		const year = new Date().getUTCFullYear();
		// TTM income and cash flow come from the trailing series; the balance sheet has none and uses the latest annual one
		const wantsTrailing = period === 'ttm' && kind !== 'balance';
		const annual = wantsTrailing
			? []
			: await c.fundamentalsTimeSeries(symbol, { period1: new Date(Date.UTC(year - 7, 0, 1)), type: 'annual', module }, OPTIONS);
		const trailing = wantsTrailing
			? await c.fundamentalsTimeSeries(symbol, { period1: new Date(Date.UTC(year - 2, 0, 1)), type: 'trailing', module }, OPTIONS)
			: null;
		return parseYahooStatement(kind, annual, trailing, period, await reportingCurrency(c, symbol));
	}, { lines: [], years: [] });
}
