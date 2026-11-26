// src/lib/server/fmp.ts
import * as Effect from 'effect/Effect';
import type { Period } from '../financials-nav';
import type { Kind, Statement, StatementYear } from '../source-data';
import { field, isRecord, str } from './coerce';
import {
	Config,
	FETCH_TIMEOUT_MS,
	MAX_BYTES,
	Plan,
	RateLimited,
	type SourceFailure,
	attempt,
	fetchE,
	readBodyE,
	readCapped,
	runSource,
	statusFailure,
	toSourceError
} from './http';
import { SourceError } from './source-error';

export { FETCH_TIMEOUT_MS, MAX_BYTES, readCapped };

const BASE = 'https://financialmodelingprep.com/stable';
const ENDPOINTS: Record<Kind, string> = {
	income: 'income-statement',
	balance: 'balance-sheet-statement',
	cashflow: 'cash-flow-statement'
};

/** Fields that describe the filing, not a figure in it. */
const META = new Set([
	'symbol',
	'date',
	'fiscalYear',
	'calendarYear',
	'period',
	'reportedCurrency',
	'cik',
	'filingDate',
	'acceptedDate',
	'link',
	'finalLink'
]);

/** Remove anything that looks like the API key from text that may reach a log or a visitor. */
const clean = (text: string): string => text.replace(/apikey=[^&\s"']+/gi, 'apikey=***').slice(0, 200);

function redactKey(text: string, apiKey: string): string {
	if (!apiKey) return text;
	return [apiKey, encodeURIComponent(apiKey)].reduce((out, k) => out.split(k).join('***'), text);
}

/** FMP's own `Error Message`, sorted; a plan message is shown, so it is cleaned of anything like the key. */
function fromMessage(message: string): Config | RateLimited | Plan {
	if (/invalid api key/i.test(message)) return new Config({ message: 'FMP rejected the API key' });
	if (/limit reach/i.test(message)) return new RateLimited({ message: 'FMP rate limit reached' });
	return new Plan({ message: clean(message) });
}

/** The failure FMP's `Error Message` body stands for, or null when the body is not one. */
const errorBody = (body: unknown): Config | RateLimited | Plan | null => {
	const message = field(body, 'Error Message');
	return typeof message === 'string' ? fromMessage(message) : null;
};

/** Throw the mapped error when FMP answered with an `Error Message` body; otherwise do nothing. */
export function throwIfErrorBody(body: unknown): void {
	const failure = errorBody(body);
	if (failure) throw toSourceError(failure);
}

/** A year field as text; FMP sends it as a string or a number. */
const yearOf = (value: unknown): string | null => (typeof value === 'number' ? String(value) : str(value));

export function parseStatement(body: unknown): Statement {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw new SourceError('unavailable', 'Unexpected response from FMP');

	const lines: string[] = [];
	const years: StatementYear[] = [];
	for (const record of body) {
		if (!isRecord(record)) continue;
		const date = typeof record.date === 'string' ? record.date : '';
		const values: Record<string, number | null> = {};
		for (const [key, value] of Object.entries(record)) {
			if (META.has(key)) continue;
			if (!lines.includes(key) && (typeof value === 'number' || value === null)) lines.push(key);
			values[key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
		}
		years.push({
			fiscalYear: yearOf(record.fiscalYear) ?? yearOf(record.calendarYear) ?? date.slice(0, 4),
			date,
			currency: typeof record.reportedCurrency === 'string' ? record.reportedCurrency : null,
			values
		});
	}
	years.sort((a, b) => b.date.localeCompare(a.date));
	return { lines: lines.filter((key) => years.some((y) => key in y.values)), years: years.slice(0, 5) };
}

/** The JSON in a body, or undefined when it is not JSON. */
function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/** GET an FMP stable endpoint: the parsed JSON body (undefined when it is not JSON), or a typed failure. */
const get = (
	path: string,
	params: Record<string, string>,
	apiKey: string,
	fetchFn: typeof fetch
): Effect.Effect<unknown, SourceFailure> =>
	Effect.gen(function* () {
		const query = new URLSearchParams({ ...params, apikey: apiKey });
		const response = yield* fetchE(fetchFn, `${BASE}/${path}?${query}`, {}, 'FMP');
		// FMP may echo the key in an error message, bare or encoded; remove it before anything is parsed
		const text = redactKey(yield* readBodyE(response, 'FMP'), apiKey);
		const body = parseJson(text);
		const failed = statusFailure(response.status, 'FMP');
		// FMP's own message says more than the status
		if (failed) return yield* Effect.fail(errorBody(body) ?? failed);
		return body;
	});

/** An FMP endpoint read by one of the parsers here or in fmp-info.ts, which may throw a `SourceError` of their own. */
export const fmpFetch = <A>(
	path: string,
	params: Record<string, string>,
	apiKey: string,
	fetchFn: typeof fetch,
	parse: (body: unknown) => A
): Promise<A> =>
	runSource(Effect.flatMap(get(path, params, apiKey, fetchFn), (body) => attempt(() => parse(body), 'FMP')));

/** GET an FMP stable endpoint and return the parsed JSON body (undefined when it is not JSON). */
export const fmpGet = (
	path: string,
	params: Record<string, string>,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<unknown> => runSource(get(path, params, apiKey, fetchFn));

/** Annual financial ratios; the rows have the same shape as a statement, so they parse the same way. */
export function fetchRatios(symbol: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<Statement> {
	return fmpFetch('ratios', { symbol, period: 'annual', limit: '5' }, apiKey, fetchFn, parseStatement);
}

/** Analyst estimates by fiscal year, furthest-out year first (FMP's order). */
export function fetchEstimates(symbol: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<Statement> {
	return fmpFetch('analyst-estimates', { symbol, period: 'annual', limit: '5' }, apiKey, fetchFn, parseStatement);
}

/** Reported and upcoming earnings; several fall in one fiscal year, so each column is labelled by its report date. */
export function fetchEarnings(symbol: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<Statement> {
	return fmpFetch('earnings', { symbol, limit: '5' }, apiKey, fetchFn, (body) => {
		const statement = parseStatement(body);
		return { ...statement, years: statement.years.map((y) => ({ ...y, fiscalYear: y.date })) };
	});
}

export function fetchStatement(
	kind: Kind,
	symbol: string,
	apiKey: string,
	period: Period = 'annual',
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	const params: Record<string, string> =
		period === 'ttm' ? { symbol, limit: '1' } : { symbol, period: 'annual', limit: '5' };
	const path = period === 'ttm' ? `${ENDPOINTS[kind]}-ttm` : ENDPOINTS[kind];
	return fmpFetch(path, params, apiKey, fetchFn, (body) => {
		const statement = parseStatement(body);
		// a TTM figure is a single column; keep the newest row even if FMP ignores limit=1
		return period === 'ttm' ? { ...statement, years: statement.years.slice(0, 1) } : statement;
	});
}
