// src/lib/server/fmp-info.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
	fetchNews,
	fetchPeers,
	fetchPriceTarget,
	fetchPrices,
	fetchProfile,
	parseNews,
	parsePeers,
	parsePriceTarget,
	parsePrices,
	parseProfile
} from './fmp-info';
import { SourceError } from './source-error';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const raw = {
	symbol: 'AAPL',
	companyName: ' Apple Inc. ',
	exchangeFullName: 'NASDAQ Global Select',
	sector: 'Technology',
	industry: 'Consumer Electronics',
	country: 'US',
	ceo: 'Tim Cook',
	fullTimeEmployees: '164000',
	website: 'https://www.apple.com',
	ipoDate: '1980-12-12',
	currency: 'USD',
	price: 189.5,
	marketCap: 2_900_000_000_000,
	beta: 1.24,
	description: 'Apple designs phones.',
	image: 'https://images.example/aapl.png'
};

describe('parseProfile', () => {
	it('reads the first record, trims strings and converts numeric strings', () => {
		expect(parseProfile([raw])).toEqual({
			name: 'Apple Inc.',
			exchange: 'NASDAQ Global Select',
			sector: 'Technology',
			industry: 'Consumer Electronics',
			country: 'US',
			ceo: 'Tim Cook',
			website: 'https://www.apple.com/',
			ipoDate: '1980-12-12',
			currency: 'USD',
			description: 'Apple designs phones.',
			employees: 164000,
			price: 189.5,
			marketCap: 2_900_000_000_000,
			beta: 1.24
		});
	});
	it('returns null for an empty array or a non-object record', () => {
		expect(parseProfile([])).toBeNull();
		expect(parseProfile([null])).toBeNull();
	});
	it('returns null when no field has a usable value, but keeps a record with one', () => {
		expect(parseProfile([{ symbol: 'X' }])).toBeNull();
		expect(parseProfile([{ companyName: 'Y' }])?.name).toBe('Y');
	});
	it('drops missing, empty and wrongly typed fields', () => {
		const p = parseProfile([{ companyName: 'X', sector: '  ', ceo: 5, price: 'abc', marketCap: null }])!;
		expect(p.name).toBe('X');
		expect(p.sector).toBeNull();
		expect(p.ceo).toBeNull();
		expect(p.price).toBeNull();
		expect(p.marketCap).toBeNull();
	});
	it('drops an unsafe website', () => {
		expect(parseProfile([{ companyName: 'X', website: 'javascript:alert(1)' }])!.website).toBeNull();
	});
	it('maps an FMP error body and rejects other shapes', () => {
		expect(() => parseProfile({ 'Error Message': 'Invalid API KEY.' })).toThrow(SourceError);
		expect(() => parseProfile({ nope: 1 })).toThrow(/Unexpected response/);
	});
});

describe('parseNews', () => {
	const item = {
		symbol: 'AAPL',
		publishedDate: '2026-10-25 14:30:00',
		publisher: 'Reuters',
		title: 'Apple ships thing',
		image: 'https://images.example/x.png',
		site: 'reuters.com',
		text: 'Short text.',
		url: 'https://reuters.com/a'
	};
	it('maps items', () => {
		expect(parseNews([item])).toEqual([
			{
				title: 'Apple ships thing',
				publisher: 'Reuters',
				date: '2026-10-25 14:30:00',
				text: 'Short text.',
				url: 'https://reuters.com/a'
			}
		]);
	});
	it('falls back to site when there is no publisher', () => {
		expect(parseNews([{ ...item, publisher: undefined }])[0]?.publisher).toBe('reuters.com');
	});
	it('drops items without a title and unsafe urls, and truncates long text', () => {
		const items = parseNews([
			{ ...item, title: '' },
			{ ...item, url: 'javascript:alert(1)' },
			{ ...item, text: 'x'.repeat(500) }
		]);
		expect(items).toHaveLength(2);
		expect(items[0]?.url).toBeNull();
		expect(items[1]?.text?.length).toBeLessThanOrEqual(301);
		expect(items[1]?.text?.endsWith('…')).toBe(true);
	});
	it('returns [] for an empty list and throws unavailable for a non-array', () => {
		expect(parseNews([])).toEqual([]);
		expect(() => parseNews({ nope: 1 })).toThrow(/Unexpected response/);
	});
});

