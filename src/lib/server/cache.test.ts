import { describe, expect, it, vi } from 'vitest';
import { cached, createCache } from './cache';

describe('createCache', () => {
	it('reuses a value until it expires', async () => {
		let t = 0;
		const cache = createCache<string>({ ttlMs: 1000, now: () => t });
		const load = vi.fn().mockResolvedValue('a');

		await cache.get('k', load);
		t = 999;
		await cache.get('k', load);
		expect(load).toHaveBeenCalledTimes(1);

		t = 1001;
		await cache.get('k', load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('keeps keys separate', async () => {
		const cache = createCache<string>({ ttlMs: 1000 });
		expect(await cache.get('a', async () => 'one')).toBe('one');
		expect(await cache.get('b', async () => 'two')).toBe('two');
	});

	it('shares one load between concurrent callers', async () => {
		const cache = createCache<string>({ ttlMs: 1000 });
		let resolve!: (value: string) => void;
		const load = vi.fn(() => new Promise<string>((r) => (resolve = r)));

		const first = cache.get('k', load);
		const second = cache.get('k', load);
		resolve('x');

		expect(await Promise.all([first, second])).toEqual(['x', 'x']);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('serves the stale value when a refresh fails', async () => {
		let t = 0;
		const cache = createCache<string>({ ttlMs: 1000, now: () => t });
		await cache.get('k', async () => 'old');

		t = 2000;
		await expect(
			cache.get('k', async () => {
				throw new Error('down');
			})
		).resolves.toBe('old');
	});

	it('backs off for RETRY_MS after a failed refresh', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		let t = 0;
		const cache = createCache<string>({ ttlMs: 1000, now: () => t });
		await cache.get('k', async () => 'old');

		t = 2000;
		const failing = vi.fn().mockRejectedValue(new Error('down'));
		await expect(cache.get('k', failing)).resolves.toBe('old');
		expect(failing).toHaveBeenCalledTimes(1);

		t = 2000 + 10 * 60 * 1000 - 1;
		await expect(cache.get('k', failing)).resolves.toBe('old');
		expect(failing).toHaveBeenCalledTimes(1);

		t = 2000 + 10 * 60 * 1000 + 1;
		await expect(cache.get('k', failing)).resolves.toBe('old');
		expect(failing).toHaveBeenCalledTimes(2);
	});

	it('rejects when there is nothing to fall back on, then retries after the failure expires', async () => {
		let t = 0;
		const cache = createCache<string>({ ttlMs: 1000, now: () => t });
		const failing = vi.fn().mockRejectedValue(new Error('down'));
		await expect(cache.get('k', failing)).rejects.toThrow('down');

		// within the failure window the load is not attempted again
		t = 59_999;
		await expect(cache.get('k', failing)).rejects.toThrow('down');
		expect(failing).toHaveBeenCalledTimes(1);

		t = 60_001;
		await expect(cache.get('k', async () => 'ok')).resolves.toBe('ok');
	});
});

describe('cached', () => {
	it('loads once per key and passes every argument through', async () => {
		const load = vi.fn(async (symbol: string, apiKey: string) => `${symbol}:${apiKey}`);
		const get = cached(1000, (symbol: string, _apiKey: string) => symbol, load);
		expect(await get('AAPL', 'K')).toBe('AAPL:K');
		expect(await get('AAPL', 'OTHER')).toBe('AAPL:K');
		expect(await get('MSFT', 'K')).toBe('MSFT:K');
		expect(load).toHaveBeenCalledTimes(2);
	});
	it('keeps a separate cache for each wrapped function', async () => {
		const a = cached(
			1000,
			(key: string) => key,
			async (key: string) => `a:${key}`
		);
		const b = cached(
			1000,
			(key: string) => key,
			async (key: string) => `b:${key}`
		);
		expect(await a('x')).toBe('a:x');
		expect(await b('x')).toBe('b:x');
	});
	it('expires entries by the real clock', async () => {
		vi.useFakeTimers();
		try {
			const load = vi.fn(async () => 'v');
			const get = cached(1000, () => 'k', load);
			await get();
			vi.setSystemTime(Date.now() + 1001);
			await get();
			expect(load).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
