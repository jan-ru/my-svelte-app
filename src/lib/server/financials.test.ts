// src/lib/server/financials.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Nav } from '../financials-nav';
import { FmpError, type Statement } from './fmp';
import type { NewsItem, PricePoint, Profile } from './fmp-info';
import { loadFinancials, statementTitle, type StatementFetcher } from './financials';
import type { SourceFetchers } from './financials';

const statement: Statement = {
	lines: ['revenue'],
	years: [{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { revenue: 5_000_000 } }]
};
const nav: Nav = { tab: 'financials', statement: 'income', period: 'annual' };
const base = { authed: true, nav, rawSymbol: 'aapl', apiKey: 'KEY' };

afterEach(() => {
	vi.restoreAllMocks();
});

describe('statementTitle', () => {
	it('names each statement, and the TTM balance sheet as the latest one', () => {
		expect(statementTitle('income', 'annual')).toBe('Income statement');
		expect(statementTitle('income', 'ttm')).toBe('Income statement (trailing twelve months)');
		expect(statementTitle('cashflow', 'ttm')).toBe('Cash flow statement (trailing twelve months)');
		expect(statementTitle('balance', 'annual')).toBe('Balance sheet');
		expect(statementTitle('balance', 'ttm')).toBe('Latest balance sheet');
	});
});

describe('loadFinancials', () => {
	it('does not call FMP without a session', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, authed: false, fetcher })).toEqual({ state: 'locked' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('does not call FMP without an API key', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, apiKey: undefined, fetcher })).toEqual({ state: 'unconfigured' });
		expect(await loadFinancials({ ...base, apiKey: '', fetcher })).toEqual({ state: 'unconfigured' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('is idle without a ticker and invalid for a bad one, without calling FMP', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, rawSymbol: null, fetcher })).toEqual({ state: 'idle' });
		expect(await loadFinancials({ ...base, rawSymbol: '', fetcher })).toEqual({ state: 'idle' });
		expect(await loadFinancials({ ...base, rawSymbol: 'A&B', fetcher })).toEqual({ state: 'invalid' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	describe('price tab', () => {
		const priceNav: Nav = { ...nav, tab: 'price' };
		const points: PricePoint[] = [
			{ date: '2026-10-22', close: 100, volume: 10 },
			{ date: '2026-10-23', close: 101, volume: 11 }
		];
		const others = () => ({
			fetcher: vi.fn<StatementFetcher>(),
			profileFetcher: vi.fn(),
			newsFetcher: vi.fn()
		});

		it('fetches only prices, for the upper-cased ticker', async () => {
			const pricesFetcher = vi.fn().mockResolvedValue(points);
			const o = others();
			const view = await loadFinancials({ ...base, nav: priceNav, pricesFetcher, ...o });
			expect(view).toEqual({ state: 'price', symbol: 'AAPL', points, message: null });
			expect(pricesFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
			expect(o.fetcher).not.toHaveBeenCalled();
			expect(o.profileFetcher).not.toHaveBeenCalled();
			expect(o.newsFetcher).not.toHaveBeenCalled();
		});
		it('requires a session, a key and a valid ticker before calling FMP', async () => {
			const pricesFetcher = vi.fn();
			expect(await loadFinancials({ ...base, nav: priceNav, authed: false, pricesFetcher })).toEqual({ state: 'locked' });
			expect(await loadFinancials({ ...base, nav: priceNav, apiKey: undefined, pricesFetcher })).toEqual({ state: 'unconfigured' });
			expect(await loadFinancials({ ...base, nav: priceNav, rawSymbol: '', pricesFetcher })).toEqual({ state: 'idle' });
			expect(await loadFinancials({ ...base, nav: priceNav, rawSymbol: 'A&B', pricesFetcher })).toEqual({ state: 'invalid' });
			expect(pricesFetcher).not.toHaveBeenCalled();
		});
		it('says so when there is no history', async () => {
			const pricesFetcher = vi.fn().mockResolvedValue([]);
			const view = await loadFinancials({ ...base, nav: priceNav, pricesFetcher });
			expect(view).toEqual({ state: 'price', symbol: 'AAPL', points: [], message: 'No price history found for AAPL.' });
		});
		it('maps FMP failures to messages without leaking details', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const pricesFetcher = vi.fn().mockRejectedValue(new FmpError('limit', 'secret detail'));
			const view = await loadFinancials({ ...base, nav: priceNav, pricesFetcher });
			if (view.state !== 'price') throw new Error('expected price');
			expect(view.points).toEqual([]);
			expect(view.message).toBe('FMP rate limit reached. Try again in a minute.');
			expect(JSON.stringify(view)).not.toContain('secret detail');
		});
	});
	it('still requires a session on the placeholder tabs', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const view = await loadFinancials({ ...base, authed: false, nav: { ...nav, tab: 'news' }, fetcher });
		expect(view).toEqual({ state: 'locked' });
	});
	it('fetches only the selected statement, with the period', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		// TTM is only available from Yahoo (FMP is forced to annual), so route the view there
		const view = await loadFinancials({
			...base,
			nav: { ...nav, statement: 'balance', period: 'ttm', source: 'yahoo' },
			yahoo: { statement: fetcher }
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledWith('balance', 'AAPL', '', 'ttm');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.symbol).toBe('AAPL');
		expect(view.title).toBe('Latest balance sheet');
		expect(view.table?.columns[0].year).toBe('TTM');
		expect(view.message).toBeNull();
	});
	it('shows the annual income statement by default', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.title).toBe('Income statement');
		expect(view.table?.columns[0].year).toBe('2024');
	});
	it('reports a failure for the selected statement only', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new FmpError('limit', 'FMP rate limit reached');
		};
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table).toBeNull();
		expect(view.message).toMatch(/rate limit/i);
	});
	it('says so when there are no figures', async () => {
		const annual = await loadFinancials({ ...base, fetcher: async () => ({ lines: [], years: [] }) });
		if (annual.state !== 'ready') throw new Error('expected ready');
		expect(annual.table).toBeNull();
		expect(annual.message).toMatch(/no annual statements/i);
		const ttm = await loadFinancials({
			...base,
			nav: { ...nav, period: 'ttm', source: 'yahoo' },
			yahoo: { statement: async () => ({ lines: [], years: [] }) }
		});
		if (ttm.state !== 'ready') throw new Error('expected ready');
		expect(ttm.message).toMatch(/trailing-twelve-month/i);
	});
	it('logs failures without the key and without a URL', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new FmpError('config', 'FMP rejected the API key');
		};
		await loadFinancials({ ...base, apiKey: 'TOPSECRET', fetcher });
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).toContain('AAPL');
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('apikey');
	});
	it('treats a non-FmpError as unavailable and logs nothing sensitive', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new Error('boom https://financialmodelingprep.com/stable/x?apikey=TOPSECRET');
		};
		const view = await loadFinancials({ ...base, apiKey: 'TOPSECRET', fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table).toBeNull();
		expect(view.message).toMatch(/FMP is unavailable/);
		expect(view.message).not.toContain('TOPSECRET');
		const logged = JSON.stringify([spy.mock.calls, warn.mock.calls, log.mock.calls]);
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('financialmodelingprep');
	});
});

