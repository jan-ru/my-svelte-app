// src/lib/server/valuation.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./compare', () => ({
	getComparison: vi.fn(async () => ({
		updated: null,
		errors: {},
		cells: { ev_ebitda: { europe: { Semiconductor: { value: 14, firms: 30 } } } }
	}))
}));

import type { Kind, Peer, Profile, Statement } from '../source-data';
import { encodeCompany } from '../valuation/company';
import { parseValuationNav, type ValuationNav } from '../valuation/nav';
import { getComparison } from './compare';
import { SourceError } from './source-error';
import { loadSector, loadValuation, type ValuationFetchers } from './valuation';

const profile = (name: string, marketCap: number | null, currency = 'USD'): Profile => ({
	name,
	exchange: null,
	sector: null,
	industry: null,
	country: null,
	ceo: null,
	website: null,
	ipoDate: null,
	currency,
	description: null,
	employees: null,
	price: null,
	marketCap,
	beta: null
});
const st = (fiscalYear: string, values: Record<string, number | null>): Statement => ({
	lines: Object.keys(values),
	years: [{ fiscalYear, date: `${fiscalYear}-12-31`, currency: 'USD', values }]
});

interface Co {
	readonly profile: Profile | null;
	readonly income: Statement | Error;
	readonly balance?: Statement;
	readonly estimates?: Statement;
}
const COMPANIES: Record<string, Co> = {
	AAPL: {
		profile: profile('Apple', 3000),
		income: st('2025', { revenue: 400, ebitda: 140, netIncome: 100 }),
		balance: st('2025', { totalStockholdersEquity: 60, netDebt: 40 }),
		estimates: st('2026', { netIncomeAvg: 120 })
	},
	MSFT: {
		profile: profile('Microsoft', 3600),
		income: st('2025', { revenue: 300, ebitda: 160, netIncome: 90 }),
		balance: st('2025', { netDebt: 0 })
	},
	GOOG: {
		profile: profile('Alphabet', 2400),
		income: st('2025', { revenue: 350, ebitda: 150, netIncome: 100 }),
		balance: st('2025', { netDebt: -100 })
	},
	NOCAP: { profile: profile('No cap', null), income: st('2025', { revenue: 10 }) },
	BROKEN: { profile: null, income: new SourceError('limit', 'limit') },
	EMPTY: { profile: profile('Empty', 10), income: { lines: [], years: [] } }
};

function fetchers(log: string[] = []): ValuationFetchers {
	const co = (symbol: string) => COMPANIES[symbol] ?? { profile: null, income: new Error('unknown') };
	return {
		profile: async (symbol) => co(symbol).profile,
		statement: async (kind: Kind, symbol) => {
			log.push(`${kind}:${symbol}`);
			const c = co(symbol);
			if (kind === 'income') {
				if (c.income instanceof Error) throw c.income;
				return c.income;
			}
			if (!c.balance) throw new SourceError('plan', 'no balance');
			return c.balance;
		},
		estimates: async (symbol) => {
			log.push(`estimates:${symbol}`);
			const e = co(symbol).estimates;
			if (!e) throw new SourceError('plan', 'no estimates');
			return e;
		},
		peers: async (): Promise<Peer[]> => [
			{ symbol: 'MSFT', name: 'Microsoft', price: null, marketCap: null },
			{ symbol: 'AMZN', name: 'Amazon', price: null, marketCap: null },
			{ symbol: 'AAPL', name: 'Apple', price: null, marketCap: null }
		]
	};
}

const navOf = (query: string): ValuationNav => parseValuationNav(new URLSearchParams(query), ['Semiconductor']);
const run = (query: string, extra: Partial<Parameters<typeof loadValuation>[0]> = {}) => {
	const nav = navOf(query);
	return loadValuation({
		authed: true,
		nav,
		rawSymbol: new URLSearchParams(query).get('symbol'),
		apiKey: 'KEY',
		fmp: fetchers(),
		yahoo: fetchers(),
		sector: async () => ({}),
		...extra
	});
};

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe('loadValuation states', () => {
	it('is locked without a session', async () => {
		expect(await run('symbol=AAPL', { authed: false })).toEqual({ state: 'locked' });
	});
	it('is unconfigured for an FMP ticker without a key, but not for a Yahoo ticker', async () => {
		expect(await run('symbol=AAPL', { apiKey: undefined })).toEqual({ state: 'unconfigured' });
		expect((await run('symbol=ASML.AS', { apiKey: undefined })).state).toBe('ready');
	});
	it('is idle without a ticker and invalid for a bad one', async () => {
		expect(await run('')).toEqual({ state: 'idle' });
		expect(await run('symbol=bad!')).toEqual({ state: 'invalid' });
	});
});

