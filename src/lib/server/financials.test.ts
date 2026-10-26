// src/lib/server/financials.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Nav } from '../financials-nav';
import { FmpError, type Statement } from './fmp';
import type { NewsItem, Profile } from './fmp-info';
import { loadFinancials, statementTitle, type StatementFetcher } from './financials';

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
	it('fetches nothing on the Stock Price placeholder', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const profileFetcher = vi.fn();
		const newsFetcher = vi.fn();
		expect(await loadFinancials({ ...base, nav: { ...nav, tab: 'price' }, fetcher, profileFetcher, newsFetcher })).toEqual({ state: 'soon' });
		expect(fetcher).not.toHaveBeenCalled();
		expect(profileFetcher).not.toHaveBeenCalled();
		expect(newsFetcher).not.toHaveBeenCalled();
	});
	it('still requires a session on the placeholder tabs', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const view = await loadFinancials({ ...base, authed: false, nav: { ...nav, tab: 'news' }, fetcher });
		expect(view).toEqual({ state: 'locked' });
	});
	it('fetches only the selected statement, with the period', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		const view = await loadFinancials({ ...base, nav: { ...nav, statement: 'balance', period: 'ttm' }, fetcher });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledWith('balance', 'AAPL', 'KEY', 'ttm');
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
			nav: { ...nav, period: 'ttm' },
			fetcher: async () => ({ lines: [], years: [] })
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
