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
					if (hit) return hit.value; // serve the stale copy rather than fail
					throw error;
				})
				.finally(() => inflight.delete(key));

			inflight.set(key, promise);
			return promise;
		}
	};
}
