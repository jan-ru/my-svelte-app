// src/lib/server/eulerpool.ts
// Eulerpool (https://eulerpool.com): statements, company profile and daily prices. I/O only; parsing is in eulerpool-parse.ts.
import * as Effect from 'effect/Effect';
import type { FairValue, QualityScore } from '../insight';
import type { Kind, PricePoint, Profile, Statement, SupplyChain } from '../source-data';
import {
	NotFound,
	type SourceFailure,
	Unavailable,
	attempt,
	fetchE,
	readBodyE,
	runSource,
	runSourceOr,
	statusFailure
} from './http';
import {
	parseEulerpoolCurrency,
	parseEulerpoolFairValue,
	parseEulerpoolPrices,
	parseEulerpoolProfile,
	parseEulerpoolQuality,
	parseEulerpoolStatement,
	parseEulerpoolSupplyChain
} from './eulerpool-parse';

const BASE = 'https://api.eulerpool.com/api/1';
const ENDPOINTS: Readonly<Record<Kind, string>> = {
	income: 'incomestatement',
	balance: 'balancesheet',
	cashflow: 'cashflowstatement'
};

const unexpected = () => new Unavailable({ message: 'Unexpected response from Eulerpool' });

/**
 * GET an Eulerpool endpoint: the parsed JSON body, or `NotFound` when Eulerpool does not know the security (404). The
 * key travels in a header, never in the URL, and only fixed messages leave this function.
 */
const get = (
	path: string,
	apiKey: string,
	params: Readonly<Record<string, string>>,
	fetchFn: typeof fetch
): Effect.Effect<unknown, SourceFailure | NotFound> =>
	Effect.gen(function* () {
		const query = new URLSearchParams(params).toString();
		const response = yield* fetchE(
			fetchFn,
			`${BASE}/${path}${query ? `?${query}` : ''}`,
			{ headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
			'Eulerpool'
		);
		if (response.status === 404) return yield* Effect.fail(new NotFound());
		const failed = statusFailure(response.status, 'Eulerpool');
		if (failed) return yield* Effect.fail(failed);
		const text = yield* readBodyE(response, 'Eulerpool');
		return yield* Effect.try({ try: (): unknown => JSON.parse(text), catch: unexpected });
	});

/** GET an Eulerpool endpoint and return the parsed JSON body, or `undefined` when Eulerpool does not know the security. */
export const eulerpoolGet = (
	path: string,
	apiKey: string,
	params: Readonly<Record<string, string>> = {},
	fetchFn: typeof fetch = fetch
): Promise<unknown> => runSourceOr(get(path, apiKey, params, fetchFn), undefined);

const id = (symbol: string): string => encodeURIComponent(symbol);

/** One endpoint for one security, read by a parser from eulerpool-parse.ts, which may throw a `SourceError` of its own. */
const read = <A>(
	path: string,
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch,
	parse: (body: unknown) => A,
	params: Readonly<Record<string, string>> = {}
): Effect.Effect<A, SourceFailure | NotFound> =>
	Effect.flatMap(get(`${path}/${id(symbol)}`, apiKey, params, fetchFn), (body) =>
		attempt(() => parse(body), 'Eulerpool')
	);

/** The company's currency, used for its statements; null when it cannot be found (the figures still show). */
const currencyOf = (symbol: string, apiKey: string, fetchFn: typeof fetch): Effect.Effect<string | null> =>
	read('equity/overview', symbol, apiKey, fetchFn, parseEulerpoolCurrency).pipe(Effect.orElseSucceed(() => null));

/** Annual statements only: Eulerpool's trailing-twelve-month figures mix units, so the app does not offer that period. */
export function fetchEulerpoolStatement(
	kind: Kind,
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	return runSourceOr(
		Effect.gen(function* () {
			const [body, currency] = yield* Effect.all(
				[get(`equity/${ENDPOINTS[kind]}/${id(symbol)}`, apiKey, {}, fetchFn), currencyOf(symbol, apiKey, fetchFn)],
				{ concurrency: 'unbounded' }
			);
			return yield* attempt(() => parseEulerpoolStatement(kind, body, currency), 'Eulerpool');
		}),
		{ lines: [], years: [] }
	);
}

export function fetchEulerpoolProfile(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Profile | null> {
	return runSourceOr(read('equity/overview', symbol, apiKey, fetchFn, parseEulerpoolProfile), null);
}

/** One year of daily closes. */
export function fetchEulerpoolPrices(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<PricePoint[]> {
	return runSourceOr(read('equity/candles', symbol, apiKey, fetchFn, parseEulerpoolPrices, { range: '1y' }), []);
}

/** Eulerpool's fair value per share, in the currency of the listing (from the overview, which the response lacks). */
export function fetchEulerpoolFairValue(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<FairValue | null> {
	return runSourceOr(
		Effect.gen(function* () {
			const [body, currency] = yield* Effect.all(
				[get(`fair-value/by-isin/${id(symbol)}`, apiKey, {}, fetchFn), currencyOf(symbol, apiKey, fetchFn)],
				{ concurrency: 'unbounded' }
			);
			return yield* attempt(() => parseEulerpoolFairValue(body, currency), 'Eulerpool');
		}),
		null
	);
}

/** Eulerpool's AAQS quality score. */
export function fetchEulerpoolQuality(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<QualityScore | null> {
	return runSourceOr(read('equity/aaqs', symbol, apiKey, fetchFn, parseEulerpoolQuality), null);
}

/** The companies Eulerpool links to this one as suppliers or customers; empty when it has none (it covers little outside the US). */
export function fetchEulerpoolSupplyChain(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<SupplyChain> {
	const chain = get(`equity/supply-chain/${id(symbol)}`, apiKey, {}, fetchFn).pipe(
		Effect.catchTag('NotFound', () => Effect.succeed([])),
		Effect.flatMap((body) => attempt(() => parseEulerpoolSupplyChain(body), 'Eulerpool'))
	);
	return runSource(chain);
}
