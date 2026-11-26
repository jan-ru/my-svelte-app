// The exchange with Google, against a fake token endpoint: no network.
import { describe, expect, it, vi } from 'vitest';
import { CALLBACK_PATH, authorizationUrl, finishSignIn, newPending } from './google';

const CLIENT = { id: 'client-id.apps.googleusercontent.com', secret: 'client-secret' };
const ORIGIN = 'https://app.example.test';

const b64url = (value: unknown) =>
	btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/** An ID token as Google's token endpoint returns it. The signature is not checked: it comes straight over TLS. */
function idToken(claims: Record<string, unknown>): string {
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		iss: 'https://accounts.google.com',
		aud: CLIENT.id,
		sub: '1',
		iat: now,
		exp: now + 3600,
		...claims
	};
	return `${b64url({ alg: 'RS256', typ: 'JWT', kid: 'k' })}.${b64url(payload)}.c2ln`;
}

const tokenEndpoint = (body: Record<string, unknown>, status = 200) =>
	vi.fn<typeof fetch>(async () =>
		Response.json({ access_token: 'at', token_type: 'Bearer', expires_in: 3600, ...body }, { status })
	);

const callback = (params: Record<string, string>) =>
	new URL(`${ORIGIN}${CALLBACK_PATH}?${new URLSearchParams(params)}`);

describe('authorizationUrl', () => {
	it('asks Google for a code with PKCE, state, nonce and only openid email', async () => {
		const pending = newPending('/financials');
		const url = await authorizationUrl(CLIENT, ORIGIN, pending);
		expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(url.searchParams.get('client_id')).toBe(CLIENT.id);
		expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}${CALLBACK_PATH}`);
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('scope')).toBe('openid email');
		expect(url.searchParams.get('state')).toBe(pending.state);
		expect(url.searchParams.get('nonce')).toBe(pending.nonce);
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(url.searchParams.has('client_secret')).toBe(false);
	});
	it('makes a new state, nonce and verifier each time', () => {
		const a = newPending(null);
		const b = newPending(null);
		expect(a.state).not.toBe(b.state);
		expect(a.nonce).not.toBe(b.nonce);
		expect(a.verifier).not.toBe(b.verifier);
	});
});

describe('finishSignIn', () => {
	const pending = newPending(null);
	it('returns the verified address, lower-cased', async () => {
		const fetchFn = tokenEndpoint({
			id_token: idToken({ nonce: pending.nonce, email: 'Person@Example.test', email_verified: true })
		});
		const result = await finishSignIn(CLIENT, callback({ code: 'c', state: pending.state }), pending, fetchFn);
		expect(result).toEqual({ ok: true, email: 'person@example.test' });
		const [url, init] = fetchFn.mock.calls[0] ?? [];
		expect(url instanceof URL ? url.href : url).toBe('https://oauth2.googleapis.com/token');
		const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams();
		expect(body.get('code_verifier')).toBe(pending.verifier);
		expect(body.get('redirect_uri')).toBe(`${ORIGIN}${CALLBACK_PATH}`);
	});
	it('refuses a wrong state without calling Google', async () => {
		const fetchFn = tokenEndpoint({});
		expect(await finishSignIn(CLIENT, callback({ code: 'c', state: 'other' }), pending, fetchFn)).toEqual({
			ok: false,
			reason: 'state'
		});
		expect(fetchFn).not.toHaveBeenCalled();
	});
	it('reports an error Google sent back, such as a cancelled sign-in', async () => {
		const result = await finishSignIn(
			CLIENT,
			callback({ error: 'access_denied', state: pending.state }),
			pending,
			tokenEndpoint({})
		);
		expect(result).toEqual({ ok: false, reason: 'google' });
	});
	it('refuses a wrong nonce, and a failed exchange', async () => {
		const wrongNonce = tokenEndpoint({
			id_token: idToken({ nonce: 'x', email: 'p@example.test', email_verified: true })
		});
		expect(await finishSignIn(CLIENT, callback({ code: 'c', state: pending.state }), pending, wrongNonce)).toEqual({
			ok: false,
			reason: 'exchange'
		});
		const failed = tokenEndpoint({ error: 'invalid_grant' }, 400);
		expect(await finishSignIn(CLIENT, callback({ code: 'c', state: pending.state }), pending, failed)).toEqual({
			ok: false,
			reason: 'exchange'
		});
		const down = vi.fn<typeof fetch>(async () => {
			throw new TypeError('fetch failed');
		});
		expect(await finishSignIn(CLIENT, callback({ code: 'c', state: pending.state }), pending, down)).toEqual({
			ok: false,
			reason: 'exchange'
		});
	});
	it('refuses an address Google has not verified, or none', async () => {
		for (const claims of [{ email: 'p@example.test', email_verified: false }, { email: 'p@example.test' }, {}]) {
			const fetchFn = tokenEndpoint({ id_token: idToken({ nonce: pending.nonce, ...claims }) });
			expect(await finishSignIn(CLIENT, callback({ code: 'c', state: pending.state }), pending, fetchFn)).toEqual({
				ok: false,
				reason: 'unverified'
			});
		}
	});
});