describe('fetchProfile / fetchNews', () => {
	it('request the right endpoints and parameters', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		await fetchProfile('AAPL', 'KEY', fetchFn);
		await fetchNews('AAPL', 'KEY', fetchFn);
		const [a, b] = fetchFn.mock.calls.map((c) => new URL(c[0] as string));
		expect(a?.pathname).toBe('/stable/profile');
		expect(a?.searchParams.get('symbol')).toBe('AAPL');
		expect(a?.searchParams.get('apikey')).toBe('KEY');
		expect(b?.pathname).toBe('/stable/news/stock');
		expect(b?.searchParams.get('symbols')).toBe('AAPL');
		expect(b?.searchParams.get('limit')).toBe('20');
	});
	it('never leak the key in an error message', async () => {
		const secret = 'SUPERSECRETKEY';
		const cases: Array<() => Promise<Response>> = [
			async () => json({ 'Error Message': `bad request https://x/y?apikey=${secret}` }, 400),
			async () => {
				throw new Error(`connect failed https://financialmodelingprep.com/stable/x?apikey=${secret}`);
			},
			async () => new Response('not json', { status: 200 })
		];
		for (const make of cases) {
			for (const run of [
				(f: typeof fetch) => fetchProfile('AAPL', secret, f),
				(f: typeof fetch) => fetchNews('AAPL', secret, f)
			]) {
				const error = await run(vi.fn().mockImplementation(make)).catch((e: unknown) => e);
				expect(error).toBeInstanceOf(SourceError);
				expect((error as Error).message).not.toContain(secret);
			}
		}
	});
	it('maps HTTP statuses', async () => {
		const kind = (status: number) =>
			fetchProfile('AAPL', 'K', vi.fn().mockResolvedValue(json({}, status))).then(
				() => null,
				(e: unknown) => (e instanceof SourceError ? e.kind : null)
			);
		expect(await kind(402)).toBe('plan');
		expect(await kind(429)).toBe('limit');
		expect(await kind(500)).toBe('unavailable');
	});
});

describe('parsePrices', () => {
	const row = { symbol: 'AAPL', date: '2026-10-23', open: 1, high: 2, low: 0.5, close: 189.5, volume: 1_234_567 };
	it('maps records and sorts oldest first', () => {
		const points = parsePrices([
			{ ...row, date: '2026-10-23', close: 190 },
			{ ...row, date: '2026-10-21', close: 188 },
			{ ...row, date: '2026-10-22', close: '189.25', volume: null }
		]);
		expect(points).toEqual([
			{ date: '2026-10-21', close: 188, volume: 1_234_567 },
			{ date: '2026-10-22', close: 189.25, volume: null },
			{ date: '2026-10-23', close: 190, volume: 1_234_567 }
		]);
	});
	it('drops records without an ISO date or a numeric close', () => {
		const points = parsePrices([
			row,
			{ ...row, date: '23/10/2026' },
			{ ...row, date: undefined },
			{ ...row, date: '2026-10-22', close: 'abc' },
			{ ...row, date: '2026-10-21', close: null },
			null,
			'x'
		]);
		expect(points.map((p) => p.date)).toEqual(['2026-10-23']);
	});
	it('keeps one point per date, the later record wins, and stays sorted oldest first', () => {
		const points = parsePrices([
			{ ...row, date: '2026-10-23', close: 190, volume: 100 },
			{ ...row, date: '2026-10-22', close: 189, volume: 200 },
			{ ...row, date: '2026-10-23', close: 191, volume: 300 },
			{ ...row, date: '2026-10-21', close: 188, volume: 400 },
			{ ...row, date: '2026-10-22', close: 189.5, volume: null }
		]);
		expect(points).toEqual([
			{ date: '2026-10-21', close: 188, volume: 400 },
			{ date: '2026-10-22', close: 189.5, volume: null },
			{ date: '2026-10-23', close: 191, volume: 300 }
		]);
	});
	it('treats a non-numeric volume as null', () => {
		expect(parsePrices([{ ...row, volume: 'many' }])[0]?.volume).toBeNull();
	});
	it('returns [] for an empty list, maps an FMP error body and rejects other shapes', () => {
		expect(parsePrices([])).toEqual([]);
		expect(() => parsePrices({ 'Error Message': 'Invalid API KEY.' })).toThrow(SourceError);
		expect(() => parsePrices({ nope: 1 })).toThrow(/Unexpected response/);
	});
});

