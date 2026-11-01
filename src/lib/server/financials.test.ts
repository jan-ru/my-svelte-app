// src/lib/server/financials.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Nav } from '../financials-nav';
import { TABS } from '../financials-nav';
import { loadFinancials, statementTitle, type StatementFetcher } from './financials';
import type { SourceFetchers } from './financials';
import type { NewsItem, PricePoint, Profile, Statement } from '../source-data';
import { SourceError } from './source-error';

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

describe('every tab', () => {
	it('has a loader that answers with its own view, and none falls through to another', async () => {
		const empty = async () => ({ lines: [], years: [] });
		const fmp = {
			statement: empty,
			ratios: empty,
			estimates: empty,
			earnings: empty,
			priceTarget: async () => null,
			peers: async () => [],
			profile: async () => null,
			news: async () => [],
			prices: async () => []
		};
		const states = new Map<string, string>();
		for (const { id } of TABS) {
			const view = await loadFinancials({ ...base, nav: { ...nav, tab: id }, fmp });
			states.set(id, view.state);
		}
		expect(Object.fromEntries(states)).toEqual({
			financials: 'ready',
			ratios: 'ready',
			estimates: 'ready',
			earnings: 'ready',
			peers: 'peers',
			news: 'news',
			price: 'price',
			company: 'profile'
		});
	});
});

