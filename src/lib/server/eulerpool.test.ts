import { describe, expect, it, vi } from 'vitest';
import {
	eulerpoolGet,
	fetchEulerpoolFairValue,
	fetchEulerpoolPrices,
	fetchEulerpoolProfile,
	fetchEulerpoolQuality,
	fetchEulerpoolStatement
} from './eulerpool';
import { MAX_BYTES } from './http';
import { SourceError } from './source-error';

const KEY = 'eu_secret_key_123';
/** The URL a fetch was called with, as text. */
const urlOf = (input: Parameters<typeof fetch>[0] | undefined): string =>
	typeof input === 'string' ? input : input instanceof URL ? input.href : (input?.url ?? '');
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });

/** A fetch that answers by path. */
const routes = (table: Record<string, () => Response>) =>
	vi.fn<typeof fetch>(async (input) => {
		const url = new URL(urlOf(input));
		const answer = table[url.pathname.replace('/api/1/', '')];
		return answer ? answer() : new Response('{"error":"Security not found"}', { status: 404 });
	});

const kind = async (promise: Promise<unknown>): Promise<string> => {
	try {
		await promise;
	} catch (error) {
		if (error instanceof SourceError) return `${error.kind}: ${error.message}`;
		throw error;
	}
	throw new Error('expected a SourceError');
};

