import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'fin_session';
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const sign = (secret: string, payload: string): string =>
	createHmac('sha256', secret).update(payload).digest('hex');

const safeEqual = (a: Buffer, b: Buffer): boolean => a.length === b.length && timingSafeEqual(a, b);

/** Constant-time comparison; false when no password is configured. */
export function passwordMatches(input: string, expected: string): boolean {
	if (!expected) return false;
	const digest = (value: string) => createHash('sha256').update(value).digest();
	return timingSafeEqual(digest(input), digest(expected));
}

/** Cookie value "<expiresMs>.<signature>"; the expiry is inside the signed part. */
export function createSession(secret: string, now = Date.now()): string {
	const expires = String(now + SESSION_MS);
	return `${expires}.${sign(secret, expires)}`;
}

export function verifySession(value: string | undefined, secret: string, now = Date.now()): boolean {
	if (!value || !secret) return false;
	const parts = value.split('.');
	if (parts.length !== 2) return false;
	const [expires, signature] = parts;
	if (!/^\d+$/.test(expires) || !signature) return false;
	if (!safeEqual(Buffer.from(signature), Buffer.from(sign(secret, expires)))) return false;
	return Number(expires) > now;
}
