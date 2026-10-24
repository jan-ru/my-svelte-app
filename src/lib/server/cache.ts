const RETRY_MS = 10 * 60 * 1000;

export interface Cache<T> {
	get(key: string, load: () => Promise<T>): Promise<T>;
}

export function createCache<T>(options: { ttlMs: number; now?: () => number }): Cache<T> {
	const now = options.now ?? Date.now;
	const store = new Map<string, { value: T; expires: number }>();
	const inflight = new Map<string, Promise<T>>();

	return {
		async get(key, load) {
			const hit = store.get(key);
			if (hit && hit.expires > now()) return hit.value;

			const pending = inflight.get(key);
			if (pending) return pending;

			const promise = load()
				.then((value) => {
					store.set(key, { value, expires: now() + options.ttlMs });
					return value;
				})
				.catch((error: unknown) => {
					if (hit) {
						// Serve the stale copy and back off so later requests don't each re-pay the timeout.
						console.warn(`cache refresh failed for "${key}", serving stale value`, error);
						store.set(key, { value: hit.value, expires: now() + RETRY_MS });
						return hit.value;
					}
					throw error;
				})
				.finally(() => inflight.delete(key));

			inflight.set(key, promise);
			return promise;
		}
	};
}
