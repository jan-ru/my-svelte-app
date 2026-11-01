// src/lib/server/fmp.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
	MAX_BYTES,
	fetchEarnings,
	fetchEstimates,
	fetchRatios,
	fetchStatement,
	parseStatement,
	readCapped
} from './fmp';
import { SourceError } from './source-error';

const record = (year: number, extra: Record<string, unknown> = {}) => ({
	date: `${year}-12-31`,
	symbol: 'AAPL',
	reportedCurrency: 'USD',
	fiscalYear: String(year),
	period: 'FY',
	revenue: 1000 + year,
	costOfRevenue: 400,
	netIncome: null,
	eps: 1.25,
	...extra
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers });

describe('parseStatement', () => {
	it('keeps numeric fields as lines in first-seen order and drops metadata', () => {
		const s = parseStatement([record(2024), record(2023)]);
		expect(s.lines).toEqual(['revenue', 'costOfRevenue', 'netIncome', 'eps']);
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2024', '2023']);
		expect(s.years[0]).toMatchObject({ date: '2024-12-31', currency: 'USD' });
		expect(s.years[0]?.values.revenue).toBe(3024);
	});
	it('orders years newest first and keeps at most five', () => {
		const s = parseStatement([2019, 2024, 2020, 2023, 2021, 2022].map((y) => record(y)));
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2024', '2023', '2022', '2021', '2020']);
	});
	it('maps non-numeric values to null', () => {
		const s = parseStatement([record(2024, { revenue: 'n/a' })]);
		expect(s.years[0]?.values.revenue).toBeNull();
		expect(s.years[0]?.values.netIncome).toBeNull();
	});
	it('returns no years for an empty list', () => {
		expect(parseStatement([])).toEqual({ lines: [], years: [] });
	});
	it('maps FMP error bodies to SourceError kinds', () => {
		const kind = (message: string) => {
			try {
				parseStatement({ 'Error Message': message });
			} catch (error) {
				return (error as SourceError).kind;
			}
		};
		expect(kind('Invalid API KEY.')).toBe('config');
		expect(kind('Limit Reach. Please upgrade')).toBe('limit');
		expect(kind('Premium Query Parameter: limit is not available')).toBe('plan');
		expect(kind('Special Endpoint : This endpoint is not available under your current subscription')).toBe('plan');
	});
	it('rejects an unexpected shape', () => {
		expect(() => parseStatement('nope')).toThrow(SourceError);
		expect(() => parseStatement({ foo: 1 })).toThrow(SourceError);
	});
});