describe('eulerpoolGet', () => {
	it('sends the key as a bearer token and never puts it in the URL', async () => {
		const fetchFn = routes({ 'equity/overview/AAPL': () => json({ ok: true }) });
		expect(await eulerpoolGet('equity/overview/AAPL', KEY, { range: '1y' }, fetchFn)).toEqual({ ok: true });
		const [url, init] = fetchFn.mock.calls[0] ?? [];
		expect(urlOf(url)).toBe('https://api.eulerpool.com/api/1/equity/overview/AAPL?range=1y');
		expect(urlOf(url)).not.toContain(KEY);
		expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${KEY}`);
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});
	it('is undefined for a security Eulerpool does not know (404)', async () => {
		expect(await eulerpoolGet('equity/overview/NOPE', KEY, {}, routes({}))).toBeUndefined();
	});
	it.each([
		[401, 'config: Eulerpool rejected the API key'],
		[402, 'plan: Not available on this Eulerpool plan'],
		[403, 'plan: Not available on this Eulerpool plan'],
		[429, 'limit: Eulerpool rate limit reached'],
		[500, 'unavailable: Eulerpool returned 500']
	])('maps status %i to a safe message', async (status, expected) => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response(`{"error":"x","message":"Invalid key ${KEY}"}`, { status })
		);
		const message = await kind(eulerpoolGet('equity/overview/AAPL', KEY, {}, fetchFn));
		expect(message).toBe(expected);
		expect(message).not.toContain(KEY);
	});
	it('does not leak the underlying error when the request fails', async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => {
			throw new TypeError(`fetch failed for Bearer ${KEY}`);
		});
		const message = await kind(eulerpoolGet('equity/overview/AAPL', KEY, {}, fetchFn));
		expect(message).toBe('unavailable: Eulerpool could not be reached');
	});
	it('refuses a body that is too large, declared or not', async () => {
		const declared = vi.fn<typeof fetch>(
			async () => new Response('{}', { status: 200, headers: { 'content-length': String(MAX_BYTES + 1) } })
		);
		expect(await kind(eulerpoolGet('x', KEY, {}, declared))).toBe('unavailable: Eulerpool response too large');
		const big = vi.fn<typeof fetch>(async () => new Response('x'.repeat(MAX_BYTES + 1), { status: 200 }));
		expect(await kind(eulerpoolGet('x', KEY, {}, big))).toBe('unavailable: Eulerpool response too large');
	});
	it('refuses a body that is not JSON', async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => new Response('<html>', { status: 200 }));
		expect(await kind(eulerpoolGet('x', KEY, {}, fetchFn))).toBe('unavailable: Unexpected response from Eulerpool');
	});
	it('reports a body that breaks off', async () => {
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.error(new Error(`reset ${KEY}`));
			}
		});
		const fetchFn = vi.fn<typeof fetch>(async () => new Response(stream, { status: 200 }));
		expect(await kind(eulerpoolGet('x', KEY, {}, fetchFn))).toBe('unavailable: Eulerpool response could not be read');
	});
});

describe('fetchEulerpoolStatement', () => {
	const rows = [{ period: '2025-09-30', revenue: 416161 }];
	it('fetches the statement and the currency together and puts the currency on the years', async () => {
		const fetchFn = routes({
			'equity/incomestatement/AAPL': () => json(rows),
			'equity/overview/AAPL': () => json({ currency: 'USD' })
		});
		const statement = await fetchEulerpoolStatement('income', 'AAPL', KEY, fetchFn);
		expect(statement.years[0]).toMatchObject({ date: '2025-09-30', currency: 'USD' });
		expect(statement.years[0]?.values.revenue).toBe(416_161_000_000);
	});
	it.each([
		['balance', 'equity/balancesheet/ASML.AS'],
		['cashflow', 'equity/cashflowstatement/ASML.AS']
	] as const)('asks the %s endpoint for a ticker with a dot', async (kindName, path) => {
		const fetchFn = routes({ [path]: () => json(rows) });
		await fetchEulerpoolStatement(kindName, 'ASML.AS', KEY, fetchFn);
		expect(fetchFn.mock.calls.map(([url]) => new URL(urlOf(url)).pathname)).toContain(`/api/1/${path}`);
	});
	it('still shows the figures when the currency cannot be had', async () => {
		const fetchFn = routes({ 'equity/incomestatement/AAPL': () => json(rows) });
		const statement = await fetchEulerpoolStatement('income', 'AAPL', KEY, fetchFn);
		expect(statement.years[0]?.currency).toBeNull();
		expect(statement.years).toHaveLength(1);
	});
	it('is empty for an unknown security', async () => {
		expect(await fetchEulerpoolStatement('income', 'NOPE', KEY, routes({}))).toEqual({ lines: [], years: [] });
	});
	it('passes a rejected key on, not an empty table', async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => new Response('{}', { status: 401 }));
		expect(await kind(fetchEulerpoolStatement('income', 'AAPL', KEY, fetchFn))).toBe(
			'config: Eulerpool rejected the API key'
		);
	});
	it('encodes the ticker in the path', async () => {
		const fetchFn = routes({});
		await fetchEulerpoolStatement('income', 'A/B?x', KEY, fetchFn);
		expect(urlOf(fetchFn.mock.calls[0]?.[0])).toContain('/equity/incomestatement/A%2FB%3Fx');
	});
});

describe('fetchEulerpoolProfile', () => {
	it('reads the overview', async () => {
		const fetchFn = routes({ 'equity/overview/ABN.AS': () => json({ name: 'ABN Amro Bank NV', marketCap: 10 }) });
		expect(await fetchEulerpoolProfile('ABN.AS', KEY, fetchFn)).toMatchObject({
			name: 'ABN Amro Bank NV',
			marketCap: 10_000_000
		});
	});
	it('is null for an unknown security', async () => {
		expect(await fetchEulerpoolProfile('NOPE', KEY, routes({}))).toBeNull();
	});
});

describe('fetchEulerpoolPrices', () => {
	it('asks for one year of candles', async () => {
		const fetchFn = routes({
			'equity/candles/AAPL': () => json([{ timestamp: Date.parse('2026-11-06T14:30:00Z'), close: 342.37 }])
		});
		expect(await fetchEulerpoolPrices('AAPL', KEY, fetchFn)).toEqual([
			{ date: '2026-11-06', close: 342.37, volume: null }
		]);
		expect(new URL(urlOf(fetchFn.mock.calls[0]?.[0])).searchParams.get('range')).toBe('1y');
	});
	it('is empty for an unknown security', async () => {
		expect(await fetchEulerpoolPrices('NOPE', KEY, routes({}))).toEqual([]);
	});
});

describe('fetchEulerpoolFairValue', () => {
	it('reads the fair value and puts the currency of the overview on it', async () => {
		const fetchFn = routes({
			'fair-value/by-isin/ASML.AS': () => json({ fairValue: 1342.1, lastPrice: 1283.6, upside: 4.56 }),
			'equity/overview/ASML.AS': () => json({ currency: 'EUR' })
		});
		expect(await fetchEulerpoolFairValue('ASML.AS', KEY, fetchFn)).toMatchObject({
			fairValue: 1342.1,
			upside: 4.56,
			currency: 'EUR'
		});
	});
	it('still gives the fair value when the currency cannot be had', async () => {
		const fetchFn = routes({ 'fair-value/by-isin/AAPL': () => json({ fairValue: 278.5 }) });
		expect(await fetchEulerpoolFairValue('AAPL', KEY, fetchFn)).toMatchObject({ fairValue: 278.5, currency: null });
	});
	it('is null for an unknown security', async () => {
		expect(await fetchEulerpoolFairValue('NOPE', KEY, routes({}))).toBeNull();
	});
	it('passes a rate limit on', async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => new Response('{}', { status: 429 }));
		expect(await kind(fetchEulerpoolFairValue('AAPL', KEY, fetchFn))).toBe('limit: Eulerpool rate limit reached');
	});
});

describe('fetchEulerpoolQuality', () => {
	it('reads the score', async () => {
		const fetchFn = routes({ 'equity/aaqs/AAPL': () => json({ score: 8, roce: 0.69 }) });
		expect(await fetchEulerpoolQuality('AAPL', KEY, fetchFn)).toMatchObject({ score: 8, roce: 0.69 });
	});
	it('is null for an unknown security', async () => {
		expect(await fetchEulerpoolQuality('NOPE', KEY, routes({}))).toBeNull();
	});
});
