import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchYahooNews, fetchYahooPrices, fetchYahooProfile, fetchYahooStatement, type YahooClient } from './yahoo';
import { SourceError } from './source-error';

const fake = (overrides: Partial<YahooClient> = {}): YahooClient => ({
	chart: vi.fn(async () => ({
		meta: { gmtoffset: 3600 },
		quotes: [{ date: new Date('2026-10-23T08:00:00Z'), close: 39.5, volume: 10 }]
	})),
	quoteSummary: vi.fn(async (_s: string, o: { modules: string[] }) =>
		o.modules.includes('assetProfile')
			? { assetProfile: { sector: 'Financial Services' }, price: { longName: 'ABN AMRO Bank N.V.', currency: 'EUR' } }
			: { financialData: { financialCurrency: 'EUR' }, price: { longName: 'ABN AMRO Bank N.V.', currency: 'EUR' } }
	),
	search: vi.fn(async () => ({
		news: [
			{
				title: 'Headline',
				publisher: 'RBI',
				link: 'https://finance.yahoo.com/n/1',
				providerPublishTime: new Date('2026-10-25T14:30:00Z')
			}
		]
	})),
	fundamentalsTimeSeries: vi.fn(async (_s: string, o: { type: string }) =>
		o.type === 'annual'
			? [{ date: new Date('2025-12-31T00:00:00Z'), totalRevenue: 130, netIncome: 14 }]
			: [{ date: 1767139200, totalRevenue: 120, netIncome: 13 }]
	),
	...overrides
});

describe('fetchYahooPrices', () => {
	it('asks for daily quotes over the window, without strict result validation', async () => {
		const client = fake();
		const points = await fetchYahooPrices('ABN.AS', '2025-10-26', '2026-10-26', client);
		expect(points).toEqual([{ date: '2026-10-23', close: 39.5, volume: 10 }]);
		const [symbol, options, moduleOptions] = vi.mocked(client.chart).mock.calls[0] ?? [];
		expect(symbol).toBe('ABN.AS');
		expect(options?.interval).toBe('1d');
		expect(options?.period1.toISOString().slice(0, 10)).toBe('2025-10-26');
		expect(options?.period2.toISOString().slice(0, 10)).toBe('2026-10-26');
		expect(moduleOptions).toEqual({ validateResult: false });
	});
	it('puts quotes on the exchange-local date', async () => {
		const client = fake({
			chart: vi.fn(async () => ({
				meta: { gmtoffset: 39600 },
				quotes: [{ date: new Date('2026-10-26T23:00:00Z'), close: 5, volume: 1 }]
			}))
		});
		expect((await fetchYahooPrices('BHP.AX', '2026-10-01', '2026-10-27', client))[0]?.date).toBe('2026-10-27');
	});
});

describe('fetchYahooProfile', () => {
	it('reads the asset profile and price modules', async () => {
		const client = fake();
		const profile = await fetchYahooProfile('ABN.AS', client);
		expect(profile?.name).toBe('ABN AMRO Bank N.V.');
		expect(profile?.sector).toBe('Financial Services');
		const [, options, moduleOptions] = vi.mocked(client.quoteSummary).mock.calls[0] ?? [];
		expect(options?.modules).toEqual(['assetProfile', 'price']);
		expect(moduleOptions).toEqual({ validateResult: false });
	});
});

describe('fetchYahooNews', () => {
	it('searches by company name, falling back to the ticker', async () => {
		const client = fake();
		const items = await fetchYahooNews('ABN.AS', client);
		expect(items).toHaveLength(1);
		expect(vi.mocked(client.search).mock.calls[0]?.[0]).toBe('ABN AMRO Bank N.V.');
		expect(vi.mocked(client.search).mock.calls[0]?.[1]).toEqual({ newsCount: 20, quotesCount: 0 });

		const noName = fake({
			quoteSummary: vi.fn(async () => {
				throw new Error('boom');
			})
		});
		await fetchYahooNews('ABN.AS', noName);
		expect(vi.mocked(noName.search).mock.calls[0]?.[0]).toBe('ABN.AS');
	});
	it('returns [] when Yahoo has no news', async () => {
		expect(await fetchYahooNews('X.AS', fake({ search: vi.fn(async () => ({})) }))).toEqual([]);
	});
});

