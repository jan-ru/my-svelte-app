import { describe, expect, it, vi } from 'vitest';
import { createCache } from './cache';

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

	it('rejects when there is nothing to fall back on, and retries next time', async () => {
		const cache = createCache<string>({ ttlMs: 1000 });
		await expect(
			cache.get('k', async () => {
				throw new Error('down');
			})
		).rejects.toThrow('down');
		await expect(cache.get('k', async () => 'ok')).resolves.toBe('ok');
	});
});