describe('loadFinancials', () => {
	it('does not call FMP without a session', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, authed: false, fmp: { statement: fetcher } })).toEqual({ state: 'locked' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('does not call FMP without an API key', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, apiKey: undefined, fmp: { statement: fetcher } })).toEqual({ state: 'unconfigured' });
		expect(await loadFinancials({ ...base, apiKey: '', fmp: { statement: fetcher } })).toEqual({ state: 'unconfigured' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('is idle without a ticker and invalid for a bad one, without calling FMP', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, rawSymbol: null, fmp: { statement: fetcher } })).toEqual({ state: 'idle' });
		expect(await loadFinancials({ ...base, rawSymbol: '', fmp: { statement: fetcher } })).toEqual({ state: 'idle' });
		expect(await loadFinancials({ ...base, rawSymbol: 'A&B', fmp: { statement: fetcher } })).toEqual({ state: 'invalid' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	describe('ratios tab', () => {
		const ratiosNav: Nav = { ...nav, tab: 'ratios' };
		const ratios: Statement = {
			lines: ['priceToEarningsRatio'],
			years: [{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { priceToEarningsRatio: 28.456 } }]
		};
		it('builds a table of plain-number ratios from the ratios fetcher only', async () => {
			const fetcher = vi.fn<StatementFetcher>();
			const ratiosFetcher = vi.fn().mockResolvedValue(ratios);
			const view = await loadFinancials({ ...base, nav: ratiosNav, fmp: { statement: fetcher, ratios: ratiosFetcher } });
			if (view.state !== 'ready' || !view.table) throw new Error('unexpected state');
			expect(view.title).toBe('Financial ratios');
			expect(view.table.rows[0]?.cells).toEqual(['28.46']);
			expect(view.table.currency).toBeNull();
			expect(ratiosFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
			expect(fetcher).not.toHaveBeenCalled();
		});
		it('says so when FMP has no ratios for the company', async () => {
			const view = await loadFinancials({ ...base, nav: ratiosNav, fmp: { ratios: async () => ({ lines: [], years: [] }) } });
			expect(view).toMatchObject({ state: 'ready', table: null, message: 'FMP has no ratios for AAPL.' });
		});
		it('maps a plan error to a message and logs without the key', async () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const ratiosFetcher = async () => {
				throw new SourceError('plan', 'Not available on this FMP plan');
			};
			const view = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: ratiosNav, fmp: { ratios: ratiosFetcher } });
			if (view.state !== 'ready') throw new Error('unexpected state');
			expect(view.table).toBeNull();
			expect(view.message).toMatch(/plan/i);
			expect(JSON.stringify(spy.mock.calls)).not.toContain('TOPSECRET');
		});
		it('does not offer ratios from Yahoo and does not call FMP', async () => {
			const ratiosFetcher = vi.fn();
			const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: ratiosNav, fmp: { ratios: ratiosFetcher } });
			if (view.state !== 'ready') throw new Error('unexpected state');
			expect(view.table).toBeNull();
			expect(view.message).toMatch(/only available from Financial Modeling Prep/);
			expect(ratiosFetcher).not.toHaveBeenCalled();
		});
		it('guards: no session, no key, no ticker, bad ticker', async () => {
			const ratiosFetcher = vi.fn();
			expect(await loadFinancials({ ...base, authed: false, nav: ratiosNav, fmp: { ratios: ratiosFetcher } })).toEqual({ state: 'locked' });
			expect(await loadFinancials({ ...base, apiKey: '', nav: ratiosNav, fmp: { ratios: ratiosFetcher } })).toEqual({ state: 'unconfigured' });
			expect(await loadFinancials({ ...base, rawSymbol: '', nav: ratiosNav, fmp: { ratios: ratiosFetcher } })).toEqual({ state: 'idle' });
			expect(await loadFinancials({ ...base, rawSymbol: 'A&B', nav: ratiosNav, fmp: { ratios: ratiosFetcher } })).toEqual({ state: 'invalid' });
			expect(ratiosFetcher).not.toHaveBeenCalled();
		});
	});
	describe('estimates, earnings and peers tabs', () => {
		const estimates: Statement = {
			lines: ['revenueAvg', 'numAnalystsEps'],
			years: [{ fiscalYear: '2027', date: '2027-09-30', currency: null, values: { revenueAvg: 5e11, numAnalystsEps: 31 } }]
		};
		const target = { consensus: 205.5, median: 210, high: 250, low: 150 };
		const estNav: Nav = { ...nav, tab: 'estimates' };

		it('shows estimates with the price target', async () => {
			const estimatesFetcher = vi.fn().mockResolvedValue(estimates);
			const priceTargetFetcher = vi.fn().mockResolvedValue(target);
			const view = await loadFinancials({ ...base, nav: estNav, fmp: { estimates: estimatesFetcher, priceTarget: priceTargetFetcher } });
			if (view.state !== 'ready' || !view.table) throw new Error('unexpected state');
			expect(view.title).toBe('Analyst estimates');
			expect(view.table.rows.map((r) => r.cells)).toEqual([['500,000.0'], ['31']]);
			expect(view.target).toEqual(target);
		});
		it('keeps the estimates table when only the price target fails', async () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const priceTargetFetcher = async () => {
				throw new SourceError('plan', 'Not available on this FMP plan');
			};
			const view = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: estNav, fmp: { estimates: async () => estimates, priceTarget: priceTargetFetcher } });
			if (view.state !== 'ready') throw new Error('unexpected state');
			expect(view.table).not.toBeNull();
			expect(view.target).toBeNull();
			expect(JSON.stringify(spy.mock.calls)).not.toContain('TOPSECRET');
		});
		it('does not hide a failing price target behind an estimates failure', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const view = await loadFinancials({
				...base,
				nav: estNav,
				fmp: { estimates: async () => {
					throw new SourceError('limit', 'FMP rate limit reached');
				}, priceTarget: async () => {
					throw new SourceError('limit', 'FMP rate limit reached');
				} }
			});
			if (view.state !== 'ready') throw new Error('unexpected state');
			expect(view.table).toBeNull();
			expect(view.message).toMatch(/rate limit/i);
		});
		it('shows earnings with per-share and amount formatting', async () => {
			const earnings: Statement = {
				lines: ['epsActual', 'revenueActual'],
				years: [{ fiscalYear: '2025-10-30', date: '2025-10-30', currency: null, values: { epsActual: 1.85, revenueActual: 1.02e11 } }]
			};
			const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'earnings' }, fmp: { earnings: async () => earnings } });
			if (view.state !== 'ready' || !view.table) throw new Error('unexpected state');
			expect(view.title).toBe('Earnings');
			expect(view.table.rows.map((r) => r.cells)).toEqual([['1.85'], ['102,000.0']]);
			expect(view.target).toBeUndefined();
		});
		it('lists peers, and says so when there are none or the call fails', async () => {
			const peersNav: Nav = { ...nav, tab: 'peers' };
			const peers = [{ symbol: 'MSFT', name: 'Microsoft', price: 400, marketCap: 3e12 }];
			expect(await loadFinancials({ ...base, nav: peersNav, fmp: { peers: async () => peers } })).toEqual({ state: 'peers', symbol: 'AAPL', peers, message: null });
			expect(await loadFinancials({ ...base, nav: peersNav, fmp: { peers: async () => [] } })).toMatchObject({ peers: [], message: 'No peers found for AAPL.' });
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const failed = await loadFinancials({
				...base,
				nav: peersNav,
				fmp: { peers: async () => {
					throw new SourceError('plan', 'Not available on this FMP plan');
				} }
			});
			expect(failed).toMatchObject({ state: 'peers', peers: [] });
			expect(failed.state === 'peers' && failed.message).toMatch(/plan/i);
		});
		it('has no earnings, estimates or peers from Yahoo and calls none of the FMP fetchers', async () => {
			const fetchers = { estimates: vi.fn(), priceTarget: vi.fn(), earnings: vi.fn(), peers: vi.fn() };
			for (const [tab, what] of [['estimates', 'Estimates'], ['earnings', 'Earnings'], ['peers', 'Peers']] as const) {
				const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, tab }, fmp: fetchers });
				expect(view).toMatchObject({ message: `${what} are only available from Financial Modeling Prep, not Yahoo Finance. Choose FMP for a US ticker.` });
			}
			for (const f of Object.values(fetchers)) expect(f).not.toHaveBeenCalled();
		});
	});
	describe('price tab', () => {
		const priceNav: Nav = { ...nav, tab: 'price' };
		const points: PricePoint[] = [
			{ date: '2026-10-22', close: 100, volume: 10 },
			{ date: '2026-10-23', close: 101, volume: 11 }
		];
		const others = () => ({
			statement: vi.fn<StatementFetcher>(),
			profile: vi.fn(),
			news: vi.fn()
		});

		it('fetches only prices, for the upper-cased ticker', async () => {
			const pricesFetcher = vi.fn().mockResolvedValue(points);
			const o = others();
			const view = await loadFinancials({ ...base, nav: priceNav, fmp: { ...o, prices: pricesFetcher } });
			expect(view).toEqual({ state: 'price', symbol: 'AAPL', points, message: null });
			expect(pricesFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
			expect(o.statement).not.toHaveBeenCalled();
			expect(o.profile).not.toHaveBeenCalled();
			expect(o.news).not.toHaveBeenCalled();
		});
		it('requires a session, a key and a valid ticker before calling FMP', async () => {
			const pricesFetcher = vi.fn();
			expect(await loadFinancials({ ...base, nav: priceNav, authed: false, fmp: { prices: pricesFetcher } })).toEqual({ state: 'locked' });
			expect(await loadFinancials({ ...base, nav: priceNav, apiKey: undefined, fmp: { prices: pricesFetcher } })).toEqual({ state: 'unconfigured' });
			expect(await loadFinancials({ ...base, nav: priceNav, rawSymbol: '', fmp: { prices: pricesFetcher } })).toEqual({ state: 'idle' });
			expect(await loadFinancials({ ...base, nav: priceNav, rawSymbol: 'A&B', fmp: { prices: pricesFetcher } })).toEqual({ state: 'invalid' });
			expect(pricesFetcher).not.toHaveBeenCalled();
		});
		it('says so when there is no history', async () => {
			const pricesFetcher = vi.fn().mockResolvedValue([]);
			const view = await loadFinancials({ ...base, nav: priceNav, fmp: { prices: pricesFetcher } });
			expect(view).toEqual({ state: 'price', symbol: 'AAPL', points: [], message: 'No price history found for AAPL.' });
		});
		it('maps FMP failures to messages without leaking details', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const pricesFetcher = vi.fn().mockRejectedValue(new SourceError('limit', 'secret detail'));
			const view = await loadFinancials({ ...base, nav: priceNav, fmp: { prices: pricesFetcher } });
			if (view.state !== 'price') throw new Error('expected price');
			expect(view.points).toEqual([]);
			expect(view.message).toBe('FMP rate limit reached. Try again in a minute.');
			expect(JSON.stringify(view)).not.toContain('secret detail');
		});
	});
	it('still requires a session on the placeholder tabs', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const view = await loadFinancials({ ...base, authed: false, nav: { ...nav, tab: 'news' }, fmp: { statement: fetcher } });
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
		expect(view.table?.columns[0]?.year).toBe('TTM');
		expect(view.message).toBeNull();
	});
	it('shows the annual income statement by default', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		const view = await loadFinancials({ ...base, fmp: { statement: fetcher } });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.title).toBe('Income statement');
		expect(view.table?.columns[0]?.year).toBe('2024');
	});
	it('reports a failure for the selected statement only', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new SourceError('limit', 'FMP rate limit reached');
		};
		const view = await loadFinancials({ ...base, fmp: { statement: fetcher } });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table).toBeNull();
		expect(view.message).toMatch(/rate limit/i);
	});
	it('points to the other tabs when a source has no statements', async () => {
		const view = await loadFinancials({
			...base,
			rawSymbol: 'ABVN',
			nav: { ...nav, source: 'yahoo' },
			yahoo: { statement: async () => ({ lines: [], years: [] }) }
		});
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table).toBeNull();
		expect(view.message).toBe('Yahoo Finance has no annual statements for ABVN. Price, news and company data may still be available in the other tabs.');
	});
	it('says so when there are no figures', async () => {
		const annual = await loadFinancials({ ...base, fmp: { statement: async () => ({ lines: [], years: [] }) } });
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
			throw new SourceError('config', 'FMP rejected the API key');
		};
		await loadFinancials({ ...base, apiKey: 'TOPSECRET', fmp: { statement: fetcher } });
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).toContain('AAPL');
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('apikey');
	});
	it('treats a non-SourceError as unavailable and logs nothing sensitive', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new Error('boom https://financialmodelingprep.com/stable/x?apikey=TOPSECRET');
		};
		const view = await loadFinancials({ ...base, apiKey: 'TOPSECRET', fmp: { statement: fetcher } });
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
		const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'company' }, fmp: { statement: fetcher, profile: profileFetcher, news: newsFetcher } });
		expect(view).toEqual({ state: 'profile', symbol: 'AAPL', profile, message: null });
		expect(profileFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
		expect(fetcher).not.toHaveBeenCalled();
		expect(newsFetcher).not.toHaveBeenCalled();
	});
	it('loads only the news on the news tab', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const profileFetcher = vi.fn();
		const newsFetcher = vi.fn().mockResolvedValue([newsItem]);
		const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'news' }, fmp: { statement: fetcher, profile: profileFetcher, news: newsFetcher } });
		expect(view).toEqual({ state: 'news', symbol: 'AAPL', items: [newsItem], message: null });
		expect(newsFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
		expect(profileFetcher).not.toHaveBeenCalled();
	});
	it('says so when there is no profile or no news', async () => {
		const noProfile = await loadFinancials({ ...base, nav: { ...nav, tab: 'company' }, fmp: { profile: async () => null } });
		expect(noProfile).toEqual({ state: 'profile', symbol: 'AAPL', profile: null, message: 'No company profile found for AAPL.' });
		const noNews = await loadFinancials({ ...base, nav: { ...nav, tab: 'news' }, fmp: { news: async () => [] } });
		expect(noNews).toEqual({ state: 'news', symbol: 'AAPL', items: [], message: 'No recent news found for AAPL.' });
	});
	it('guards both tabs: no key, no ticker, bad ticker, no session', async () => {
		for (const tab of ['company', 'news'] as const) {
			const profileFetcher = vi.fn();
			const newsFetcher = vi.fn();
			const n = { ...nav, tab };
			expect(await loadFinancials({ ...base, authed: false, nav: n, fmp: { profile: profileFetcher, news: newsFetcher } })).toEqual({ state: 'locked' });
			expect(await loadFinancials({ ...base, apiKey: '', nav: n, fmp: { profile: profileFetcher, news: newsFetcher } })).toEqual({ state: 'unconfigured' });
			expect(await loadFinancials({ ...base, rawSymbol: '', nav: n, fmp: { profile: profileFetcher, news: newsFetcher } })).toEqual({ state: 'idle' });
			expect(await loadFinancials({ ...base, rawSymbol: 'A&B', nav: n, fmp: { profile: profileFetcher, news: newsFetcher } })).toEqual({ state: 'invalid' });
			expect(profileFetcher).not.toHaveBeenCalled();
			expect(newsFetcher).not.toHaveBeenCalled();
		}
	});
	it('maps failures to messages and logs without key or URL', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const boom = async () => {
			throw new SourceError('plan', 'Not available on this FMP plan');
		};
		const c = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: { ...nav, tab: 'company' }, fmp: { profile: boom } });
		const n = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: { ...nav, tab: 'news' }, fmp: { news: boom } });
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
			statement: vi.fn<StatementFetcher>().mockResolvedValue(statement),
			profile: vi.fn(),
			news: vi.fn(),
			prices: vi.fn()
		},
		yahoo: {
			statement: vi.fn<StatementFetcher>().mockResolvedValue(yahooStatement),
			profile: vi.fn().mockResolvedValue({ name: 'ABN AMRO' }),
			news: vi.fn().mockResolvedValue([] as NewsItem[]),
			prices: vi.fn().mockResolvedValue(yahooPoints)
		} satisfies SourceFetchers
	});

	it('serves a non-US ticker from Yahoo only, without an FMP key', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, rawSymbol: 'abn.as', apiKey: undefined, nav: { ...nav, tab: 'price' }, fmp, yahoo });
		expect(view).toEqual({ state: 'price', symbol: 'ABN.AS', points: yahooPoints, message: null });
		expect(yahoo.prices).toHaveBeenCalledWith('ABN.AS', '');
		expect(fmp.prices).not.toHaveBeenCalled();
	});
	it('ignores source=fmp for a non-US ticker', async () => {
		const { fmp, yahoo } = fakes();
		await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, tab: 'company', source: 'fmp' }, fmp, yahoo });
		expect(yahoo.profile).toHaveBeenCalled();
		expect(fmp.profile).not.toHaveBeenCalled();
	});
	it('serves a US ticker from FMP by default and from Yahoo on request', async () => {
		const { fmp, yahoo } = fakes();
		await loadFinancials({ ...base, fmp, yahoo });
		expect(fmp.statement).toHaveBeenCalledTimes(1);
		expect(yahoo.statement).not.toHaveBeenCalled();
		await loadFinancials({ ...base, nav: { ...nav, source: 'yahoo' }, fmp, yahoo });
		expect(yahoo.statement).toHaveBeenCalledTimes(1);
		expect(fmp.statement).toHaveBeenCalledTimes(1);
	});
	it('needs the FMP key only for FMP views', async () => {
		const { fmp, yahoo } = fakes();
		expect(await loadFinancials({ ...base, apiKey: undefined, fmp, yahoo })).toEqual({ state: 'unconfigured' });
		const view = await loadFinancials({ ...base, apiKey: undefined, nav: { ...nav, source: 'yahoo' }, fmp, yahoo });
		expect(view.state).toBe('ready');
	});
	it('never asks FMP for TTM: the period becomes annual', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, nav: { ...nav, period: 'ttm' }, fmp, yahoo });
		expect(fmp.statement).toHaveBeenCalledWith('income', 'AAPL', 'KEY', 'annual');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.title).toBe('Income statement');
		expect(view.table?.columns[0]?.year).toBe('2024');
	});
	it('asks Yahoo for TTM when it is the source', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, period: 'ttm' }, fmp, yahoo });
		expect(yahoo.statement).toHaveBeenCalledWith('income', 'ABN.AS', '', 'ttm');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table?.columns[0]?.year).toBe('TTM');
		expect(view.table?.currency).toBe('EUR');
	});
	it('still requires a session first, and a valid ticker', async () => {
		const { fmp, yahoo } = fakes();
		expect(await loadFinancials({ ...base, authed: false, rawSymbol: 'ABN.AS', fmp, yahoo })).toEqual({ state: 'locked' });
		expect(await loadFinancials({ ...base, rawSymbol: 'A.B&C', fmp, yahoo })).toEqual({ state: 'invalid' });
		expect(await loadFinancials({ ...base, rawSymbol: '', nav: { ...nav, source: 'yahoo' }, apiKey: undefined, fmp, yahoo })).toEqual({ state: 'idle' });
		expect(yahoo.statement).not.toHaveBeenCalled();
	});
	it('names the effective source in failure messages', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { fmp, yahoo } = fakes();
		yahoo.statement.mockRejectedValue(new SourceError('limit', 'x'));
		const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', fmp, yahoo });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.message).toBe('Yahoo Finance rate limit reached. Try again in a minute.');
		yahoo.profile.mockRejectedValue(new SourceError('unavailable', 'x'));
		const profile = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, tab: 'company' }, fmp, yahoo });
		if (profile.state !== 'profile') throw new Error('expected profile');
		expect(profile.message).toBe('Yahoo Finance is unavailable right now. Try again shortly.');
	});
});