describe('fetchYahooStatement', () => {
	it('fetches the annual series and the reporting currency', async () => {
		const client = fake();
		const s = await fetchYahooStatement('income', 'ABN.AS', 'annual', client);
		expect(s.years[0]?.values.totalRevenue).toBe(130);
		expect(s.years[0]?.currency).toBe('EUR');
		expect(vi.mocked(client.fundamentalsTimeSeries)).toHaveBeenCalledTimes(1);
		const [, options, moduleOptions] = vi.mocked(client.fundamentalsTimeSeries).mock.calls[0] ?? [];
		expect(options).toMatchObject({ type: 'annual', module: 'financials' });
		expect(moduleOptions).toEqual({ validateResult: false });
	});
	it('uses the trailing series, and only that, for TTM income and cash flow', async () => {
		const client = fake();
		const s = await fetchYahooStatement('cashflow', 'ABN.AS', 'ttm', client);
		expect(s.years[0]?.values.totalRevenue).toBe(120);
		const calls = vi.mocked(client.fundamentalsTimeSeries).mock.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0]?.[1]).toMatchObject({ type: 'trailing', module: 'cash-flow' });
	});
	it('uses only the annual series for the TTM balance sheet', async () => {
		const client = fake();
		await fetchYahooStatement('balance', 'ABN.AS', 'ttm', client);
		const calls = vi.mocked(client.fundamentalsTimeSeries).mock.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0]?.[1]).toMatchObject({ type: 'annual', module: 'balance-sheet' });
	});
	it('carries on without a currency when the lookup fails', async () => {
		const client = fake({
			quoteSummary: vi.fn(async () => {
				throw new Error('boom');
			})
		});
		expect((await fetchYahooStatement('income', 'ABN.AS', 'annual', client)).years[0]?.currency).toBeNull();
	});
});

describe('errors', () => {
	const failing = (error: Error) =>
		fake({
			chart: vi.fn(async () => {
				throw error;
			}),
			quoteSummary: vi.fn(async () => {
				throw error;
			}),
			fundamentalsTimeSeries: vi.fn(async () => {
				throw error;
			})
		});
	it('turns not-found answers into empty results', async () => {
		const client = failing(new Error('Quote not found for symbol: NOPE'));
		expect(await fetchYahooPrices('NOPE', '2025-10-26', '2026-10-26', client)).toEqual([]);
		expect(await fetchYahooProfile('NOPE', client)).toBeNull();
		expect(await fetchYahooStatement('income', 'NOPE', 'annual', client)).toEqual({ lines: [], years: [] });
		const delisted = failing(new Error('No data found, symbol may be delisted'));
		expect(await fetchYahooPrices('NOPE', '2025-10-26', '2026-10-26', delisted)).toEqual([]);
	});
	it('maps rate limits and everything else to SourceError kinds', async () => {
		const limited = await fetchYahooPrices(
			'X',
			'2025-10-26',
			'2026-10-26',
			failing(new Error('HTTP 429 Too Many Requests'))
		).catch((e: unknown) => e);
		expect(limited).toBeInstanceOf(SourceError);
		expect((limited as SourceError).kind).toBe('limit');
		const broken = await fetchYahooProfile(
			'X',
			failing(new Error('fetch failed https://query1.finance.yahoo.com/v7?crumb=SECRET'))
		).catch((e: unknown) => e);
		expect(broken).toBeInstanceOf(SourceError);
		expect((broken as SourceError).kind).toBe('unavailable');
		expect((broken as Error).message).not.toMatch(/https?:|crumb|SECRET/);
	});
});

describe('every library call', () => {
	it('turns the library result validation off, at all seven call sites', async () => {
		const client = fake();
		await fetchYahooPrices('ABN.AS', '2025-10-26', '2026-10-26', client);
		await fetchYahooProfile('ABN.AS', client);
		await fetchYahooNews('ABN.AS', client);
		await fetchYahooStatement('income', 'ABN.AS', 'annual', client);
		const calls = [
			...vi.mocked(client.chart).mock.calls,
			...vi.mocked(client.quoteSummary).mock.calls,
			...vi.mocked(client.search).mock.calls,
			...vi.mocked(client.fundamentalsTimeSeries).mock.calls
		];
		// chart 1, profile 1, news 2 (name lookup and search), statement 2 (series and currency)
		expect(calls).toHaveLength(6);
		for (const call of calls) expect(call[2]).toEqual({ validateResult: false });
	});
});