describe('fetchStatement', () => {
	it('requests the stable endpoint with the ticker, period and limit', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([record(2024)]));
		await fetchStatement('balance', 'ABN.AS', 'KEY123', 'annual', fetchFn);
		const url = new URL(fetchFn.mock.calls[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe('https://financialmodelingprep.com/stable/balance-sheet-statement');
		expect(url.searchParams.get('symbol')).toBe('ABN.AS');
		expect(url.searchParams.get('period')).toBe('annual');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(url.searchParams.get('apikey')).toBe('KEY123');
	});
	it('uses the three statement endpoints', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		for (const kind of ['income', 'balance', 'cashflow'] as const)
			await fetchStatement(kind, 'AAPL', 'K', 'annual', fetchFn);
		const paths = fetchFn.mock.calls.map((c) => new URL(c[0] as string).pathname);
		expect(paths).toEqual([
			'/stable/income-statement',
			'/stable/balance-sheet-statement',
			'/stable/cash-flow-statement'
		]);
	});
	it('maps HTTP statuses to error kinds', async () => {
		const kindFor = async (status: number) => {
			const fetchFn = vi.fn().mockResolvedValue(json({}, status));
			try {
				await fetchStatement('income', 'AAPL', 'K', 'annual', fetchFn);
			} catch (error) {
				return (error as SourceError).kind;
			}
		};
		expect(await kindFor(401)).toBe('config');
		expect(await kindFor(402)).toBe('plan');
		expect(await kindFor(403)).toBe('plan');
		expect(await kindFor(429)).toBe('limit');
		expect(await kindFor(500)).toBe('unavailable');
	});
	it('never leaks the key in an error message', async () => {
		const secret = 'SUPERSECRETKEY';
		const cases: Array<() => Promise<Response>> = [
			async () => json({ 'Error Message': `bad request https://x/y?apikey=${secret}&symbol=A` }, 400),
			async () => json({ 'Error Message': `Limit Reach for ${secret}` }),
			async () => {
				throw new Error(`connect failed for https://financialmodelingprep.com/stable/x?apikey=${secret}`);
			},
			async () => new Response('not json at all', { status: 200 })
		];
		for (const make of cases) {
			const fetchFn = vi.fn().mockImplementation(make);
			const error = await fetchStatement('income', 'AAPL', secret, 'annual', fetchFn).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(SourceError);
			expect((error as Error).message).not.toContain(secret);
		}
	});
	it('never leaks the key in a TTM error message', async () => {
		const secret = 'SUPERSECRETKEY';
		const cases: Array<() => Promise<Response>> = [
			async () => json({ 'Error Message': `bad request https://x/y?apikey=${secret}&symbol=A` }, 400),
			async () => json({ 'Error Message': `Limit Reach for ${secret}` }),
			async () => {
				throw new Error(`connect failed for https://financialmodelingprep.com/stable/x-ttm?apikey=${secret}`);
			},
			async () => new Response('not json at all', { status: 200 })
		];
		for (const make of cases) {
			const fetchFn = vi.fn().mockImplementation(make);
			const error = await fetchStatement('income', 'AAPL', secret, 'ttm', fetchFn).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(SourceError);
			expect((error as Error).message).not.toContain(secret);
		}
	});
	it('keeps only the newest row of a TTM response', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([record(2023), record(2025), record(2024)]));
		const statement = await fetchStatement('income', 'AAPL', 'K', 'ttm', fetchFn);
		expect(statement.years).toHaveLength(1);
		expect(statement.years[0]?.date).toBe('2025-12-31');
	});
	it('redacts a bare key echoed in a plan error message', async () => {
		const secret = 'AbC123+/key';
		const message = `Key ${secret} (${encodeURIComponent(secret)}) is not entitled to this endpoint`;
		const fetchFn = vi.fn().mockResolvedValue(json({ 'Error Message': message }));
		const error = await fetchStatement('income', 'AAPL', secret, 'annual', fetchFn).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).kind).toBe('plan');
		expect((error as Error).message).not.toContain(secret);
		expect((error as Error).message).not.toContain(encodeURIComponent(secret));
		expect((error as Error).message).toContain('***');
	});
	it('maps a body that cannot be read to a clean unavailable error', async () => {
		const secret = 'SUPERSECRETKEY';
		const response = {
			ok: true,
			status: 200,
			headers: new Headers(),
			text: () => Promise.reject(new Error(`aborted https://financialmodelingprep.com/stable/x?apikey=${secret}`))
		} as unknown as Response;
		const error = await fetchStatement('income', 'AAPL', secret, 'annual', vi.fn().mockResolvedValue(response)).catch(
			(e: unknown) => e
		);
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).kind).toBe('unavailable');
		expect((error as Error).message).not.toContain(secret);
		expect((error as Error).message).not.toContain('financialmodelingprep');
	});
	it('rejects a response that is too large', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([], 200, { 'content-length': String(6 * 1024 * 1024) }));
		await expect(fetchStatement('income', 'AAPL', 'K', 'annual', fetchFn)).rejects.toMatchObject({
			kind: 'unavailable'
		});
	});
	it('rejects a body larger than the cap even without a content-length', async () => {
		const chunk = new Uint8Array(1024 * 1024).fill(0x20);
		let sent = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				sent += 1;
				controller.enqueue(chunk);
			}
		});
		const fetchFn = vi.fn().mockResolvedValue(new Response(body));
		await expect(fetchStatement('income', 'AAPL', 'K', 'annual', fetchFn)).rejects.toMatchObject({
			kind: 'unavailable',
			message: 'FMP response too large'
		});
		// stopped just past the cap instead of reading on
		expect(sent).toBeLessThanOrEqual(MAX_BYTES / chunk.byteLength + 2);
	});
	it('maps a body that breaks off mid-stream to a safe error', async () => {
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.error(new Error('reset https://financialmodelingprep.com/?apikey=K'));
			}
		});
		const fetchFn = vi.fn().mockResolvedValue(new Response(body));
		await expect(fetchStatement('income', 'AAPL', 'K', 'annual', fetchFn)).rejects.toMatchObject({
			kind: 'unavailable',
			message: 'FMP response could not be read'
		});
	});
	it('uses the -ttm endpoint with limit 1 and no period for TTM', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => new Response('[]'));
		for (const [kind, path] of [
			['income', 'income-statement-ttm'],
			['balance', 'balance-sheet-statement-ttm'],
			['cashflow', 'cash-flow-statement-ttm']
		] as const) {
			await fetchStatement(kind, 'AAPL', 'K', 'ttm', fetchFn);
			const url = String(fetchFn.mock.calls.at(-1)![0]);
			expect(url).toContain(`/stable/${path}?`);
			expect(url).toContain('symbol=AAPL');
			expect(url).toContain('limit=1');
			expect(url).not.toContain('period=');
		}
	});
	it('keeps the annual URL unchanged', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('[]'));
		await fetchStatement('income', 'AAPL', 'K', 'annual', fetchFn);
		const url = String(fetchFn.mock.calls[0]?.[0]);
		expect(url).toContain('/stable/income-statement?');
		expect(url).toContain('period=annual');
		expect(url).toContain('limit=5');
	});

	it('maps an Error Message body on a non-ok response, and reports a non-JSON ok body as unavailable', async () => {
		const plan = vi.fn().mockResolvedValue(json({ 'Error Message': 'Special Endpoint : not on your plan' }, 402));
		await expect(fetchStatement('income', 'AAPL', 'K', 'annual', plan)).rejects.toMatchObject({ kind: 'plan' });
		const html = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
		await expect(fetchStatement('income', 'AAPL', 'K', 'annual', html)).rejects.toMatchObject({ kind: 'unavailable' });
	});
});

