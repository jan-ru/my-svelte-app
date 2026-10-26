// src/lib/server/financials-cache.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Statement } from './fmp';

vi.mock('./fmp', async (importActual) => ({
	...(await importActual<typeof import('./fmp')>()),
	fetchStatement: vi.fn()
}));

import { fetchStatement } from './fmp';
import { cachedFetcher } from './financials';

const statement: Statement = {
	lines: ['revenue'],
	years: [{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { revenue: 1 } }]
};

describe('cachedFetcher', () => {
	beforeEach(() => {
		vi.mocked(fetchStatement).mockReset().mockResolvedValue(statement);
	});

	it('keeps annual and TTM results in separate cache entries', async () => {
		await cachedFetcher('income', 'TESTSYM', 'K', 'annual');
		await cachedFetcher('income', 'TESTSYM', 'K', 'ttm');
		expect(fetchStatement).toHaveBeenCalledTimes(2);
		expect(vi.mocked(fetchStatement).mock.calls.map((c) => c[3])).toEqual(['annual', 'ttm']);
	});

	it('serves a repeat call for the same period from the cache', async () => {
		await cachedFetcher('income', 'TESTSYM2', 'K', 'ttm');
		await cachedFetcher('income', 'TESTSYM2', 'K', 'ttm');
		expect(fetchStatement).toHaveBeenCalledTimes(1);
	});
});
