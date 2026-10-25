export interface RateLimiter {
	isLimited(key: string): boolean;
	recordFailure(key: string): void;
	reset(key: string): void;
}

/** Counts failures per key inside a sliding window. In memory, so per serverless instance (best effort). */
export function createRateLimiter(options: { max: number; windowMs: number; now?: () => number }): RateLimiter {
	const now = options.now ?? Date.now;
	const failures = new Map<string, number[]>();

	const recent = (key: string): number[] => {
		const cutoff = now() - options.windowMs;
		const list = (failures.get(key) ?? []).filter((t) => t > cutoff);
		if (list.length > 0) failures.set(key, list);
		else failures.delete(key);
		return list;
	};

	return {
		isLimited: (key) => recent(key).length >= options.max,
		recordFailure(key) {
			const list = recent(key);
			list.push(now());
			failures.set(key, list);
		},
		reset(key) {
			failures.delete(key);
		}
	};
}

/**
 * Decide one login attempt. Synchronous on purpose: the limit check and the failure record
 * happen with no await in between, so parallel requests cannot all pass the check first.
 * A limited key never reaches the password comparison.
 */
export function checkLogin(
	limiter: RateLimiter,
	key: string,
	submitted: string,
	matches: (submitted: string) => boolean
): 'limited' | 'wrong' | 'ok' {
	if (limiter.isLimited(key)) return 'limited';
	if (!matches(submitted)) {
		limiter.recordFailure(key);
		return 'wrong';
	}
	limiter.reset(key);
	return 'ok';
}