const profile = { name: 'Apple Inc.' } as Profile;
const newsItem: NewsItem = { title: 'T', publisher: null, date: null, text: null, url: null };

describe('company and news tabs', () => {
	it('loads only the profile on the company tab', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const profileFetcher = vi.fn().mockResolvedValue(profile);
		const newsFetcher = vi.fn();
		const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'company' }, fetcher, profileFetcher, newsFetcher });
		expect(view).toEqual({ state: 'profile', symbol: 'AAPL', profile, message: null });
		expect(profileFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
		expect(fetcher).not.toHaveBeenCalled();
		expect(newsFetcher).not.toHaveBeenCalled();
	});
	it('loads only the news on the news tab', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const profileFetcher = vi.fn();
		const newsFetcher = vi.fn().mockResolvedValue([newsItem]);
		const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'news' }, fetcher, profileFetcher, newsFetcher });
		expect(view).toEqual({ state: 'news', symbol: 'AAPL', items: [newsItem], message: null });
		expect(newsFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
		expect(profileFetcher).not.toHaveBeenCalled();
	});
	it('says so when there is no profile or no news', async () => {
		const noProfile = await loadFinancials({ ...base, nav: { ...nav, tab: 'company' }, profileFetcher: async () => null });
		expect(noProfile).toEqual({ state: 'profile', symbol: 'AAPL', profile: null, message: 'No company profile found for AAPL.' });
		const noNews = await loadFinancials({ ...base, nav: { ...nav, tab: 'news' }, newsFetcher: async () => [] });
		expect(noNews).toEqual({ state: 'news', symbol: 'AAPL', items: [], message: 'No recent news found for AAPL.' });
	});
	it('guards both tabs: no key, no ticker, bad ticker, no session', async () => {
		for (const tab of ['company', 'news'] as const) {
			const profileFetcher = vi.fn();
			const newsFetcher = vi.fn();
			const n = { ...nav, tab };
			expect(await loadFinancials({ ...base, authed: false, nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'locked' });
			expect(await loadFinancials({ ...base, apiKey: '', nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'unconfigured' });
			expect(await loadFinancials({ ...base, rawSymbol: '', nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'idle' });
			expect(await loadFinancials({ ...base, rawSymbol: 'A&B', nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'invalid' });
			expect(profileFetcher).not.toHaveBeenCalled();
			expect(newsFetcher).not.toHaveBeenCalled();
		}
	});
	it('maps failures to messages and logs without key or URL', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const boom = async () => {
			throw new FmpError('plan', 'Not available on this FMP plan');
		};
		const c = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: { ...nav, tab: 'company' }, profileFetcher: boom });
		const n = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: { ...nav, tab: 'news' }, newsFetcher: boom });
		if (c.state !== 'profile' || n.state !== 'news') throw new Error('unexpected state');
		expect(c.message).toMatch(/plan/i);
		expect(n.message).toMatch(/plan/i);
		expect(c.profile).toBeNull();
		expect(n.items).toEqual([]);
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).toContain('AAPL');
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('apikey');
	});
});

