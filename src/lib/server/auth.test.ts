import { describe, expect, it } from 'vitest';
import { SESSION_MS, createSession, passwordMatches, verifySession } from './auth';

describe('passwordMatches', () => {
	it('accepts only the exact password', () => {
		expect(passwordMatches('s3cret', 's3cret')).toBe(true);
		expect(passwordMatches('s3cret ', 's3cret')).toBe(false);
		expect(passwordMatches('', 's3cret')).toBe(false);
		expect(passwordMatches('S3CRET', 's3cret')).toBe(false);
	});
	it('fails closed when no password is configured', () => {
		expect(passwordMatches('', '')).toBe(false);
		expect(passwordMatches('anything', '')).toBe(false);
	});
});

describe('sessions', () => {
	const secret = 'a-long-random-secret';
	const t0 = 1_000_000;

	it('accepts a fresh session', () => {
		expect(verifySession(createSession(secret, t0), secret, t0 + 1000)).toBe(true);
	});
	it('expires after SESSION_MS', () => {
		const value = createSession(secret, t0);
		expect(verifySession(value, secret, t0 + SESSION_MS - 1)).toBe(true);
		expect(verifySession(value, secret, t0 + SESSION_MS + 1)).toBe(false);
	});
	it('rejects a different secret', () => {
		expect(verifySession(createSession(secret, t0), 'other-secret', t0)).toBe(false);
	});
	it('rejects a tampered expiry or signature', () => {
		const [expires, signature] = createSession(secret, t0).split('.');
		expect(verifySession(`${Number(expires) + 99999999}.${signature}`, secret, t0)).toBe(false);
		expect(verifySession(`${expires}.${'0'.repeat(signature.length)}`, secret, t0)).toBe(false);
	});
	it('rejects malformed values', () => {
		for (const bad of [undefined, '', 'x', '123', '123.', '.abc', 'a.b.c', 'abc.def']) {
			expect(verifySession(bad, secret, t0), String(bad)).toBe(false);
		}
	});
	it('fails closed without a secret', () => {
		expect(verifySession(createSession('', t0), '', t0)).toBe(false);
	});
});
