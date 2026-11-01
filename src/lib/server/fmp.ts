// src/lib/server/fmp.ts
import type { Period } from '../financials-nav';
import type { Kind, Statement, StatementYear } from '../source-data';
import { field, isRecord, str } from './coerce';
import { SourceError } from './source-error';

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BYTES = 5 * 1024 * 1024;

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

function fromMessage(message: string): SourceError {
	if (/invalid api key/i.test(message)) return new SourceError('config', 'FMP rejected the API key');
	if (/limit reach/i.test(message)) return new SourceError('limit', 'FMP rate limit reached');
	return new SourceError('plan', clean(message));
}

/** Throw the mapped error when FMP answered with an `Error Message` body; otherwise do nothing. */
export function throwIfErrorBody(body: unknown): void {
	const message = field(body, 'Error Message');
	if (typeof message === 'string') throw fromMessage(message);
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

/** GET an FMP stable endpoint and return the parsed JSON body (undefined when it is not JSON). */
export async function fmpGet(
	path: string,
	params: Record<string, string>,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<unknown> {
	const query = new URLSearchParams({ ...params, apikey: apiKey });
	let response: Response;
	try {
		response = await fetchFn(`${BASE}/${path}?${query}`, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
	} catch {
		// the underlying error can contain the request URL, which holds the key
		throw new SourceError('unavailable', 'FMP could not be reached');
	}

	const declared = Number(response.headers.get('content-length'));
	if (declared > MAX_BYTES) throw new SourceError('unavailable', 'FMP response too large');
	let text: string;
	try {
		text = await response.text();
	} catch {
		// a timeout or reset mid-body; the raw error can carry the request URL
		throw new SourceError('unavailable', 'FMP response could not be read');
	}
	if (text.length > MAX_BYTES) throw new SourceError('unavailable', 'FMP response too large');
	// FMP may echo the key in an error message, bare or encoded; remove it before anything is parsed
	text = redactKey(text, apiKey);

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		body = undefined;
	}

	if (!response.ok) {
		throwIfErrorBody(body);
		if (response.status === 401) throw new SourceError('config', 'FMP rejected the API key');
		if (response.status === 402 || response.status === 403) {
			throw new SourceError('plan', 'Not available on this FMP plan');
		}
		if (response.status === 429) throw new SourceError('limit', 'FMP rate limit reached');
		throw new SourceError('unavailable', `FMP returned ${response.status}`);
	}
	return body;
}

/** Annual financial ratios; the rows have the same shape as a statement, so they parse the same way. */
export async function fetchRatios(symbol: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<Statement> {
	return parseStatement(await fmpGet('ratios', { symbol, period: 'annual', limit: '5' }, apiKey, fetchFn));
}

/** Analyst estimates by fiscal year, furthest-out year first (FMP's order). */
export async function fetchEstimates(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	return parseStatement(await fmpGet('analyst-estimates', { symbol, period: 'annual', limit: '5' }, apiKey, fetchFn));
}

/** Reported and upcoming earnings; several fall in one fiscal year, so each column is labelled by its report date. */
export async function fetchEarnings(symbol: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<Statement> {
	const statement = parseStatement(await fmpGet('earnings', { symbol, limit: '5' }, apiKey, fetchFn));
	return { ...statement, years: statement.years.map((y) => ({ ...y, fiscalYear: y.date })) };
}

export async function fetchStatement(
	kind: Kind,
	symbol: string,
	apiKey: string,
	period: Period = 'annual',
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	const params: Record<string, string> =
		period === 'ttm' ? { symbol, limit: '1' } : { symbol, period: 'annual', limit: '5' };
	const path = period === 'ttm' ? `${ENDPOINTS[kind]}-ttm` : ENDPOINTS[kind];
	const statement = parseStatement(await fmpGet(path, params, apiKey, fetchFn));
	// a TTM figure is a single column; keep the newest row even if FMP ignores limit=1
	return period === 'ttm' ? { ...statement, years: statement.years.slice(0, 1) } : statement;
}
