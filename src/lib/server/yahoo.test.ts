import { describe, expect, it, vi } from 'vitest';
import {
	fetchYahooNews,
	fetchYahooPrices,
	fetchYahooProfile,
	fetchYahooStatement,
	type YahooClient
} from './yahoo';
import { SourceError } from './source-error';

const fake = (overrides: Partial<YahooClient> = {}): YahooClient => ({
	chart: vi.fn(async () => ({ meta: { gmtoffset: 3600 }, quotes: [{ date: new Date('2026-10-23T08:00:00Z'), close: 39.5, volume: 10 }] })),
	quoteSummary: vi.fn(async (_s: string, o: { modules: string[] }) =>
		o.modules.includes('assetProfile')
			? { assetProfile: { sector: 'Financial Services' }, price: { longName: 'ABN AMRO Bank N.V.', currency: 'EUR' } }
			: { financialData: { financialCurrency: 'EUR' }, price: { longName: 'ABN AMRO Bank N.V.', currency: 'EUR' } }
	),
	search: vi.fn(async () => ({ news: [{ title: 'Headline', publisher: 'RBI', link: 'https://finance.yahoo.com/n/1', providerPublishTime: new Date('2026-10-25T14:30:00Z') }] })),
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
		const [symbol, options, moduleOptions] = vi.mocked(client.chart).mock.calls[0];
		expect(symbol).toBe('ABN.AS');
		expect(options.interval).toBe('1d');
		expect(options.period1.toISOString().slice(0, 10)).toBe('2025-10-26');
		expect(options.period2.toISOString().slice(0, 10)).toBe('2026-10-26');
		expect(moduleOptions).toEqual({ validateResult: false });
	});
	it('puts quotes on the exchange-local date', async () => {
		const client = fake({
			chart: vi.fn(async () => ({ meta: { gmtoffset: 39600 }, quotes: [{ date: new Date('2026-10-26T23:00:00Z'), close: 5, volume: 1 }] }))
		});
		expect((await fetchYahooPrices('BHP.AX', '2026-10-01', '2026-10-27', client))[0].date).toBe('2026-10-27');
	});
});

describe('fetchYahooProfile', () => {
	it('reads the asset profile and price modules', async () => {
		const client = fake();
		const profile = await fetchYahooProfile('ABN.AS', client);
		expect(profile?.name).toBe('ABN AMRO Bank N.V.');
		expect(profile?.sector).toBe('Financial Services');
		const [, options, moduleOptions] = vi.mocked(client.quoteSummary).mock.calls[0];
		expect(options.modules).toEqual(['assetProfile', 'price']);
		expect(moduleOptions).toEqual({ validateResult: false });
	});
});

describe('fetchYahooNews', () => {
	it('searches by company name, falling back to the ticker', async () => {
		const client = fake();
		const items = await fetchYahooNews('ABN.AS', client);
		expect(items).toHaveLength(1);
		expect(vi.mocked(client.search).mock.calls[0][0]).toBe('ABN AMRO Bank N.V.');
		expect(vi.mocked(client.search).mock.calls[0][1]).toEqual({ newsCount: 20, quotesCount: 0 });

		const noName = fake({ quoteSummary: vi.fn(async () => { throw new Error('boom'); }) });
		await fetchYahooNews('ABN.AS', noName);
		expect(vi.mocked(noName.search).mock.calls[0][0]).toBe('ABN.AS');
	});
	it('returns [] when Yahoo has no news', async () => {
		expect(await fetchYahooNews('X.AS', fake({ search: vi.fn(async () => ({})) }))).toEqual([]);
	});
});

describe('fetchYahooStatement', () => {
	it('fetches the annual series and the reporting currency', async () => {
		const client = fake();
		const s = await fetchYahooStatement('income', 'ABN.AS', 'annual', client);
		expect(s.years[0].values.totalRevenue).toBe(130);
		expect(s.years[0].currency).toBe('EUR');
		expect(vi.mocked(client.fundamentalsTimeSeries)).toHaveBeenCalledTimes(1);
		const [, options, moduleOptions] = vi.mocked(client.fundamentalsTimeSeries).mock.calls[0];
		expect(options).toMatchObject({ type: 'annual', module: 'financials' });
		expect(moduleOptions).toEqual({ validateResult: false });
	});
	it('uses the trailing series, and only that, for TTM income and cash flow', async () => {
		const client = fake();
		const s = await fetchYahooStatement('cashflow', 'ABN.AS', 'ttm', client);
		expect(s.years[0].values.totalRevenue).toBe(120);
		const calls = vi.mocked(client.fundamentalsTimeSeries).mock.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0][1]).toMatchObject({ type: 'trailing', module: 'cash-flow' });
	});
	it('uses only the annual series for the TTM balance sheet', async () => {
		const client = fake();
		await fetchYahooStatement('balance', 'ABN.AS', 'ttm', client);
		const calls = vi.mocked(client.fundamentalsTimeSeries).mock.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0][1]).toMatchObject({ type: 'annual', module: 'balance-sheet' });
	});
	it('carries on without a currency when the lookup fails', async () => {
		const client = fake({ quoteSummary: vi.fn(async () => { throw new Error('boom'); }) });
		expect((await fetchYahooStatement('income', 'ABN.AS', 'annual', client)).years[0].currency).toBeNull();
	});
});

describe('errors', () => {
	const failing = (error: Error) => fake({
		chart: vi.fn(async () => { throw error; }),
		quoteSummary: vi.fn(async () => { throw error; }),
		fundamentalsTimeSeries: vi.fn(async () => { throw error; })
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
		const limited = await fetchYahooPrices('X', '2025-10-26', '2026-10-26', failing(new Error('HTTP 429 Too Many Requests'))).catch((e: unknown) => e);
		expect(limited).toBeInstanceOf(SourceError);
		expect((limited as SourceError).kind).toBe('limit');
		const broken = await fetchYahooProfile('X', failing(new Error('fetch failed https://query1.finance.yahoo.com/v7?crumb=SECRET'))).catch((e: unknown) => e);
		expect(broken).toBeInstanceOf(SourceError);
		expect((broken as SourceError).kind).toBe('unavailable');
		expect((broken as Error).message).not.toMatch(/https?:|crumb|SECRET/);
	});
});
