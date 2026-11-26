// The signed cookies of the Google sign-in (ADR-014), the permitted list and the log hash. Web Crypto only, so the
// same code runs on Node, Cloudflare Workers and a VPS. Pure apart from the crypto.
import { returnPath } from '#lib/return-path';

export const SESSION_COOKIE = 'fin_session';
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
/** Holds the state, nonce and PKCE verifier between `/login/google` and its callback. */
export const OAUTH_COOKIE = 'fin_oauth';
export const OAUTH_PATH = '/login/google';
export const OAUTH_MS = 10 * 60 * 1000;

const encoder = new TextEncoder();

/** Constant-time comparison of two strings; false when their lengths differ. */
export function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

const hex = (bytes: ArrayBuffer): string =>
	Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

/** HMAC-SHA256 of `<label>:<data>`, as hex. The label keeps one kind of signed value from passing for another. */
async function hmac(secret: string, label: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign'
	]);
	return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${label}:${data}`)));
}

/** base64url of UTF-8 text, without padding. */
export function toBase64Url(text: string): string {
	const binary = Array.from(encoder.encode(text), (b) => String.fromCharCode(b)).join('');
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** The text in a base64url value, or null when it is not one. */
export function fromBase64Url(value: string): string | null {
	if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
	try {
		const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
		return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
	} catch {
		return null;
	}
}

/** `<data>.<signature>`. */
export async function sign(secret: string, label: string, data: string): Promise<string> {
	return `${data}.${await hmac(secret, label, data)}`;
}

/** The data of a value `sign` made with the same secret and label, or null. */
export async function unsign(value: string | undefined, secret: string, label: string): Promise<string | null> {
	if (!value || !secret) return null;
	const dot = value.lastIndexOf('.');
	if (dot < 1) return null;
	const data = value.slice(0, dot);
	return safeEqual(value.slice(dot + 1), await hmac(secret, label, data)) ? data : null;
}

const ADDRESS = /^[^@\s,]+@[^@\s,]+$/;

/** The permitted addresses: exact, trimmed, lower-cased. Unset or empty lets nobody in. */
export function parseAllowed(raw: string | undefined): ReadonlySet<string> {
	return new Set(
		(raw ?? '')
			.split(',')
			.map((entry) => entry.trim().toLowerCase())
			.filter((entry) => ADDRESS.test(entry))
	);
}

export const isAllowed = (email: string, allowed: ReadonlySet<string>): boolean => allowed.has(email.toLowerCase());

/** Cookie value `<expiresMs>.<email, base64url>.<signature>`; the expiry and the address are both signed. */
export function createSession(secret: string, email: string, now = Date.now()): Promise<string> {
	return sign(secret, 'session', `${now + SESSION_MS}.${toBase64Url(email.toLowerCase())}`);
}

/** The session's address, or null when it is malformed, forged, expired or no longer on the list. */
export async function verifySession(
	value: string | undefined,
	secret: string,
	allowed: ReadonlySet<string>,
	now = Date.now()
): Promise<string | null> {
	const data = await unsign(value, secret, 'session');
	const [expires, encoded, ...rest] = data?.split('.') ?? [];
	if (expires === undefined || encoded === undefined || rest.length > 0 || !/^\d+$/.test(expires)) return null;
	const email = fromBase64Url(encoded);
	if (!email || Number(expires) <= now || !isAllowed(email, allowed)) return null;
	return email;
}

/** For the log: 8 hex characters of a keyed hash of the address, never the address itself. */
export async function userHash(email: string, secret: string): Promise<string> {
	return (await hmac(secret, 'log', email.toLowerCase())).slice(0, 8);
}

/** What `/login/google` hands to its callback. */
export interface Pending {
	readonly state: string;
	readonly nonce: string;
	readonly verifier: string;
	/** An allow-listed path to return to (`returnPath`), or null. */
	readonly from: string | null;
}

export function createOAuthCookie(secret: string, pending: Pending, now = Date.now()): Promise<string> {
	return sign(secret, 'oauth', toBase64Url(JSON.stringify({ ...pending, expires: now + OAUTH_MS })));
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** The pending sign-in, or null when the cookie is missing, forged, expired or malformed. */
export async function readOAuthCookie(
	value: string | undefined,
	secret: string,
	now = Date.now()
): Promise<Pending | null> {
	const data = await unsign(value, secret, 'oauth');
	const text = data === null ? null : fromBase64Url(data);
	if (text === null) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const { state, nonce, verifier, from, expires } = parsed as Record<string, unknown>;
	if (!isText(state) || !isText(nonce) || !isText(verifier) || typeof expires !== 'number' || expires <= now)
		return null;
	return { state, nonce, verifier, from: typeof from === 'string' ? returnPath(from) : null };
}

/** The sign-in settings, all present and non-empty. */
export interface SignInConfig {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly sessionSecret: string;
	readonly allowed: ReadonlySet<string>;
}

/** The settings when sign-in can work here, else null (every preview): the pages then say so. */
export function signInConfig(env: {
	readonly clientId?: string | undefined;
	readonly clientSecret?: string | undefined;
	readonly sessionSecret?: string | undefined;
	readonly allowed?: string | undefined;
}): SignInConfig | null {
	const allowed = parseAllowed(env.allowed);
	if (!env.clientId || !env.clientSecret || !env.sessionSecret || allowed.size === 0) return null;
	return { clientId: env.clientId, clientSecret: env.clientSecret, sessionSecret: env.sessionSecret, allowed };
}