describe('loadValuation ready', () => {
	it('values the company against the picked peers and the sector', async () => {
		const sector = vi.fn(async () => ({ ev_ebitda: 14 }));
		const view = await run(
			'symbol=aapl&peer=MSFT&peer=GOOG&m=ev_ebitda&m=pe_trailing&region=europe&industry=Semiconductor',
			{ sector }
		);
		if (view.state !== 'ready') throw new Error(view.state);
		expect(sector).toHaveBeenCalledWith(['ev_ebitda', 'pe_trailing'], 'europe', 'Semiconductor');
		expect(view.symbol).toBe('AAPL');
		expect(view.source).toBe('fmp');
		expect(view.company?.name).toBe('Apple');
		expect(view.message).toBeNull();
		expect(view.sectorMessage).toBeNull();
		// MSFT and AAPL are picked or the company itself, so only AMZN is still a suggestion
		expect(view.suggestions.map((p) => p.symbol)).toEqual(['AMZN']);
		expect(
			view.peers.map((p) => [p.symbol, p.name, p.multiples.ev_ebitda, p.multiples.pe_trailing, p.message])
		).toEqual([
			['MSFT', 'Microsoft', 22.5, 40, null],
			['GOOG', 'Alphabet', 2300 / 150, 24, null]
		]);
		const evEbitda = view.result?.methods[0];
		expect(evEbitda).toMatchObject({ ok: true, multiple: 'ev_ebitda', sector: 14 * 140 - 40 });
		expect(view.result?.benchmarks[0]).toMatchObject({ multiple: 'ev_ebitda', count: 2, sector: 14 });
	});
	it('applies manual bands from the URL', async () => {
		const view = await run('symbol=AAPL&peer=MSFT&m=ev_ebitda&lo.ev_ebitda=10&hi.ev_ebitda=20');
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.result?.methods[0]).toMatchObject({ ok: true, bandSource: 'manual', low: 1360, high: 2760 });
	});
	it('fetches analyst estimates only when a forward multiple is selected', async () => {
		const log: string[] = [];
		await run('symbol=AAPL&peer=MSFT&m=ps', { fmp: fetchers(log) });
		expect(log.filter((l) => l.startsWith('estimates'))).toEqual([]);
		const log2: string[] = [];
		const view = await run('symbol=AAPL&peer=MSFT&m=pe_forward', { fmp: fetchers(log2) });
		expect(log2.filter((l) => l.startsWith('estimates')).toSorted()).toEqual(['estimates:AAPL', 'estimates:MSFT']);
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.company?.years.map((y) => y.kind)).toEqual(['actual', 'forecast']);
	});
	it('explains peers without multiples', async () => {
		const view = await run('symbol=AAPL&peer=NOCAP&peer=BROKEN&peer=EMPTY');
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.peers.map((p) => p.message)).toEqual([
			'No market cap for NOCAP, so no multiples.',
			'FMP rate limit reached. Try again in a minute.',
			'FMP has no annual figures for EMPTY.'
		]);
		expect(view.peers[1]?.name).toBe('BROKEN');
	});
	it('needs the FMP key for a US peer even when the company comes from Yahoo', async () => {
		const view = await run('symbol=ASML.AS&peer=MSFT', { apiKey: undefined });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.peers[0]?.message).toBe('The FMP key is not configured.');
	});
	it.each([
		[new SourceError('config', 'x'), 'The FMP key was not accepted. Check FMP_API_KEY.'],
		[new SourceError('plan', 'x'), 'FMP does not provide this for AAPL on your plan (x).'],
		[new Error('boom'), 'FMP is unavailable right now for AAPL. Try again shortly.']
	])('has no result when the income statement fails (%s)', async (error, message) => {
		const fmp = { ...fetchers(), statement: async () => Promise.reject(error) };
		const view = await run('symbol=AAPL', { fmp });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view).toMatchObject({ company: null, result: null, message });
	});
	it('reports a sector failure and skips the sector without an industry', async () => {
		const failing = vi.fn(async () => Promise.reject(new Error('nyu down')));
		const view = await run('symbol=AAPL&industry=Semiconductor', { sector: failing });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.sectorMessage).toBe('The Damodaran sector values could not be loaded right now.');
		expect(view.result).not.toBeNull();
		const unused = vi.fn(async () => ({}));
		await run('symbol=AAPL', { sector: unused });
		expect(unused).not.toHaveBeenCalled();
	});
	it('has no suggestions from a source without peers', async () => {
		const { peers: _omit, ...yahoo } = fetchers();
		const view = await run('symbol=ASML.AS', { yahoo });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.suggestions).toEqual([]);
		expect(view.source).toBe('yahoo');
	});
});

describe('loadValuation for a private company', () => {
	const co = encodeCompany({
		name: 'ACCENSS BV',
		currency: 'EUR',
		origin: 'manual',
		netDebt: 0,
		years: [{ fiscalYear: '2025', kind: 'actual', values: { revenue: 1000, ebitda: 100 } }]
	});
	it('uses the uploaded figures, needs no ticker or key, and offers no suggestions', async () => {
		const log: string[] = [];
		const view = await run(`co=${co}&peer=ASML.AS&m=ev_ebitda`, { apiKey: undefined, yahoo: fetchers(log) });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view).toMatchObject({ symbol: '', source: 'manual', message: null, suggestions: [] });
		expect(view.company?.name).toBe('ACCENSS BV');
		expect(log.some((l) => l.endsWith(':ACCENSS BV'))).toBe(false);
		expect(view.result?.methods[0]).toMatchObject({ ok: false, reason: 'no-band' });
	});
});

