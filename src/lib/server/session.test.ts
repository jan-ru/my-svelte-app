// The signed cookies of the Google sign-in (ADR-014), the permitted list and the log hash.
import { describe, expect, it } from 'vitest';
import {
	SESSION_MS,
	OAUTH_MS,
	createOAuthCookie,
	createSession,
	fromBase64Url,
	isAllowed,
	parseAllowed,
	readOAuthCookie,
	safeEqual,
	sign,
	signInConfig,
	toBase64Url,
	unsign,
	userHash,
	verifySession
} from './session';

const SECRET = 'a-long-random-secret-0123456789abcdef';
const T0 = 1_000_000;
const ALLOWED = parseAllowed('person@example.test');

describe('safeEqual', () => {
	it('is true only for equal strings', () => {
		expect(safeEqual('abc', 'abc')).toBe(true);
		expect(safeEqual('abc', 'abd')).toBe(false);
		expect(safeEqual('abc', 'ab')).toBe(false);
		expect(safeEqual('', '')).toBe(true);
	});
});

describe('base64url', () => {
	it('round-trips UTF-8 text without padding or + and /', () => {
		for (const text of ['person@example.test', 'é@ü.test', '??>>', '']) {
			const encoded = toBase64Url(text);
			expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
			expect(fromBase64Url(encoded)).toBe(text);
		}
	});
	it('refuses what is not base64url', () => {
		expect(fromBase64Url('a+b')).toBeNull();
		expect(fromBase64Url('a=')).toBeNull();
		expect(fromBase64Url('/w')).toBeNull();
	});
});

describe('sign and unsign', () => {
	it('returns the data only for the same secret and label', async () => {
		const value = await sign(SECRET, 'x', 'data.with.dots');
		expect(await unsign(value, SECRET, 'x')).toBe('data.with.dots');
		expect(await unsign(value, 'other-secret', 'x')).toBeNull();
		expect(await unsign(value, SECRET, 'y')).toBeNull();
		expect(await unsign(`${value}0`, SECRET, 'x')).toBeNull();
	});
	it('fails closed without a value or a secret', async () => {
		expect(await unsign(undefined, SECRET, 'x')).toBeNull();
		expect(await unsign('', SECRET, 'x')).toBeNull();
		expect(await unsign(await sign(SECRET, 'x', 'd'), '', 'x')).toBeNull();
		expect(await unsign('nodot', SECRET, 'x')).toBeNull();
	});
});

describe('parseAllowed', () => {
	it('keeps exact addresses, lower-cased and trimmed', () => {
		expect([...parseAllowed(' A.Person@Example.test , b@x.test,,')]).toEqual(['a.person@example.test', 'b@x.test']);
	});
	it('drops entries that are not one address', () => {
		expect([...parseAllowed('@example.test,example.test,a@b@c,person@,ok@x.test')]).toEqual(['ok@x.test']);
	});
	it('is empty when unset or empty', () => {
		expect(parseAllowed(undefined).size).toBe(0);
		expect(parseAllowed('').size).toBe(0);
	});
	it('isAllowed compares lower-cased', () => {
		expect(isAllowed('Person@Example.TEST', ALLOWED)).toBe(true);
		expect(isAllowed('other@example.test', ALLOWED)).toBe(false);
	});
});

