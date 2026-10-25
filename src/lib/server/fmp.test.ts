// src/lib/server/fmp.test.ts
import { describe, expect, it, vi } from 'vitest';
import { FmpError, fetchStatement, parseStatement } from './fmp';

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
		expect(s.years[0].values.revenue).toBe(3024);
	});
	it('orders years newest first and keeps at most five', () => {
		const s = parseStatement([2019, 2024, 2020, 2023, 2021, 2022].map((y) => record(y)));
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2024', '2023', '2022', '2021', '2020']);
	});
	it('maps non-numeric values to null', () => {
		const s = parseStatement([record(2024, { revenue: 'n/a' })]);
		expect(s.years[0].values.revenue).toBeNull();
		expect(s.years[0].values.netIncome).toBeNull();
	});
	it('returns no years for an empty list', () => {
		expect(parseStatement([])).toEqual({ lines: [], years: [] });
	});
	it('maps FMP error bodies to FmpError kinds', () => {
		const kind = (message: string) => {
			try {
				parseStatement({ 'Error Message': message });
			} catch (error) {
				return (error as FmpError).kind;
			}
		};
		expect(kind('Invalid API KEY.')).toBe('config');
		expect(kind('Limit Reach. Please upgrade')).toBe('limit');
		expect(kind('Special Endpoint : This endpoint is not available under your current subscription')).toBe('plan');
	});
	it('rejects an unexpected shape', () => {
		expect(() => parseStatement('nope')).toThrow(FmpError);
		expect(() => parseStatement({ foo: 1 })).toThrow(FmpError);
	});
});

describe('fetchStatement', () => {
	it('requests the stable endpoint with the ticker, period and limit', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([record(2024)]));
		await fetchStatement('balance', 'ABN.AS', 'KEY123', fetchFn);
		const url = new URL(fetchFn.mock.calls[0][0] as string);
		expect(url.origin + url.pathname).toBe('https://financialmodelingprep.com/stable/balance-sheet-statement');
		expect(url.searchParams.get('symbol')).toBe('ABN.AS');
		expect(url.searchParams.get('period')).toBe('annual');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(url.searchParams.get('apikey')).toBe('KEY123');
	});
	it('uses the three statement endpoints', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		for (const kind of ['income', 'balance', 'cashflow'] as const) await fetchStatement(kind, 'AAPL', 'K', fetchFn);
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
				await fetchStatement('income', 'AAPL', 'K', fetchFn);
			} catch (error) {
				return (error as FmpError).kind;
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
			const error = await fetchStatement('income', 'AAPL', secret, fetchFn).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(FmpError);
			expect((error as Error).message).not.toContain(secret);
		}
	});
	it('rejects a response that is too large', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([], 200, { 'content-length': String(6 * 1024 * 1024) }));
		await expect(fetchStatement('income', 'AAPL', 'K', fetchFn)).rejects.toMatchObject({ kind: 'unavailable' });
	});
});
