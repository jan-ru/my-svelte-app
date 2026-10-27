import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./yahoo', () => ({
	fetchYahooPrices: vi.fn(async () => []),
	fetchYahooProfile: vi.fn(async () => null),
	fetchYahooNews: vi.fn(async () => []),
	fetchYahooStatement: vi.fn(async () => ({ lines: [], years: [] }))
}));

import { NEWS_TTL_MS, PRICES_TTL_MS, PROFILE_TTL_MS, yahooFetchers } from './financials';
import * as yahoo from './yahoo';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
	for (const fn of Object.values(yahoo)) vi.mocked(fn as () => unknown).mockClear();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('Yahoo caches', () => {
	it('keeps prices for 1 h, news for 15 min and the profile for 24 h, per symbol', async () => {
		await yahooFetchers.prices('YA.AS', '');
		await yahooFetchers.prices('YA.AS', '');
		await yahooFetchers.prices('YB.AS', '');
		expect(yahoo.fetchYahooPrices).toHaveBeenCalledTimes(2);
		await yahooFetchers.news('YA.AS', '');
		await yahooFetchers.profile('YA.AS', '');
		vi.setSystemTime(Date.now() + NEWS_TTL_MS + 1000);
		await yahooFetchers.news('YA.AS', '');
		await yahooFetchers.profile('YA.AS', '');
		await yahooFetchers.prices('YA.AS', '');
		expect(yahoo.fetchYahooNews).toHaveBeenCalledTimes(2);
		expect(yahoo.fetchYahooProfile).toHaveBeenCalledTimes(1);
		expect(yahoo.fetchYahooPrices).toHaveBeenCalledTimes(2);
		vi.setSystemTime(Date.now() + PRICES_TTL_MS);
		await yahooFetchers.prices('YA.AS', '');
		expect(yahoo.fetchYahooPrices).toHaveBeenCalledTimes(3);
		vi.setSystemTime(Date.now() + PROFILE_TTL_MS);
		await yahooFetchers.profile('YA.AS', '');
		expect(yahoo.fetchYahooProfile).toHaveBeenCalledTimes(2);
	});
	it('keeps statements apart per kind and period', async () => {
		await yahooFetchers.statement('income', 'YC.AS', '', 'annual');
		await yahooFetchers.statement('income', 'YC.AS', '', 'annual');
		await yahooFetchers.statement('income', 'YC.AS', '', 'ttm');
		await yahooFetchers.statement('balance', 'YC.AS', '', 'annual');
		expect(yahoo.fetchYahooStatement).toHaveBeenCalledTimes(3);
	});
	it('asks for a one-year price window ending today', async () => {
		await yahooFetchers.prices('YD.AS', '');
		expect(yahoo.fetchYahooPrices).toHaveBeenLastCalledWith('YD.AS', '2025-10-27', '2026-10-27');
	});
});
