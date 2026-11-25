// src/lib/server/yahoo.ts
import { Data, Effect } from 'effect';
import type { Period } from '../financials-nav';
import { NEWS_LIMIT } from '../source-data';
import type { Kind, NewsItem, PricePoint, Profile, Statement } from '../source-data';
import { field, num, str } from './coerce';
import { FETCH_TIMEOUT_MS } from './http';
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
const MODULES: Record<Kind, StatementModule> = {
	income: 'financials',
	balance: 'balance-sheet',
	cashflow: 'cash-flow'
};

let shared: Promise<YahooClient> | undefined;

/** One client per server instance, created on first use so other pages never load the library. */
export function defaultClient(): Promise<YahooClient> {
	shared ??= import('yahoo-finance2')
		.then(({ default: YahooFinance }) => {
			const yf = new YahooFinance({
				suppressNotices: ['yahooSurvey'],
				logger: { info() {}, warn() {}, error() {}, debug() {}, dir() {} }
			});
			return {
				chart: (symbol, options, moduleOptions) => yf.chart(symbol, options, moduleOptions),
				quoteSummary: (symbol, options, moduleOptions) => yf.quoteSummary(symbol, options, moduleOptions),
				search: (query, options, moduleOptions) => yf.search(query, options, moduleOptions),
				fundamentalsTimeSeries: (symbol, options, moduleOptions) =>
					yf.fundamentalsTimeSeries(symbol, options, moduleOptions)
			} satisfies YahooClient;
		})
		.catch((error: unknown) => {
			// a failed import must not stick until the instance restarts: the next request tries again
			shared = undefined;
			throw error;
		});
	return shared;
}

/**
 * Yahoo's own answer for a symbol it does not know. The library throws it as a plain `Error` carrying Yahoo's wording:
 * "No data found, symbol may be delisted" (chart) and "Quote not found for symbol: X" (quote summary); the statement
 * series returns an empty list instead. Checked against the live service on 2026-11-12. A failed request is an
 * `HTTPError` whose text is the raw response body, so it never counts, whatever it says: only a real answer may become
 * an empty result, because the cache keeps an empty result for a day.
 */
const NOT_FOUND = /^(No data found, symbol may be delisted|Quote not found for symbol)/;
const isNotFound = (error: unknown): boolean =>
	error instanceof Error && error.name === 'Error' && NOT_FOUND.test(error.message);
const RATE_LIMITED = /429|too many requests/i;

/** The class name and HTTP status of a library error, for the log. Never the message: it can carry URLs and tokens. */
function describe(error: unknown): string | undefined {
	if (!(error instanceof Error)) return undefined;
	const status = /\b([45]\d\d)\b/.exec(error.message)?.[1];
	return status ? `${error.name} ${status}` : error.name;
}

// The failures of a Yahoo call, sorted once (ADR-012). None carries the library's text: `detail` is `describe`'s.
class NotFound extends Data.TaggedError('NotFound') {}
class RateLimited extends Data.TaggedError('RateLimited')<{ readonly detail: string | undefined }> {}
class Unavailable extends Data.TaggedError('Unavailable')<{ readonly detail: string | undefined }> {}
/** A parser found the response unusable; it says so with a fixed `SourceError`. */
class Unexpected extends Data.TaggedError('Unexpected')<{ readonly error: SourceError }> {}
type YahooFailure = NotFound | RateLimited | Unavailable | Unexpected;

/** Sorts anything a library call or a parser threw. Total: it never throws. */
function classify(error: unknown): YahooFailure {
	if (error instanceof SourceError) return new Unexpected({ error });
	if (isNotFound(error)) return new NotFound();
	const text = error instanceof Error ? `${error.name} ${error.message}` : '';
	if (RATE_LIMITED.test(text)) return new RateLimited({ detail: describe(error) });
	return new Unavailable({ detail: describe(error) });
}

/** One library call, stopped after `FETCH_TIMEOUT_MS` like the other sources; a timeout is `Unavailable`. */
const call = <T>(run: () => Promise<T>): Effect.Effect<T, YahooFailure> =>
	Effect.tryPromise({ try: () => run(), catch: classify }).pipe(
		Effect.timeoutOrElse({
			duration: FETCH_TIMEOUT_MS,
			orElse: () => Effect.fail(new Unavailable({ detail: 'TimeoutError' }))
		})
	);

/** A parser, run so that the `SourceError` it throws for an unusable response stays a typed failure. */
const parse = <T>(run: () => T): Effect.Effect<T, YahooFailure> => Effect.try({ try: run, catch: classify });

const clientOf = (client: YahooClient | undefined): Effect.Effect<YahooClient, YahooFailure> =>
	client ? Effect.succeed(client) : call(defaultClient);

