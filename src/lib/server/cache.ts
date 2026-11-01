const RETRY_MS = 10 * 60 * 1000;
/** How long a failed first load is remembered, so an outage doesn't make every request pay the timeout. */
const FAILURE_MS = 60 * 1000;

export interface Cache<T> {
	get(key: string, load: () => Promise<T>): Promise<T>;
}

/** Entries kept per cache before the oldest are dropped; a warm instance otherwise grows with every ticker asked. */
export const MAX_ENTRIES = 500;

/**
 * Make room for one more entry: drop the expired ones, then the oldest (a Map keeps insertion order, and a refresh
 * re-inserts, so the first key is the least recently loaded).
 */
function makeRoom<V>(map: Map<string, V>, max: number, expired: (value: V) => boolean): void {
	if (map.size < max) return;
	for (const [key, value] of map) if (expired(value)) map.delete(key);
	for (const key of map.keys()) {
		if (map.size < max) return;
		map.delete(key);
	}
}

export function createCache<T>(options: { ttlMs: number; now?: () => number; maxEntries?: number }): Cache<T> {
	const now = options.now ?? Date.now;
	const max = options.maxEntries ?? MAX_ENTRIES;
	const store = new Map<string, { value: T; expires: number }>();
	const inflight = new Map<string, Promise<T>>();
	const failures = new Map<string, { error: unknown; until: number }>();
	const put = (key: string, value: T, ttl: number) => {
		store.delete(key);
		makeRoom(store, max, (entry) => entry.expires <= now());
		store.set(key, { value, expires: now() + ttl });
	};

	return {
		async get(key, load) {
			const hit = store.get(key);
			if (hit && hit.expires > now()) return hit.value;

			const failure = failures.get(key);
			if (!hit && failure && failure.until > now()) throw failure.error;

			const pending = inflight.get(key);
			if (pending) return pending;

			const promise = load()
				.then((value) => {
					put(key, value, options.ttlMs);
					failures.delete(key);
					return value;
				})
				.catch((error: unknown) => {
					if (hit) {
						// Serve the stale copy and back off so later requests don't each re-pay the timeout.
						console.warn(`cache refresh failed for "${key}", serving stale value`, error);
						put(key, hit.value, RETRY_MS);
						return hit.value;
					}
					makeRoom(failures, max, (failure) => failure.until <= now());
					failures.set(key, { error, until: now() + FAILURE_MS });
					throw error;
				})
				.finally(() => inflight.delete(key));

			inflight.set(key, promise);
			return promise;
		}
	};
}

/** Wrap an async function in a cache of its own, keyed by `keyOf(...args)`. The clock is read per call so fake timers work. */
export function cached<A extends unknown[], T>(
	ttlMs: number,
	keyOf: (...args: A) => string,
	fn: (...args: A) => Promise<T>
): (...args: A) => Promise<T> {
	const cache = createCache<T>({ ttlMs, now: () => Date.now() });
	return (...args) => cache.get(keyOf(...args), () => fn(...args));
}