describe('sources', () => {
	const yahooStatement: Statement = {
		lines: ['totalRevenue'],
		years: [{ fiscalYear: '2025', date: '2025-12-31', currency: 'EUR', values: { totalRevenue: 9_000_000_000 } }]
	};
	const yahooPoints: PricePoint[] = [{ date: '2026-10-23', close: 39.5, volume: 10 }];
	const fakes = () => ({
		fmp: {
			fetcher: vi.fn<StatementFetcher>().mockResolvedValue(statement),
			profileFetcher: vi.fn(),
			newsFetcher: vi.fn(),
			pricesFetcher: vi.fn()
		},
		yahoo: {
			statement: vi.fn<StatementFetcher>().mockResolvedValue(yahooStatement),
			profile: vi.fn().mockResolvedValue({ name: 'ABN AMRO' } as Profile),
			news: vi.fn().mockResolvedValue([] as NewsItem[]),
			prices: vi.fn().mockResolvedValue(yahooPoints)
		} satisfies SourceFetchers
	});

	it('serves a non-US ticker from Yahoo only, without an FMP key', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, rawSymbol: 'abn.as', apiKey: undefined, nav: { ...nav, tab: 'price' }, ...fmp, yahoo });
		expect(view).toEqual({ state: 'price', symbol: 'ABN.AS', points: yahooPoints, message: null });
		expect(yahoo.prices).toHaveBeenCalledWith('ABN.AS', '');
		expect(fmp.pricesFetcher).not.toHaveBeenCalled();
	});
	it('ignores source=fmp for a non-US ticker', async () => {
		const { fmp, yahoo } = fakes();
		await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, tab: 'company', source: 'fmp' }, ...fmp, yahoo });
		expect(yahoo.profile).toHaveBeenCalled();
		expect(fmp.profileFetcher).not.toHaveBeenCalled();
	});
	it('serves a US ticker from FMP by default and from Yahoo on request', async () => {
		const { fmp, yahoo } = fakes();
		await loadFinancials({ ...base, ...fmp, yahoo });
		expect(fmp.fetcher).toHaveBeenCalledTimes(1);
		expect(yahoo.statement).not.toHaveBeenCalled();
		await loadFinancials({ ...base, nav: { ...nav, source: 'yahoo' }, ...fmp, yahoo });
		expect(yahoo.statement).toHaveBeenCalledTimes(1);
		expect(fmp.fetcher).toHaveBeenCalledTimes(1);
	});
	it('needs the FMP key only for FMP views', async () => {
		const { fmp, yahoo } = fakes();
		expect(await loadFinancials({ ...base, apiKey: undefined, ...fmp, yahoo })).toEqual({ state: 'unconfigured' });
		const view = await loadFinancials({ ...base, apiKey: undefined, nav: { ...nav, source: 'yahoo' }, ...fmp, yahoo });
		expect(view.state).toBe('ready');
	});
	it('never asks FMP for TTM: the period becomes annual', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, nav: { ...nav, period: 'ttm' }, ...fmp, yahoo });
		expect(fmp.fetcher).toHaveBeenCalledWith('income', 'AAPL', 'KEY', 'annual');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.title).toBe('Income statement');
		expect(view.table?.columns[0].year).toBe('2024');
	});
	it('asks Yahoo for TTM when it is the source', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, period: 'ttm' }, ...fmp, yahoo });
		expect(yahoo.statement).toHaveBeenCalledWith('income', 'ABN.AS', '', 'ttm');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table?.columns[0].year).toBe('TTM');
		expect(view.table?.currency).toBe('EUR');
	});
	it('still requires a session first, and a valid ticker', async () => {
		const { fmp, yahoo } = fakes();
		expect(await loadFinancials({ ...base, authed: false, rawSymbol: 'ABN.AS', ...fmp, yahoo })).toEqual({ state: 'locked' });
		expect(await loadFinancials({ ...base, rawSymbol: 'A.B&C', ...fmp, yahoo })).toEqual({ state: 'invalid' });
		expect(await loadFinancials({ ...base, rawSymbol: '', nav: { ...nav, source: 'yahoo' }, apiKey: undefined, ...fmp, yahoo })).toEqual({ state: 'idle' });
		expect(yahoo.statement).not.toHaveBeenCalled();
	});
	it('names the effective source in failure messages', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { fmp, yahoo } = fakes();
		yahoo.statement.mockRejectedValue(new FmpError('limit', 'x'));
		const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', ...fmp, yahoo });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.message).toBe('Yahoo Finance rate limit reached. Try again in a minute.');
		yahoo.profile.mockRejectedValue(new FmpError('unavailable', 'x'));
		const profile = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, tab: 'company' }, ...fmp, yahoo });
		if (profile.state !== 'profile') throw new Error('expected profile');
		expect(profile.message).toBe('Yahoo Finance is unavailable right now. Try again shortly.');
	});
});
