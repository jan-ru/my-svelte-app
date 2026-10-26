// src/lib/server/financials.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Nav } from '../financials-nav';
import { FmpError, type Statement } from './fmp';
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
	it('fetches nothing on the placeholder tabs', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		for (const tab of ['news', 'price', 'company'] as const) {
			expect(await loadFinancials({ ...base, nav: { ...nav, tab }, fetcher })).toEqual({ state: 'soon' });
		}
		expect(fetcher).not.toHaveBeenCalled();
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