describe('fetchPrices', () => {
	it('requests the history endpoint with symbol and date range', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		await fetchPrices('AAPL', 'KEY', '2025-10-26', '2026-10-26', fetchFn);
		const url = new URL(fetchFn.mock.calls[0]?.[0] as string);
		expect(url.pathname).toBe('/stable/historical-price-eod/full');
		expect(url.searchParams.get('symbol')).toBe('AAPL');
		expect(url.searchParams.get('from')).toBe('2025-10-26');
		expect(url.searchParams.get('to')).toBe('2026-10-26');
		expect(url.searchParams.get('apikey')).toBe('KEY');
	});
	it('never leaks the key in an error message', async () => {
		const secret = 'SUPERSECRETKEY';
		const cases: Array<() => Promise<Response>> = [
			async () => json({ 'Error Message': `bad request https://x/y?apikey=${secret}` }, 400),
			async () => {
				throw new Error(`connect failed https://financialmodelingprep.com/stable/x?apikey=${secret}`);
			},
			async () => new Response('not json', { status: 200 })
		];
		for (const make of cases) {
			const error = await fetchPrices(
				'AAPL',
				secret,
				'2025-10-26',
				'2026-10-26',
				vi.fn().mockImplementation(make)
			).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(SourceError);
			expect((error as Error).message).not.toContain(secret);
		}
	});
});

describe('parsePriceTarget', () => {
	it('reads the four targets', () => {
		expect(
			parsePriceTarget([
				{ symbol: 'AAPL', targetHigh: 250, targetLow: 150, targetConsensus: 205.5, targetMedian: '210' }
			])
		).toEqual({
			consensus: 205.5,
			median: 210,
			high: 250,
			low: 150
		});
	});
	it('returns null for an empty list or a record with no targets', () => {
		expect(parsePriceTarget([])).toBeNull();
		expect(parsePriceTarget([{ symbol: 'AAPL' }])).toBeNull();
	});
	it('maps error bodies and unexpected shapes', () => {
		expect(() => parsePriceTarget({ 'Error Message': 'Limit Reach' })).toThrow(SourceError);
		expect(() => parsePriceTarget('nope')).toThrow(SourceError);
	});
});

describe('parsePeers', () => {
	it('keeps symbol, name, price and market cap, and skips entries without a symbol', () => {
		expect(
			parsePeers([
				{ symbol: 'MSFT', companyName: 'Microsoft', price: 400, mktCap: 3e12 },
				{ companyName: 'No symbol' },
				null
			])
		).toEqual([{ symbol: 'MSFT', name: 'Microsoft', price: 400, marketCap: 3e12 }]);
	});
	it('keeps at most 20', () => {
		const many = Array.from({ length: 30 }, (_, i) => ({ symbol: `T${i}` }));
		expect(parsePeers(many)).toHaveLength(20);
	});
	it('maps error bodies and unexpected shapes', () => {
		expect(() => parsePeers({ 'Error Message': 'Invalid API KEY.' })).toThrow(SourceError);
		expect(() => parsePeers(undefined)).toThrow(SourceError);
	});
});

describe('fetchPriceTarget and fetchPeers', () => {
	it('call their stable endpoints with the ticker', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		await fetchPriceTarget('AAPL', 'K', fetchFn);
		await fetchPeers('AAPL', 'K', fetchFn);
		const urls = fetchFn.mock.calls.map((c) => new URL(c[0] as string));
		expect(urls.map((u) => u.pathname)).toEqual(['/stable/price-target-consensus', '/stable/stock-peers']);
		for (const u of urls) expect(u.searchParams.get('symbol')).toBe('AAPL');
	});
});
