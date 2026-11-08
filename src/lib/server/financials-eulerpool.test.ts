import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Nav } from '../financials-nav';
import type { PricePoint, Statement } from '../source-data';
import { eulerpoolFetchers, fetchersOf, keyOf, loadFinancials } from './financials';
import type { StatementFetcher } from './financials';
import { SourceError } from './source-error';

const nav: Nav = { tab: 'financials', statement: 'income', period: 'annual', source: 'eulerpool' };
const base = { authed: true, nav, rawSymbol: 'abn.as', apiKey: 'FMPKEY', eulerpoolKey: 'EKEY' };

const statement: Statement = {
	lines: ['revenue'],
	years: [{ fiscalYear: '2025', date: '2025-12-31', currency: 'EUR', values: { revenue: 9_000_000_000 } }]
};
const points: PricePoint[] = [{ date: '2026-11-06', close: 39.5, volume: null }];
const fakes = () => ({
	eulerpool: {
		statement: vi.fn<StatementFetcher>().mockResolvedValue(statement),
		profile: vi.fn().mockResolvedValue({ name: 'ABN AMRO' }),
		prices: vi.fn().mockResolvedValue(points)
	},
	fmp: { statement: vi.fn(), profile: vi.fn(), prices: vi.fn(), news: vi.fn() },
	yahoo: { statement: vi.fn(), profile: vi.fn(), prices: vi.fn(), news: vi.fn() }
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Eulerpool as the source', () => {
	it('serves any ticker when asked, US or not, with its own key', async () => {
		const f = fakes();
		await loadFinancials({ ...base, ...f });
		expect(f.eulerpool.statement).toHaveBeenCalledWith('income', 'ABN.AS', 'EKEY', 'annual');
		await loadFinancials({ ...base, rawSymbol: 'aapl', ...f });
		expect(f.eulerpool.statement).toHaveBeenLastCalledWith('income', 'AAPL', 'EKEY', 'annual');
		expect(f.fmp.statement).not.toHaveBeenCalled();
		expect(f.yahoo.statement).not.toHaveBeenCalled();
	});
	it('is never chosen unless asked for', async () => {
		const f = fakes();
		const unasked: Nav = { tab: 'company', statement: 'income', period: 'annual' };
		await loadFinancials({ ...base, nav: unasked, rawSymbol: 'abn.as', ...f });
		expect(f.yahoo.profile).toHaveBeenCalled();
		await loadFinancials({ ...base, nav: unasked, rawSymbol: 'aapl', ...f });
		expect(f.fmp.profile).toHaveBeenCalled();
		expect(f.eulerpool.profile).not.toHaveBeenCalled();
	});
	it('needs its own key, not FMP', async () => {
		const f = fakes();
		expect(await loadFinancials({ ...base, eulerpoolKey: undefined, ...f })).toEqual({ state: 'unconfigured' });
		expect(await loadFinancials({ ...base, eulerpoolKey: '', ...f })).toEqual({ state: 'unconfigured' });
		const view = await loadFinancials({ ...base, apiKey: undefined, ...f });
		expect(view.state).toBe('ready');
		expect(f.eulerpool.statement).toHaveBeenCalledTimes(1);
	});
	it('does not need an FMP key or send one', async () => {
		const f = fakes();
		await loadFinancials({ ...base, apiKey: undefined, nav: { ...nav, tab: 'price' }, ...f });
		expect(f.eulerpool.prices).toHaveBeenCalledWith('ABN.AS', 'EKEY');
	});
	it('shows prices and the profile', async () => {
		const f = fakes();
		expect(await loadFinancials({ ...base, nav: { ...nav, tab: 'price' }, ...f })).toEqual({
			state: 'price',
			symbol: 'ABN.AS',
			points,
			message: null
		});
		const profile = await loadFinancials({ ...base, nav: { ...nav, tab: 'company' }, ...f });
		expect(profile).toMatchObject({ state: 'profile', profile: { name: 'ABN AMRO' }, message: null });
	});
	it('asks for annual statements even when TTM was requested, and says so in the title', async () => {
		const f = fakes();
		const view = await loadFinancials({ ...base, nav: { ...nav, period: 'ttm' }, ...f });
		expect(f.eulerpool.statement).toHaveBeenCalledWith('income', 'ABN.AS', 'EKEY', 'annual');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.title).toBe('Income statement');
		expect(view.table?.currency).toBe('EUR');
	});
	it('says there is no news instead of failing', async () => {
		const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'news' }, ...fakes() });
		expect(view).toEqual({
			state: 'news',
			symbol: 'ABN.AS',
			items: [],
			message: 'Eulerpool has no company news. Choose FMP or Yahoo Finance.'
		});
	});
	it.each(['ratios', 'estimates', 'earnings', 'peers'] as const)('says the %s tab is FMP only', async (tab) => {
		const view = await loadFinancials({ ...base, nav: { ...nav, tab }, ...fakes() });
		const message = 'message' in view ? view.message : null;
		expect(message).toContain('only available from Financial Modeling Prep, not Eulerpool');
	});
	it('names Eulerpool and its key in failure messages, without the key', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const f = fakes();
		f.eulerpool.statement.mockRejectedValue(new SourceError('config', 'Eulerpool rejected the API key'));
		const view = await loadFinancials({ ...base, ...f });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.message).toBe('The Eulerpool key was not accepted. Check EULERPOOL_API_KEY.');
		f.eulerpool.statement.mockRejectedValue(new SourceError('limit', 'x'));
		const limited = await loadFinancials({ ...base, ...f });
		if (limited.state !== 'ready') throw new Error('expected ready');
		expect(limited.message).toBe('Eulerpool rate limit reached. Try again in a minute.');
		expect(console.error).toHaveBeenLastCalledWith('Eulerpool income annual statement for ABN.AS failed (limit)');
	});
	it('still requires a session first', async () => {
		const f = fakes();
		expect(await loadFinancials({ ...base, authed: false, ...f })).toEqual({ state: 'locked' });
		expect(f.eulerpool.statement).not.toHaveBeenCalled();
	});
});

describe('fetchersOf and keyOf', () => {
	it('pick the set and the key of a source, with single members replaceable', () => {
		const replaced = vi.fn();
		expect(fetchersOf('eulerpool').statement).toBe(eulerpoolFetchers.statement);
		expect(fetchersOf('eulerpool', { eulerpool: { prices: replaced } }).prices).toBe(replaced);
		expect(fetchersOf('eulerpool', { yahoo: { prices: replaced } }).prices).not.toBe(replaced);
		const keys = { fmp: 'F', eulerpool: 'E' };
		expect([keyOf('fmp', keys), keyOf('eulerpool', keys), keyOf('yahoo', keys)]).toEqual(['F', 'E', '']);
		expect(keyOf('eulerpool', {})).toBe('');
	});
	it('offers statements, profile and prices only', () => {
		expect(Object.keys(eulerpoolFetchers).sort()).toEqual(['prices', 'profile', 'statement']);
	});
});