describe('loadValuation with Eulerpool', () => {
	it('takes the company and its peers from Eulerpool when asked, with its own key', async () => {
		const log: string[] = [];
		const view = await run('symbol=AAPL&peer=MSFT&source=eulerpool', {
			apiKey: undefined,
			eulerpoolKey: 'EKEY',
			eulerpool: fetchers(log),
			fmp: fetchers(['fmp-was-used']),
			yahoo: fetchers(['yahoo-was-used'])
		});
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.source).toBe('eulerpool');
		expect(view.company?.origin).toBe('eulerpool');
		expect(log).toContain('income:AAPL');
		expect(log).toContain('income:MSFT');
		expect(view.peers[0]?.message).toBeNull();
	});
	it('is unconfigured without the Eulerpool key, whatever FMP has', async () => {
		expect(await run('symbol=AAPL&source=eulerpool', { eulerpoolKey: undefined })).toEqual({ state: 'unconfigured' });
	});
	it('says which key is missing for a peer', async () => {
		const view = await run('symbol=AAPL&peer=MSFT&source=eulerpool', { eulerpoolKey: 'EKEY', apiKey: undefined });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.peers).toHaveLength(1);
		const none = await run('symbol=AAPL&peer=MSFT', { apiKey: 'KEY', eulerpoolKey: undefined });
		if (none.state !== 'ready') throw new Error(none.state);
		expect(none.peers[0]?.message).toBeNull();
	});
});

describe('loadValuation insight', () => {
	const fairValue = {
		fairValue: 278.5,
		income: 278.5,
		revenue: 260.9,
		dividend: 270.4,
		lastPrice: 342.4,
		upside: -18.65,
		currency: 'USD'
	};
	const insightFetchers = (log: string[] = []) => ({
		fairValue: async (symbol: string, key: string) => {
			log.push(`fair:${symbol}:${key}`);
			return fairValue;
		},
		quality: async () => null
	});

	it('adds Eulerpool estimates beside the FMP figures when the key is set', async () => {
		const log: string[] = [];
		const view = await run('symbol=AAPL', { eulerpoolKey: 'EKEY', insight: insightFetchers(log) });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.source).toBe('fmp');
		expect(view.insight).toEqual({
			fairValue,
			quality: null,
			message: 'Eulerpool has no quality score for AAPL.'
		});
		expect(log).toEqual(['fair:AAPL:EKEY']);
	});
	it('leaves the valuation itself unchanged', async () => {
		const without = await run('symbol=AAPL&peer=MSFT&m=ev_ebitda');
		const withInsight = await run('symbol=AAPL&peer=MSFT&m=ev_ebitda', {
			eulerpoolKey: 'EKEY',
			insight: insightFetchers()
		});
		if (without.state !== 'ready' || withInsight.state !== 'ready') throw new Error('expected ready');
		expect(withInsight.result).toEqual(without.result);
		expect(withInsight.company).toEqual(without.company);
	});
	it('is absent without the key', async () => {
		const log: string[] = [];
		const view = await run('symbol=AAPL', { insight: insightFetchers(log) });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.insight).toBeNull();
		expect(log).toEqual([]);
	});
	it('is absent for a private company', async () => {
		const co = encodeCompany({
			name: 'ACCENSS BV',
			currency: 'EUR',
			origin: 'manual',
			netDebt: 0,
			years: [{ fiscalYear: '2025', kind: 'actual', values: { revenue: 10 } }]
		});
		const log: string[] = [];
		const view = await run(`co=${co}`, { eulerpoolKey: 'EKEY', insight: insightFetchers(log) });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.insight).toBeNull();
		expect(log).toEqual([]);
	});
	it('keeps the valuation when Eulerpool fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const failing = {
			fairValue: async () => {
				throw new SourceError('unavailable', 'x');
			},
			quality: async () => {
				throw new SourceError('unavailable', 'x');
			}
		};
		const view = await run('symbol=AAPL', { eulerpoolKey: 'EKEY', insight: failing });
		if (view.state !== 'ready') throw new Error(view.state);
		expect(view.company?.name).toBe('Apple');
		expect(view.insight).toEqual({
			fairValue: null,
			quality: null,
			message: 'Eulerpool is unavailable right now for AAPL. Try again shortly.'
		});
	});
});

describe('loadSector', () => {
	it('reads one region and industry from the Damodaran comparison', async () => {
		expect(await loadSector(['ev_ebitda', 'ps'], 'europe', 'Semiconductor')).toEqual({ ev_ebitda: 14, ps: null });
		expect(getComparison).toHaveBeenCalledWith({
			multiples: ['ev_ebitda', 'ps'],
			regions: ['europe'],
			industries: ['Semiconductor']
		});
	});
});
