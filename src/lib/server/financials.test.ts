// src/lib/server/financials.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FmpError, type Statement } from './fmp';
import { loadFinancials, type StatementFetcher } from './financials';

const statement: Statement = {
	lines: ['revenue'],
	years: [{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { revenue: 5_000_000 } }]
};

afterEach(() => {
	vi.restoreAllMocks();
});

const base = { authed: true, rawSymbol: 'aapl', apiKey: 'KEY' };

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
	it('loads the three statements for the normalised ticker', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		const view = await loadFinancials({ ...base, fetcher });
		expect(view.state).toBe('ready');
		if (view.state !== 'ready') return;
		expect(view.symbol).toBe('AAPL');
		expect(view.tables.map((t) => [t.kind, t.title])).toEqual([
			['income', 'Income statement'],
			['balance', 'Balance sheet'],
			['cashflow', 'Cash flow statement']
		]);
		expect(view.tables.every((t) => t.table && t.message === null)).toBe(true);
		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(fetcher).toHaveBeenCalledWith('income', 'AAPL', 'KEY');
	});
	it('still shows the other statements when one fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher: StatementFetcher = async (kind) => {
			if (kind === 'balance') throw new FmpError('limit', 'FMP rate limit reached');
			return statement;
		};
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		const balance = view.tables.find((t) => t.kind === 'balance')!;
		expect(balance.table).toBeNull();
		expect(balance.message).toMatch(/rate limit/i);
		expect(view.tables.filter((t) => t.table)).toHaveLength(2);
	});
	it('says so when there are no annual statements', async () => {
		const fetcher: StatementFetcher = async () => ({ lines: [], years: [] });
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.tables.every((t) => t.table === null && /no annual statements/i.test(t.message ?? ''))).toBe(true);
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
		const fetcher: StatementFetcher = async (kind) => {
			if (kind === 'cashflow') {
				throw new Error('boom https://financialmodelingprep.com/stable/x?apikey=TOPSECRET');
			}
			return statement;
		};
		const view = await loadFinancials({ ...base, apiKey: 'TOPSECRET', fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		const failed = view.tables.find((t) => t.kind === 'cashflow')!;
		expect(failed.table).toBeNull();
		expect(failed.message).toMatch(/FMP is unavailable/);
		expect(failed.message).not.toContain('TOPSECRET');
		expect(view.tables.filter((t) => t.table)).toHaveLength(2);
		const logged = JSON.stringify([spy.mock.calls, warn.mock.calls, log.mock.calls]);
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('financialmodelingprep');
	});
});
