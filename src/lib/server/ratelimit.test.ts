import { describe, expect, it, vi } from 'vitest';
import { checkLogin, createRateLimiter } from './ratelimit';

describe('createRateLimiter', () => {
	it('limits a key after max failures inside the window', () => {
		const t = 0;
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

describe('createRateLimiter key limit', () => {
	it('forgets keys without recent failures first, then the oldest, past maxKeys', () => {
		let t = 0;
		const limiter = createRateLimiter({ max: 2, windowMs: 1000, now: () => t, maxKeys: 2 });
		limiter.recordFailure('old');
		t = 900;
		limiter.recordFailure('kept');
		limiter.recordFailure('kept');
		t = 1500; // old's failure is out of the window, kept's are not
		limiter.recordFailure('new');
		expect(limiter.isLimited('kept')).toBe(true);
		// both remaining keys are recent, so the oldest (kept) goes
		limiter.recordFailure('newer');
		expect(limiter.isLimited('kept')).toBe(false);
		limiter.recordFailure('newer');
		expect(limiter.isLimited('newer')).toBe(true);
	});
});

describe('checkLogin', () => {
	const limiter = () => createRateLimiter({ max: 2, windowMs: 1000, now: () => 0 });

	it('never compares the password for a limited ip', () => {
		const l = limiter();
		l.recordFailure('ip');
		l.recordFailure('ip');
		const matches = vi.fn(() => true);
		expect(checkLogin(l, 'ip', 'right', matches)).toBe('limited');
		expect(matches).not.toHaveBeenCalled();
	});
	it('records a failure on a wrong password until the ip is limited', () => {
		const l = limiter();
		const matches = () => false;
		expect(checkLogin(l, 'ip', 'x', matches)).toBe('wrong');
		expect(checkLogin(l, 'ip', 'x', matches)).toBe('wrong');
		expect(l.isLimited('ip')).toBe(true);
		expect(checkLogin(l, 'ip', 'x', matches)).toBe('limited');
	});
	it('resets the failures on success', () => {
		const l = limiter();
		l.recordFailure('ip');
		expect(checkLogin(l, 'ip', 'right', () => true)).toBe('ok');
		l.recordFailure('ip');
		expect(l.isLimited('ip')).toBe(false);
	});
});