describe('errors that look like not-found', () => {
	/** Every library call throws `error`, the news search included. */
	const throwing = (error: Error) => {
		const fail = vi.fn(async () => {
			throw error;
		});
		return fake({ chart: fail, quoteSummary: fail, search: fail, fundamentalsTimeSeries: fail });
	};
	/** The four fetchers, each asked for one made-up symbol. */
	const fetchAll = (client: YahooClient) => [
		() => fetchYahooPrices('X', '2025-10-26', '2026-10-26', client),
		() => fetchYahooProfile('X', client),
		() => fetchYahooNews('X', client),
		() => fetchYahooStatement('income', 'X', 'annual', client)
	];
	// the library throws a failed request as an HTTPError whose text is the raw response body
	class HTTPError extends Error {
		override name = 'HTTPError';
	}
	it("are empty results only for Yahoo's own wording, which the library throws as a plain Error", async () => {
		// the exact wording of the live answers for an unknown or delisted symbol (checked 2026-11-12)
		for (const message of ['No data found, symbol may be delisted', 'Quote not found for symbol: ZZQQXNOPE']) {
			const [prices, profile, news, statement] = await Promise.all(
				fetchAll(throwing(new Error(message))).map((f) => f())
			);
			expect([prices, profile, news, statement]).toEqual([[], null, [], { lines: [], years: [] }]);
		}
	});
	it.each([
		['a failed request whose body says Not Found', new HTTPError('<html><title>404 Not Found</title></html>')],
		['a failed request that repeats a real answer', new HTTPError('Quote not found for symbol: X')],
		['an error that mentions "not found" in passing', new Error('upstream service not found')],
		['an error that mentions delisting in passing', new Error('the delisted-symbols lookup timed out')],
		['an error that says "invalid symbol" in passing', new Error('gateway: invalid symbol table')]
	])('are unavailable, never an empty (cached) result: %s', async (_what, error) => {
		for (const call of fetchAll(throwing(error))) {
			const result = await call().catch((e: unknown) => e);
			expect(result).toBeInstanceOf(SourceError);
			expect((result as SourceError).kind).toBe('unavailable');
		}
	});
	it('are not turned into an empty (cached) result when the text is a rate limit', async () => {
		const client = fake({
			chart: vi.fn(async () => {
				throw new Error('HTTP 429 Too Many Requests: symbol not found in cache');
			})
		});
		const error = await fetchYahooPrices('X', '2025-10-26', '2026-10-26', client).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).kind).toBe('limit');
	});
	it('carry the library error name and HTTP status for the log, never its text', async () => {
		class FetchError extends Error {
			override name = 'FetchError';
		}
		const client = fake({
			chart: vi.fn(async () => {
				throw new FetchError('HTTP 403 for https://query1.finance.yahoo.com/v8?crumb=SECRET');
			})
		});
		const error = (await fetchYahooPrices('X', '2025-10-26', '2026-10-26', client).catch(
			(e: unknown) => e
		)) as SourceError;
		expect(error.detail).toBe('FetchError 403');
		expect(error.message).not.toMatch(/SECRET|https?:/);
	});
	it('have no detail when the thrown value is not an Error', async () => {
		const client = fake({
			chart: vi.fn(async () => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- the point of the test
				throw 'boom';
			})
		});
		const error = (await fetchYahooPrices('X', '2025-10-26', '2026-10-26', client).catch(
			(e: unknown) => e
		)) as SourceError;
		expect(error.detail).toBeUndefined();
	});
});

describe('defaultClient', () => {
	afterEach(() => {
		vi.doUnmock('yahoo-finance2');
		vi.resetModules();
	});
	it('wraps the library, builds it once, and forgets a failed import so the next call retries', async () => {
		vi.resetModules();
		vi.doMock('yahoo-finance2', () => {
			throw new Error('cannot load');
		});
		const first = await import('./yahoo');
		await expect(first.defaultClient()).rejects.toThrow();

		vi.resetModules();
		const calls: string[] = [];
		vi.doMock('yahoo-finance2', () => ({
			default: class {
				chart = (s: string) => Promise.resolve(calls.push(`chart ${s}`));
				quoteSummary = (s: string) => Promise.resolve(calls.push(`quoteSummary ${s}`));
				search = (q: string) => Promise.resolve(calls.push(`search ${q}`));
				fundamentalsTimeSeries = (s: string) => Promise.resolve(calls.push(`series ${s}`));
			}
		}));
		const second = await import('./yahoo');
		const client = await second.defaultClient();
		expect(await second.defaultClient()).toBe(client);
		const opts = { period1: new Date(0), period2: new Date(0), interval: '1d' as const };
		await client.chart('A', opts);
		await client.quoteSummary('B', { modules: ['price'] });
		await client.search('C', { newsCount: 1, quotesCount: 0 });
		await client.fundamentalsTimeSeries('D', { period1: new Date(0), type: 'annual', module: 'financials' });
		expect(calls).toEqual(['chart A', 'quoteSummary B', 'search C', 'series D']);
	});
});