describe('fetchRatios', () => {
	it('requests the annual ratios endpoint with the ticker and a five-year limit', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([record(2024, { priceToEarningsRatio: 28.5 })]));
		const result = await fetchRatios('AAPL', 'KEY123', fetchFn);
		const url = new URL(fetchFn.mock.calls[0]?.[0] as string);
		expect(url.origin + url.pathname).toBe('https://financialmodelingprep.com/stable/ratios');
		expect(url.searchParams.get('symbol')).toBe('AAPL');
		expect(url.searchParams.get('period')).toBe('annual');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(result.years[0]?.values.priceToEarningsRatio).toBe(28.5);
	});
	it('maps a plan error body to an SourceError without the key', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json({ 'Error Message': 'Premium Query Parameter apikey=KEY123' }, 402));
		const error = await fetchRatios('AAPL', 'KEY123', fetchFn).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(SourceError);
		expect((error as SourceError).kind).toBe('plan');
		expect((error as SourceError).message).not.toContain('KEY123');
	});
});

describe('fetchEstimates', () => {
	it('requests annual analyst estimates with a five-year limit', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(
				json([{ symbol: 'AAPL', date: '2027-09-30', revenueAvg: 5e11, epsAvg: 8.1, numAnalystsEps: 31 }])
			);
		const result = await fetchEstimates('AAPL', 'KEY123', fetchFn);
		const url = new URL(fetchFn.mock.calls[0]?.[0] as string);
		expect(url.pathname).toBe('/stable/analyst-estimates');
		expect(url.searchParams.get('period')).toBe('annual');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(result.lines).toEqual(['revenueAvg', 'epsAvg', 'numAnalystsEps']);
	});
});

describe('fetchEarnings', () => {
	it('labels each column by its report date, since several reports share a fiscal year', async () => {
		const fetchFn = vi.fn().mockResolvedValue(
			json([
				{
					symbol: 'AAPL',
					date: '2026-01-29',
					epsActual: null,
					epsEstimated: 2.4,
					revenueActual: null,
					revenueEstimated: 1e11,
					lastUpdated: '2025-12-01'
				},
				{
					symbol: 'AAPL',
					date: '2025-10-30',
					epsActual: 1.85,
					epsEstimated: 1.8,
					revenueActual: 1.02e11,
					revenueEstimated: 1e11,
					lastUpdated: '2025-10-31'
				}
			])
		);
		const result = await fetchEarnings('AAPL', 'KEY123', fetchFn);
		const url = new URL(fetchFn.mock.calls[0]?.[0] as string);
		expect(url.pathname).toBe('/stable/earnings');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(result.years.map((y) => y.fiscalYear)).toEqual(['2026-01-29', '2025-10-30']);
		expect(result.lines).toEqual(['epsActual', 'epsEstimated', 'revenueActual', 'revenueEstimated']);
		expect(result.years[0]?.values.epsActual).toBeNull();
	});
});

describe('readCapped', () => {
	it('decodes a multi-byte character split across chunks', async () => {
		const bytes = new TextEncoder().encode('€uro');
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.slice(0, 2));
				controller.enqueue(bytes.slice(2));
				controller.close();
			}
		});
		expect(await readCapped(new Response(body), 100)).toBe('€uro');
	});
	it('reads an empty body as empty text and counts bytes, not characters', async () => {
		expect(await readCapped(new Response(null), 10)).toBe('');
		expect(await readCapped(new Response('€€'), 5)).toBeNull();
		expect(await readCapped(new Response('€€'), 6)).toBe('€€');
	});
});
