// src/lib/server/eulerpool.ts
// Eulerpool (https://eulerpool.com): statements, company profile and daily prices. I/O only; parsing is in eulerpool-parse.ts.
import type { Kind, PricePoint, Profile, Statement } from '../source-data';
import { FETCH_TIMEOUT_MS, MAX_BYTES, readCapped } from './http';
import {
	parseEulerpoolCurrency,
	parseEulerpoolPrices,
	parseEulerpoolProfile,
	parseEulerpoolStatement
} from './eulerpool-parse';
import { SourceError } from './source-error';

const BASE = 'https://api.eulerpool.com/api/1';
const ENDPOINTS: Readonly<Record<Kind, string>> = {
	income: 'incomestatement',
	balance: 'balancesheet',
	cashflow: 'cashflowstatement'
};

/**
 * GET an Eulerpool endpoint and return the parsed JSON body, or `undefined` when Eulerpool does not know the security
 * (404). The key travels in a header, never in the URL, and only fixed messages leave this function.
 */
export async function eulerpoolGet(
	path: string,
	apiKey: string,
	params: Readonly<Record<string, string>> = {},
	fetchFn: typeof fetch = fetch
): Promise<unknown> {
	const query = new URLSearchParams(params).toString();
	let response: Response;
	try {
		response = await fetchFn(`${BASE}/${path}${query ? `?${query}` : ''}`, {
			headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
	} catch {
		throw new SourceError('unavailable', 'Eulerpool could not be reached');
	}

	if (response.status === 404) return undefined;
	if (response.status === 401) throw new SourceError('config', 'Eulerpool rejected the API key');
	if (response.status === 402 || response.status === 403) {
		throw new SourceError('plan', 'Not available on this Eulerpool plan');
	}
	if (response.status === 429) throw new SourceError('limit', 'Eulerpool rate limit reached');
	if (!response.ok) throw new SourceError('unavailable', `Eulerpool returned ${response.status}`);

	if (Number(response.headers.get('content-length')) > MAX_BYTES) {
		throw new SourceError('unavailable', 'Eulerpool response too large');
	}
	let text: string | null;
	try {
		text = await readCapped(response, MAX_BYTES);
	} catch {
		throw new SourceError('unavailable', 'Eulerpool response could not be read');
	}
	if (text === null) throw new SourceError('unavailable', 'Eulerpool response too large');
	try {
		return JSON.parse(text);
	} catch {
		throw new SourceError('unavailable', 'Unexpected response from Eulerpool');
	}
}

const id = (symbol: string): string => encodeURIComponent(symbol);

/** The company's currency, used for its statements; null when it cannot be found (the figures still show). */
async function currencyOf(symbol: string, apiKey: string, fetchFn: typeof fetch): Promise<string | null> {
	try {
		return parseEulerpoolCurrency(await eulerpoolGet(`equity/overview/${id(symbol)}`, apiKey, {}, fetchFn));
	} catch {
		return null;
	}
}

/** Annual statements only: Eulerpool's trailing-twelve-month figures mix units, so the app does not offer that period. */
export async function fetchEulerpoolStatement(
	kind: Kind,
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	const [body, currency] = await Promise.all([
		eulerpoolGet(`equity/${ENDPOINTS[kind]}/${id(symbol)}`, apiKey, {}, fetchFn),
		currencyOf(symbol, apiKey, fetchFn)
	]);
	return body === undefined ? { lines: [], years: [] } : parseEulerpoolStatement(kind, body, currency);
}

export async function fetchEulerpoolProfile(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Profile | null> {
	const body = await eulerpoolGet(`equity/overview/${id(symbol)}`, apiKey, {}, fetchFn);
	return body === undefined ? null : parseEulerpoolProfile(body);
}

/** One year of daily closes. */
export async function fetchEulerpoolPrices(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<PricePoint[]> {
	const body = await eulerpoolGet(`equity/candles/${id(symbol)}`, apiKey, { range: '1y' }, fetchFn);
	return body === undefined ? [] : parseEulerpoolPrices(body);
}
