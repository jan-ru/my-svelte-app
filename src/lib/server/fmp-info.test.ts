// src/lib/server/fmp-info.test.ts
import { describe, expect, it, vi } from 'vitest';
import { FmpError } from './fmp';
import { fetchNews, fetchProfile, parseNews, parseProfile } from './fmp-info';

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
		expect(() => parseProfile({ 'Error Message': 'Invalid API KEY.' })).toThrowError(FmpError);
		expect(() => parseProfile({ nope: 1 })).toThrowError(/Unexpected response/);
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
		expect(parseNews([{ ...item, publisher: undefined }])[0].publisher).toBe('reuters.com');
	});
	it('drops items without a title and unsafe urls, and truncates long text', () => {
		const items = parseNews([
			{ ...item, title: '' },
			{ ...item, url: 'javascript:alert(1)' },
			{ ...item, text: 'x'.repeat(500) }
		]);
		expect(items).toHaveLength(2);
		expect(items[0].url).toBeNull();
		expect(items[1].text!.length).toBeLessThanOrEqual(301);
		expect(items[1].text!.endsWith('…')).toBe(true);
	});
	it('returns [] for an empty list and throws unavailable for a non-array', () => {
		expect(parseNews([])).toEqual([]);
		expect(() => parseNews({ nope: 1 })).toThrowError(/Unexpected response/);
	});
});

describe('fetchProfile / fetchNews', () => {
	it('request the right endpoints and parameters', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		await fetchProfile('AAPL', 'KEY', fetchFn);
		await fetchNews('AAPL', 'KEY', fetchFn);
		const [a, b] = fetchFn.mock.calls.map((c) => new URL(c[0] as string));
		expect(a.pathname).toBe('/stable/profile');
		expect(a.searchParams.get('symbol')).toBe('AAPL');
		expect(a.searchParams.get('apikey')).toBe('KEY');
		expect(b.pathname).toBe('/stable/news/stock');
		expect(b.searchParams.get('symbols')).toBe('AAPL');
		expect(b.searchParams.get('limit')).toBe('20');
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
				expect(error).toBeInstanceOf(FmpError);
				expect((error as Error).message).not.toContain(secret);
			}
		}
	});
	it('maps HTTP statuses', async () => {
		const kind = async (status: number) =>
			(await fetchProfile('AAPL', 'K', vi.fn().mockResolvedValue(json({}, status))).catch((e) => e)).kind;
		expect(await kind(402)).toBe('plan');
		expect(await kind(429)).toBe('limit');
		expect(await kind(500)).toBe('unavailable');
	});
});