describe('sessions', () => {
	it('returns the address of a fresh session on the list', async () => {
		const value = await createSession(SECRET, 'person@example.test', T0);
		expect(await verifySession(value, SECRET, ALLOWED, T0 + 1000)).toBe('person@example.test');
	});
	it('expires after SESSION_MS', async () => {
		const value = await createSession(SECRET, 'person@example.test', T0);
		expect(await verifySession(value, SECRET, ALLOWED, T0 + SESSION_MS - 1)).toBe('person@example.test');
		expect(await verifySession(value, SECRET, ALLOWED, T0 + SESSION_MS + 1)).toBeNull();
	});
	it('ends when the address is taken off the list', async () => {
		const value = await createSession(SECRET, 'person@example.test', T0);
		expect(await verifySession(value, SECRET, parseAllowed('other@example.test'), T0)).toBeNull();
		expect(await verifySession(value, SECRET, parseAllowed(''), T0)).toBeNull();
	});
	it('rejects another secret, a changed address and a changed expiry', async () => {
		const value = await createSession(SECRET, 'person@example.test', T0);
		const [expires = '', email = '', signature = ''] = value.split('.');
		expect(await verifySession(value, 'other-secret', ALLOWED, T0)).toBeNull();
		const other = toBase64Url('other@example.test');
		expect(
			await verifySession(`${expires}.${other}.${signature}`, SECRET, parseAllowed('other@example.test'), T0)
		).toBeNull();
		expect(await verifySession(`${Number(expires) + 1}.${email}.${signature}`, SECRET, ALLOWED, T0)).toBeNull();
	});
	it('rejects the old two-part format and malformed values', async () => {
		for (const bad of [undefined, '', 'x', '123.abc', 'a.b.c', '..', `${T0 + 1}..sig`]) {
			expect(await verifySession(bad, SECRET, ALLOWED, T0), String(bad)).toBeNull();
		}
	});
	it('fails closed without a secret', async () => {
		const value = await createSession(SECRET, 'person@example.test', T0);
		expect(await verifySession(value, '', ALLOWED, T0)).toBeNull();
	});
});

describe('the OAuth cookie', () => {
	const pending = { state: 's', nonce: 'n', verifier: 'v', from: '/financials?symbol=AAPL' };
	it('round-trips within OAUTH_MS', async () => {
		const value = await createOAuthCookie(SECRET, pending, T0);
		expect(await readOAuthCookie(value, SECRET, T0 + OAUTH_MS - 1)).toEqual(pending);
		expect(await readOAuthCookie(value, SECRET, T0 + OAUTH_MS + 1)).toBeNull();
	});
	it('cannot pass for a session, nor a session for it', async () => {
		const oauthValue = await createOAuthCookie(SECRET, pending, T0);
		expect(await verifySession(oauthValue, SECRET, ALLOWED, T0)).toBeNull();
		const session = await createSession(SECRET, 'person@example.test', T0);
		expect(await readOAuthCookie(session, SECRET, T0)).toBeNull();
	});
	it('re-checks from against the allow-list', async () => {
		const value = await createOAuthCookie(SECRET, { ...pending, from: 'https://evil.test/' }, T0);
		expect((await readOAuthCookie(value, SECRET, T0))?.from).toBeNull();
	});
	it('rejects a tampered or foreign value', async () => {
		expect(await readOAuthCookie('x.y', SECRET, T0)).toBeNull();
		expect(await readOAuthCookie(await sign(SECRET, 'oauth', 'not json'), SECRET, T0)).toBeNull();
		expect(await readOAuthCookie(await sign(SECRET, 'oauth', toBase64Url('{"state":1}')), SECRET, T0)).toBeNull();
	});
});

describe('userHash', () => {
	it('is 8 hex characters, stable, case-insensitive, and keyed', async () => {
		const a = await userHash('Person@Example.test', SECRET);
		expect(a).toMatch(/^[0-9a-f]{8}$/);
		expect(await userHash('person@example.test', SECRET)).toBe(a);
		expect(await userHash('person@example.test', 'other-secret')).not.toBe(a);
	});
});

describe('signInConfig', () => {
	const full = { clientId: 'id', clientSecret: 'cs', sessionSecret: SECRET, allowed: 'person@example.test' };
	it('is the config when everything is set', () => {
		const config = signInConfig(full);
		expect(config?.clientId).toBe('id');
		expect(config?.allowed.has('person@example.test')).toBe(true);
	});
	it.each(['clientId', 'clientSecret', 'sessionSecret', 'allowed'] as const)('is null without %s', (key) => {
		expect(signInConfig({ ...full, [key]: undefined })).toBeNull();
		expect(signInConfig({ ...full, [key]: '' })).toBeNull();
	});
	it('is null when the list holds no valid address', () => {
		expect(signInConfig({ ...full, allowed: 'not-an-address' })).toBeNull();
	});
});
