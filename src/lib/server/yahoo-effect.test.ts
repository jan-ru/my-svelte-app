// The Effect pilot's additions to the Yahoo source (ADR-012, ADR-013): the timeout and each failure kind, through the promise
// interface. yahoo.test.ts stays the contract; this file sets a short timeout so the hung calls finish quickly.
import { describe, expect, it, vi } from 'vitest';
import { SourceError } from './source-error';
import { fetchYahooNews, fetchYahooPrices, fetchYahooProfile, fetchYahooStatement, type YahooClient } from './yahoo';

vi.mock('./http', async (actual) => ({ ...(await actual<typeof import('./http')>()), FETCH_TIMEOUT_MS: 40 }));

const never = () => new Promise<never>(() => {});
/** Answers that come after the timeout: a value, or a failure. */
const later = <T>(value: T, ms = 80) => new Promise<T>((resolve) => setTimeout(resolve, ms, value));
const failsLater = (error: Error, ms = 80) => new Promise<never>((_resolve, reject) => setTimeout(reject, ms, error));

const client = (overrides: Partial<YahooClient> = {}): YahooClient => ({
	chart: vi.fn(async () => ({ meta: { gmtoffset: 0 }, quotes: [{ date: 1767139200, close: 1 }] })),
	quoteSummary: vi.fn(async () => ({ price: { longName: 'ABN AMRO Bank N.V.', currency: 'EUR' } })),
	search: vi.fn(async () => ({ news: [] })),
	fundamentalsTimeSeries: vi.fn(async () => [{ date: 1767139200, totalRevenue: 1 }]),
	...overrides
});

const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => undefined,
		(e: unknown) => e
	);

describe('a Yahoo call that does not answer', () => {
	it.each<[string, Partial<YahooClient>, (c: YahooClient) => Promise<unknown>]>([
		['prices', { chart: vi.fn(never) }, (c) => fetchYahooPrices('X', '2026-01-01', '2026-02-01', c)],
		['the profile', { quoteSummary: vi.fn(never) }, (c) => fetchYahooProfile('X', c)],
		['news', { search: vi.fn(never) }, (c) => fetchYahooNews('X', c)],
		['a statement', { fundamentalsTimeSeries: vi.fn(never) }, (c) => fetchYahooStatement('income', 'X', 'annual', c)]
	])('stops after FETCH_TIMEOUT_MS and makes %s unavailable', async (_what, overrides, fetch) => {
		const started = Date.now();
		const error = await failure(fetch(client(overrides)));
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).kind).toBe('unavailable');
		expect((error as SourceError).message).toBe('Yahoo Finance is unavailable');
		expect((error as SourceError).detail).toBe('TimeoutError');
		expect(Date.now() - started).toBeLessThan(2000);
	});
	it('is only the name lookup for news: the search still runs, for the ticker', async () => {
		const c = client({ quoteSummary: vi.fn(never) });
		expect(await fetchYahooNews('ABN.AS', c)).toEqual([]);
		expect(vi.mocked(c.search).mock.calls[0]?.[0]).toBe('ABN.AS');
	});
	it('is only the currency lookup for a statement: the statement comes without a currency', async () => {
		const s = await fetchYahooStatement('income', 'X', 'annual', client({ quoteSummary: vi.fn(never) }));
		expect(s.years[0]?.values.totalRevenue).toBe(1);
		expect(s.years[0]?.currency).toBeNull();
	});
	it('leaves nothing behind when the late answer comes after the timeout, a failure included', async () => {
		const late = client({
			chart: vi.fn(() => failsLater(new Error('HTTP 503 for https://query1.finance.yahoo.com/?crumb=SECRET'))),
			quoteSummary: vi.fn(() => later({ price: {} }))
		});
		const prices = await failure(fetchYahooPrices('X', '2026-01-01', '2026-02-01', late));
		expect((prices as SourceError).detail).toBe('TimeoutError');
		expect(await failure(fetchYahooProfile('X', late))).toBeInstanceOf(SourceError);
		// let the late calls settle while the test still runs: an unhandled rejection would fail the run
		await new Promise((resolve) => setTimeout(resolve, 120));
	});
});

describe('each kind of failure', () => {
	it('keeps the parser’s fixed message for a response it cannot use', async () => {
		const c = client({ chart: vi.fn(async () => ({ quotes: 'not a list' })) });
		const error = await failure(fetchYahooPrices('X', '2026-01-01', '2026-02-01', c));
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).kind).toBe('unavailable');
		expect((error as SourceError).message).toBe('Unexpected response from Yahoo Finance');
	});
	it('sorts a failure once, in the order not found, rate limit, unavailable', async () => {
		const throwing = (error: unknown) =>
			client({
				chart: vi.fn(async () => {
					throw error;
				})
			});
		const fetch = (error: unknown) => fetchYahooPrices('X', '2026-01-01', '2026-02-01', throwing(error));
		expect(await fetch(new Error('Quote not found for symbol: X'))).toEqual([]);
		expect(((await failure(fetch(new Error('HTTP 429')))) as SourceError).kind).toBe('limit');
		expect(((await failure(fetch(new TypeError('fetch failed')))) as SourceError).kind).toBe('unavailable');
		expect(((await failure(fetch(undefined))) as SourceError).detail).toBeUndefined();
	});
	it('makes a library that cannot load unavailable, without its text', async () => {
		vi.resetModules();
		vi.doMock('yahoo-finance2', () => {
			throw new Error('cannot load https://example.test/?token=SECRET');
		});
		const { fetchYahooProfile: fresh } = await import('./yahoo');
		const error = await failure(fresh('X'));
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Yahoo Finance is unavailable');
		expect((error as Error).message).not.toMatch(/SECRET|https?:/);
		vi.doUnmock('yahoo-finance2');
		vi.resetModules();
	});
});
