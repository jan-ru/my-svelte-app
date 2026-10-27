// src/lib/server/financials-info-cache.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fmp-info', async (importActual) => ({
	...(await importActual<typeof import('./fmp-info')>()),
	fetchProfile: vi.fn(async () => ({ name: 'X' })),
	fetchNews: vi.fn(async () => []),
	fetchPrices: vi.fn(async () => [])
}));

import * as info from './fmp-info';
import { NEWS_TTL_MS, PRICES_TTL_MS, PROFILE_TTL_MS, cachedNews, cachedPrices, cachedProfile } from './financials';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
	vi.mocked(info.fetchProfile).mockClear();
	vi.mocked(info.fetchNews).mockClear();
	vi.mocked(info.fetchPrices).mockClear();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('info caches', () => {
	it('uses 24 h for the profile and 15 min for news', () => {
		expect(PROFILE_TTL_MS).toBe(24 * 60 * 60 * 1000);
		expect(NEWS_TTL_MS).toBe(15 * 60 * 1000);
	});
	it('serves repeat calls from cache and refreshes news after its lifetime but not the profile', async () => {
		await cachedProfile('CACHEA', 'K');
		await cachedNews('CACHEA', 'K');
		await cachedProfile('CACHEA', 'K');
		await cachedNews('CACHEA', 'K');
		expect(info.fetchProfile).toHaveBeenCalledTimes(1);
		expect(info.fetchNews).toHaveBeenCalledTimes(1);
		vi.setSystemTime(Date.now() + NEWS_TTL_MS + 1000);
		await cachedProfile('CACHEA', 'K');
		await cachedNews('CACHEA', 'K');
		expect(info.fetchProfile).toHaveBeenCalledTimes(1);
		expect(info.fetchNews).toHaveBeenCalledTimes(2);
		vi.setSystemTime(Date.now() + PROFILE_TTL_MS);
		await cachedProfile('CACHEA', 'K');
		expect(info.fetchProfile).toHaveBeenCalledTimes(2);
	});
	it('keeps separate entries per symbol', async () => {
		await cachedNews('CACHEB', 'K');
		await cachedNews('CACHEC', 'K');
		expect(info.fetchNews).toHaveBeenCalledTimes(2);
	});
	it('caches prices for 1 h per symbol', async () => {
		expect(PRICES_TTL_MS).toBe(60 * 60 * 1000);
		await cachedPrices('PRICEA', 'K');
		await cachedPrices('PRICEA', 'K');
		await cachedPrices('PRICEB', 'K');
		expect(info.fetchPrices).toHaveBeenCalledTimes(2);
		vi.setSystemTime(Date.now() + PRICES_TTL_MS - 1000);
		await cachedPrices('PRICEA', 'K');
		expect(info.fetchPrices).toHaveBeenCalledTimes(2);
		vi.setSystemTime(Date.now() + 2000);
		await cachedPrices('PRICEA', 'K');
		expect(info.fetchPrices).toHaveBeenCalledTimes(3);
	});
	it('asks for a one-year window ending today', async () => {
		await cachedPrices('PRICEC', 'K');
		expect(info.fetchPrices).toHaveBeenLastCalledWith('PRICEC', 'K', '2025-10-26', '2026-10-26');
	});
});
