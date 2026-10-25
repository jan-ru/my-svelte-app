import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './ratelimit';

describe('createRateLimiter', () => {
	it('limits a key after max failures inside the window', () => {
		let t = 0;
		const limiter = createRateLimiter({ max: 3, windowMs: 1000, now: () => t });
		for (let i = 0; i < 2; i++) limiter.recordFailure('ip');
		expect(limiter.isLimited('ip')).toBe(false);
		limiter.recordFailure('ip');
		expect(limiter.isLimited('ip')).toBe(true);
	});
	it('frees the key once the failures age out', () => {
		let t = 0;
		const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
		limiter.recordFailure('ip');
		limiter.recordFailure('ip');
		expect(limiter.isLimited('ip')).toBe(true);
		t = 1001;
		expect(limiter.isLimited('ip')).toBe(false);
	});
	it('keeps keys separate and resets on request', () => {
		const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
		limiter.recordFailure('a');
		expect(limiter.isLimited('a')).toBe(true);
		expect(limiter.isLimited('b')).toBe(false);
		limiter.reset('a');
		expect(limiter.isLimited('a')).toBe(false);
	});
});