/** Fixed messages only: library errors can carry URLs and tokens. */
function toSourceError(failure: RateLimited | Unavailable | Unexpected): SourceError {
	switch (failure._tag) {
		case 'RateLimited':
			return new SourceError('limit', 'Yahoo Finance rate limit reached', failure.detail);
		case 'Unavailable':
			return new SourceError('unavailable', 'Yahoo Finance is unavailable', failure.detail);
		case 'Unexpected':
			return failure.error;
	}
}

/** The promise boundary: a symbol Yahoo does not know is an answer worth caching as `empty`; any other failure is not. */
const run = <T>(program: Effect.Effect<T, YahooFailure>, empty: T): Promise<T> =>
	Effect.runPromise(
		program.pipe(
			Effect.catchTag('NotFound', () => Effect.succeed(empty)),
			Effect.mapError(toSourceError)
		)
	);

export function fetchYahooPrices(
	symbol: string,
	from: string,
	to: string,
	client?: YahooClient
): Promise<PricePoint[]> {
	const window = {
		period1: new Date(`${from}T00:00:00Z`),
		period2: new Date(`${to}T23:59:59Z`),
		interval: '1d' as const
	};
	return run(
		Effect.gen(function* () {
			const c = yield* clientOf(client);
			const result = yield* call(() => c.chart(symbol, window, OPTIONS));
			return yield* parse(() =>
				parseYahooPrices(field(result, 'quotes'), num(field(field(result, 'meta'), 'gmtoffset')) ?? 0)
			);
		}),
		[]
	);
}

export function fetchYahooProfile(symbol: string, client?: YahooClient): Promise<Profile | null> {
	return run(
		Effect.gen(function* () {
			const c = yield* clientOf(client);
			const summary = yield* call(() => c.quoteSummary(symbol, { modules: ['assetProfile', 'price'] }, OPTIONS));
			return yield* parse(() => parseYahooProfile(summary));
		}),
		null
	);
}

/** The company's name for a news search; the ticker when the lookup fails in any way. */
const newsQuery = (c: YahooClient, symbol: string): Effect.Effect<string> =>
	call(() => c.quoteSummary(symbol, { modules: ['price'] }, OPTIONS)).pipe(
		Effect.map((summary) => {
			const price = field(summary, 'price');
			return str(field(price, 'longName')) ?? str(field(price, 'shortName')) ?? symbol;
		}),
		Effect.orElseSucceed(() => symbol)
	);

/** Yahoo's news is a text search, so search for the company name; the bare ticker finds little outside the US. */
export function fetchYahooNews(symbol: string, client?: YahooClient): Promise<NewsItem[]> {
	return run(
		Effect.gen(function* () {
			const c = yield* clientOf(client);
			const query = yield* newsQuery(c, symbol);
			const result = yield* call(() => c.search(query, { newsCount: NEWS_LIMIT, quotesCount: 0 }, OPTIONS));
			return yield* parse(() => parseYahooNews(field(result, 'news') ?? []));
		}),
		[]
	);
}

/** The statement's reporting currency; null when the lookup fails in any way. */
const reportingCurrency = (c: YahooClient, symbol: string): Effect.Effect<string | null> =>
	call(() => c.quoteSummary(symbol, { modules: ['financialData', 'price'] }, OPTIONS)).pipe(
		Effect.map(
			(s) => str(field(field(s, 'financialData'), 'financialCurrency')) ?? str(field(field(s, 'price'), 'currency'))
		),
		Effect.orElseSucceed(() => null)
	);

const series = (c: YahooClient, symbol: string, type: 'annual' | 'trailing', module: StatementModule, from: number) =>
	call(() => c.fundamentalsTimeSeries(symbol, { period1: new Date(Date.UTC(from, 0, 1)), type, module }, OPTIONS));

export function fetchYahooStatement(
	kind: Kind,
	symbol: string,
	period: Period,
	client?: YahooClient
): Promise<Statement> {
	return run(
		Effect.gen(function* () {
			const c = yield* clientOf(client);
			const module = MODULES[kind];
			const year = new Date().getUTCFullYear();
			// TTM income and cash flow come from the trailing series; the balance sheet has none and uses the latest annual one
			const wantsTrailing = period === 'ttm' && kind !== 'balance';
			const annual = wantsTrailing ? [] : yield* series(c, symbol, 'annual', module, year - 7);
			const trailing = wantsTrailing ? yield* series(c, symbol, 'trailing', module, year - 2) : null;
			const currency = yield* reportingCurrency(c, symbol);
			return yield* parse(() => parseYahooStatement(kind, annual, trailing, period, currency));
		}),
		{ lines: [], years: [] }
	);
}
