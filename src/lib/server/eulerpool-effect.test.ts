// What ADR-013 adds to the Eulerpool source: a parser bug (M9) and the log `detail` (M4) never carry upstream text, a
// security Eulerpool does not know is each fetcher's empty value, and a failed currency lookup only drops the currency.
// eulerpool.test.ts and eulerpool-parse.test.ts stay the contract.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	fetchEulerpoolFairValue,
	fetchEulerpoolPrices,
	fetchEulerpoolProfile,
	fetchEulerpoolQuality,
	fetchEulerpoolStatement,
	fetchEulerpoolSupplyChain
} from './eulerpool';
import { parseEulerpoolSupplyChain } from './eulerpool-parse';
import { SourceError } from './source-error';

const KEY = 'eu_secret_key_123';
const SECRET = `https://api.eulerpool.com/api/1/equity/overview/AAPL?token=${KEY}`;

/** The URL a fetch was called with, as text. */
const urlOf = (input: Parameters<typeof fetch>[0]): string =>
	typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => undefined,
		(e: unknown) => e
	);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** Everything a failure carries that could reach a log or a visitor. */
const said = (error: unknown) =>
	error instanceof SourceError ? `${error.message} ${error.detail ?? ''}` : 'not a SourceError';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('a parser bug', () => {
	it.each<[string, (fetchFn: typeof fetch) => Promise<unknown>, object]>([
		['a statement', (f) => fetchEulerpoolStatement('income', 'AAPL', KEY, f), []],
		['the profile', (f) => fetchEulerpoolProfile('AAPL', KEY, f), {}],
		['the supply chain', (f) => fetchEulerpoolSupplyChain('AAPL', KEY, f), []]
	])('makes %s unavailable, with only the class name', async (_what, fetch, shape) => {
		// a body whose every field throws when read, as a bug in a parser would
		const bad = new Proxy(shape, {
			get() {
				throw new TypeError(`cannot read ${SECRET}`);
			}
		});
		vi.spyOn(JSON, 'parse').mockReturnValue(bad);
		const error = await failure(fetch(vi.fn(async () => json([]))));
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).message).toBe('Eulerpool is unavailable');
		expect((error as SourceError).detail).toBe('TypeError');
	});
});

describe('the log detail', () => {
	it('names the class of a failed connection, never its text', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError(`fetch failed for ${SECRET}`);
		});
		const error = await failure(fetchEulerpoolProfile('AAPL', KEY, fetchFn));
		expect((error as SourceError).message).toBe('Eulerpool could not be reached');
		expect((error as SourceError).detail).toBe('TypeError');
		expect(said(error)).not.toContain(KEY);
		expect(said(error)).not.toMatch(/https?:/);
	});
});

describe('a body that is not JSON', () => {
	it('is an unexpected response, with nothing of the parse error', async () => {
		const error = await failure(
			fetchEulerpoolProfile(
				'AAPL',
				KEY,
				vi.fn(async () => new Response(`<html>${SECRET}`))
			)
		);
		expect((error as SourceError).message).toBe('Unexpected response from Eulerpool');
		expect((error as SourceError).detail).toBeUndefined();
	});
});

describe('a security Eulerpool does not know (404)', () => {
	const unknown = () => vi.fn(async () => json({ error: 'Security not found' }, 404));
	it.each<[string, (fetchFn: typeof fetch) => Promise<unknown>, unknown]>([
		['a statement', (f) => fetchEulerpoolStatement('income', 'X', KEY, f), { lines: [], years: [] }],
		['the profile', (f) => fetchEulerpoolProfile('X', KEY, f), null],
		['prices', (f) => fetchEulerpoolPrices('X', KEY, f), []],
		['the fair value', (f) => fetchEulerpoolFairValue('X', KEY, f), null],
		['the quality score', (f) => fetchEulerpoolQuality('X', KEY, f), null],
		['the supply chain', (f) => fetchEulerpoolSupplyChain('X', KEY, f), parseEulerpoolSupplyChain([])]
	])('makes %s its empty value', async (_what, fetch, empty) => {
		expect(await fetch(unknown())).toEqual(empty);
	});
});

describe('the currency lookup', () => {
	it('drops only the currency when it fails, and the statement still comes', async () => {
		const fetchFn = vi.fn<typeof fetch>(async (input) =>
			urlOf(input).includes('equity/overview')
				? json({ error: 'down' }, 500)
				: json([{ period: '2025-09-30', revenue: 416161 }])
		);
		const statement = await fetchEulerpoolStatement('income', 'AAPL', KEY, fetchFn);
		expect(statement.years[0]?.currency).toBeNull();
	});
	it('does not hide a failed statement', async () => {
		const fetchFn = vi.fn<typeof fetch>(async (input) =>
			urlOf(input).includes('equity/overview') ? json({ currency: 'USD' }) : json({}, 429)
		);
		const error = await failure(fetchEulerpoolStatement('income', 'AAPL', KEY, fetchFn));
		expect((error as SourceError).kind).toBe('limit');
		expect((error as SourceError).message).toBe('Eulerpool rate limit reached');
	});
});
