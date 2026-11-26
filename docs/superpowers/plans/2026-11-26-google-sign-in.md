# Google sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared password with Google sign-in, limited to the exact addresses in `ALLOWED_EMAILS`, in code that runs unchanged on Vercel, Cloudflare Workers and a Node server.

**Architecture:** A new pure module `session.ts` (Web Crypto only) signs the session cookie, which now carries the address, and the short-lived OAuth cookie; it also parses the permitted list and makes the log hash. A new `google.ts` wraps `oauth4webapi` for the authorization URL and the code exchange. Two server routes, `/login/google` and `/login/google/callback`, run the sign-in, and `hooks.server.ts` checks the session and the list on every request. ADR-003's split between public and logged-in views is untouched.

**Tech Stack:** SvelteKit 3, TypeScript (strict), Vitest, Playwright, `oauth4webapi` 3.8.9 (pinned exactly), Web Crypto (`crypto.subtle`).

**Spec:** `docs/superpowers/specs/2026-11-26-google-sign-in-design.md`

## Global Constraints

- TypeScript only; `npm run check`, `npm run lint` (`strictTypeChecked`, `max-statements` 40), `npm run format:check` and `npm run test:coverage` must pass before each commit. Use Node 24: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- After `npm run build`, run `npx svelte-kit sync` before vitest.
- `$app/env/private` is read only in `src/hooks.server.ts`, `src/routes/login/` (including `login/google/`) and `src/routes/financials/`.
- No `node:crypto` in `session.ts`, `google.ts`, `access.ts`, `hooks.server.ts` or the login routes: Web Crypto and global `crypto.randomUUID()` only.
- No e-mail address, Google token or Google error text in any log line, response or page. Log lines are exactly `login allowed user=<8 hex>`, `login refused user=<8 hex>` and `login failed reason=<word>`.
- The permitted list holds exact addresses only, compared lower-cased. An unset or empty `ALLOWED_EMAILS` lets nobody in.
- Session: cookie `fin_session`, seven days, `sessionCookieOptions()` unchanged. OAuth cookie: `fin_oauth`, path `/login/google`, `httpOnly`, `sameSite=lax`, ten minutes, single-use.
- Scopes `openid email` only. The callback path is `/login/google/callback` on the request's own origin.
- Page texts, word for word: "Sign in with Google"; "Logging in is only available on the production site."; "This Google account has no access."; "Signing in did not work. Try again."
- `oauth4webapi` pinned exactly at `3.8.9` (no `^`).
- Never commit real secrets or addresses; test values only (`e2e@example.test`, `person@example.test`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `feat/google-sign-in`; do not merge.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/server/session.ts` (new) | Web Crypto signing, the session cookie, the OAuth cookie, the permitted list, the log hash, `signInConfig`. Pure apart from crypto. |
| `src/lib/server/session.test.ts` (new) | Its unit tests. |
| `src/lib/server/google.ts` (new) | `oauth4webapi` calls: new state/nonce/verifier, the authorization URL, `finishSignIn`. Injectable `fetch`. |
| `src/lib/server/google.test.ts` (new) | Its tests, against a fake token endpoint. |
| `src/routes/login/google/+server.ts` (new) | Starts the sign-in. |
| `src/routes/login/google/callback/+server.ts` (new) | Finishes it: list check, cookies, logs, redirect. |
| `src/routes/login/google/server.test.ts` (new) | Tests of both routes. |
| `src/routes/login/+page.server.ts`, `+page.svelte` | The page: the button or the note, the two errors, logout. Password action removed. |
| `src/lib/components/LoginForm.svelte` | The sign-in link instead of the password form. |
| `src/hooks.server.ts` | The async session check with the list; `crypto.randomUUID()`. |
| `src/lib/server/access.ts` | `safeEqual` from `session.ts` instead of `node:crypto`; `SESSION_MS` from `session.ts`. |
| `src/routes/financials/+page.server.ts`, `valuation/+page.server.ts` | `configured` from `signInConfig`. |
| `src/env.ts`, `.env.example`, `playwright.config.ts` | The variables. |
| `src/lib/server/auth.ts`, `auth.test.ts`, `ratelimit.ts`, `ratelimit.test.ts` | Deleted. |
| `e2e/smoke.spec.ts` | Logs in by setting a signed session cookie; tests the sign-in start. |
| Docs | ADR-014, ADR-003 clarification, `docs/adr/README.md`, `src/lib/overview/adr.ts`, `AGENTS.md`, `docs/configuration.md`, `docs/financials.md`, `CHANGELOG.md`. |

---

### Task 1: `session.ts`, the signed values, the session, the list and the log hash

**Files:**
- Create: `src/lib/server/session.ts`
- Test: `src/lib/server/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (exact):
  - `SESSION_COOKIE = 'fin_session'`, `SESSION_MS = 604_800_000`, `OAUTH_COOKIE = 'fin_oauth'`, `OAUTH_PATH = '/login/google'`, `OAUTH_MS = 600_000`
  - `safeEqual(a: string, b: string): boolean`
  - `toBase64Url(text: string): string`, `fromBase64Url(value: string): string | null`
  - `sign(secret: string, label: string, data: string): Promise<string>`, `unsign(value: string | undefined, secret: string, label: string): Promise<string | null>`
  - `parseAllowed(raw: string | undefined): ReadonlySet<string>`, `isAllowed(email: string, allowed: ReadonlySet<string>): boolean`
  - `createSession(secret: string, email: string, now?: number): Promise<string>`, `verifySession(value: string | undefined, secret: string, allowed: ReadonlySet<string>, now?: number): Promise<string | null>`
  - `userHash(email: string, secret: string): Promise<string>`
  - `interface Pending { readonly state: string; readonly nonce: string; readonly verifier: string; readonly from: string | null }`
  - `createOAuthCookie(secret: string, pending: Pending, now?: number): Promise<string>`, `readOAuthCookie(value: string | undefined, secret: string, now?: number): Promise<Pending | null>`
  - `interface SignInConfig { readonly clientId: string; readonly clientSecret: string; readonly sessionSecret: string; readonly allowed: ReadonlySet<string> }`
  - `signInConfig(env: { readonly clientId?: string; readonly clientSecret?: string; readonly sessionSecret?: string; readonly allowed?: string }): SignInConfig | null`

- [ ] **Step 1: Create the branch**

```bash
cd /Users/jrm/Projects/my-svelte-app && git checkout main && git pull && git checkout -b feat/google-sign-in
```

- [ ] **Step 2: Write the failing tests**

`src/lib/server/session.test.ts`:

```ts
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
		expect(await verifySession(`${expires}.${other}.${signature}`, SECRET, parseAllowed('other@example.test'), T0)).toBeNull();
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
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/lib/server/session.test.ts`
Expected: FAIL, "Failed to resolve import ./session".

- [ ] **Step 4: Write `session.ts`**

```ts
// src/lib/server/session.ts
// The signed cookies of the Google sign-in (ADR-014), the permitted list and the log hash. Web Crypto only, so the
// same code runs on Node, Cloudflare Workers and a VPS. Pure apart from the crypto.
import { returnPath } from '../return-path';

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
export async function readOAuthCookie(value: string | undefined, secret: string, now = Date.now()): Promise<Pending | null> {
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
	if (!isText(state) || !isText(nonce) || !isText(verifier) || typeof expires !== 'number' || expires <= now) return null;
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
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/server/session.test.ts`
Expected: PASS. If `atob` rejects an unpadded value on this Node version, pad it in `fromBase64Url` with `'='.repeat((4 - (s.length % 4)) % 4)` and rerun.

- [ ] **Step 6: Check, lint, format, commit**

```bash
npx prettier --write src/lib/server/session.ts src/lib/server/session.test.ts
npm run check && npm run lint
git add src/lib/server/session.ts src/lib/server/session.test.ts
git commit -m "feat: signed session with the address, the permitted list and the log hash, on Web Crypto (ADR-014)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `google.ts`, the exchange with Google through `oauth4webapi`

**Files:**
- Modify: `package.json`, `package-lock.json` (dependency)
- Create: `src/lib/server/google.ts`
- Test: `src/lib/server/google.test.ts`

**Interfaces:**
- Consumes: `Pending` from `./session` (Task 1).
- Produces (exact):
  - `CALLBACK_PATH = '/login/google/callback'`
  - `interface GoogleClient { readonly id: string; readonly secret: string }`
  - `newPending(from: string | null): Pending`
  - `authorizationUrl(client: GoogleClient, origin: string, pending: Pending): Promise<URL>`
  - `type SignInResult = { readonly ok: true; readonly email: string } | { readonly ok: false; readonly reason: 'state' | 'google' | 'exchange' | 'unverified' }`
  - `finishSignIn(client: GoogleClient, callbackUrl: URL, pending: Pending, fetchFn?: typeof fetch): Promise<SignInResult>`

- [ ] **Step 1: Add the dependency, pinned**

```bash
npm install --save-exact oauth4webapi@3.8.9
grep '"oauth4webapi"' package.json   # expected: "oauth4webapi": "3.8.9"
```

- [ ] **Step 2: Write the failing tests**

`src/lib/server/google.test.ts`:

```ts
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
	const payload = { iss: 'https://accounts.google.com', aud: CLIENT.id, sub: '1', iat: now, exp: now + 3600, ...claims };
	return `${b64url({ alg: 'RS256', typ: 'JWT', kid: 'k' })}.${b64url(payload)}.c2ln`;
}

const tokenEndpoint = (body: Record<string, unknown>, status = 200) =>
	vi.fn<typeof fetch>(async () =>
		Response.json({ access_token: 'at', token_type: 'Bearer', expires_in: 3600, ...body }, { status })
	);

const callback = (params: Record<string, string>) => new URL(`${ORIGIN}${CALLBACK_PATH}?${new URLSearchParams(params)}`);

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
		expect(String(url)).toBe('https://oauth2.googleapis.com/token');
		const body = new URLSearchParams(String(init?.body));
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
		const result = await finishSignIn(CLIENT, callback({ error: 'access_denied', state: pending.state }), pending, tokenEndpoint({}));
		expect(result).toEqual({ ok: false, reason: 'google' });
	});
	it('refuses a wrong nonce, and a failed exchange', async () => {
		const wrongNonce = tokenEndpoint({ id_token: idToken({ nonce: 'x', email: 'p@example.test', email_verified: true }) });
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
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/lib/server/google.test.ts`
Expected: FAIL, "Failed to resolve import ./google".

- [ ] **Step 4: Write `google.ts`**

Before writing, read `node_modules/oauth4webapi/build/index.d.ts` for the exact names below (v3): `generateRandomState`, `generateRandomNonce`, `generateRandomCodeVerifier`, `calculatePKCECodeChallenge`, `validateAuthResponse`, `AuthorizationResponseError`, `authorizationCodeGrantRequest`, `ClientSecretPost`, `customFetch`, `processAuthorizationCodeResponse`, `getValidatedIdTokenClaims`.

```ts
// src/lib/server/google.ts
// Sign in with Google (OpenID Connect, authorization code with PKCE), through oauth4webapi: Web standards only, so
// it runs on Node, Cloudflare Workers and a VPS alike (ADR-014). No Google token or error text leaves this module.
import * as oauth from 'oauth4webapi';
import type { Pending } from './session';

export const CALLBACK_PATH = '/login/google/callback';
const TIMEOUT_MS = 10_000;

/** Google's endpoints, fixed, so no discovery request is needed. */
const GOOGLE: oauth.AuthorizationServer = {
	issuer: 'https://accounts.google.com',
	authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
	token_endpoint: 'https://oauth2.googleapis.com/token',
	jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
	id_token_signing_alg_values_supported: ['RS256']
};

export interface GoogleClient {
	readonly id: string;
	readonly secret: string;
}

const redirectUri = (origin: string): string => `${origin}${CALLBACK_PATH}`;

/** A new state, nonce and PKCE verifier for one sign-in. */
export function newPending(from: string | null): Pending {
	return {
		state: oauth.generateRandomState(),
		nonce: oauth.generateRandomNonce(),
		verifier: oauth.generateRandomCodeVerifier(),
		from
	};
}

/** Where to send the browser: Google's sign-in, asking only for the address. */
export async function authorizationUrl(client: GoogleClient, origin: string, pending: Pending): Promise<URL> {
	const url = new URL(GOOGLE.authorization_endpoint ?? '');
	url.searchParams.set('client_id', client.id);
	url.searchParams.set('redirect_uri', redirectUri(origin));
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'openid email');
	url.searchParams.set('state', pending.state);
	url.searchParams.set('nonce', pending.nonce);
	url.searchParams.set('code_challenge', await oauth.calculatePKCECodeChallenge(pending.verifier));
	url.searchParams.set('code_challenge_method', 'S256');
	return url;
}

export type SignInResult =
	| { readonly ok: true; readonly email: string }
	| { readonly ok: false; readonly reason: 'state' | 'google' | 'exchange' | 'unverified' };

/** The callback's parameters, checked against the state; or why not. */
function callbackParams(client: oauth.Client, callbackUrl: URL, state: string): URLSearchParams | 'state' | 'google' {
	try {
		return oauth.validateAuthResponse(GOOGLE, client, callbackUrl, state);
	} catch (error) {
		return error instanceof oauth.AuthorizationResponseError ? 'google' : 'state';
	}
}

/**
 * Exchanges the code and returns Google's verified address. oauth4webapi checks the ID token's issuer, audience,
 * expiry and nonce, and PKCE. The token comes straight from Google's token endpoint over TLS, so its signature need
 * not be checked (OpenID Connect Core 3.1.3.7).
 */
export async function finishSignIn(
	client: GoogleClient,
	callbackUrl: URL,
	pending: Pending,
	fetchFn: typeof fetch = fetch
): Promise<SignInResult> {
	const as_client: oauth.Client = { client_id: client.id };
	const params = callbackParams(as_client, callbackUrl, pending.state);
	if (typeof params === 'string') return { ok: false, reason: params };
	let claims: oauth.IDToken | undefined;
	try {
		const response = await oauth.authorizationCodeGrantRequest(
			GOOGLE,
			as_client,
			oauth.ClientSecretPost(client.secret),
			params,
			redirectUri(callbackUrl.origin),
			pending.verifier,
			{ [oauth.customFetch]: fetchFn, signal: AbortSignal.timeout(TIMEOUT_MS) }
		);
		const result = await oauth.processAuthorizationCodeResponse(GOOGLE, as_client, response, {
			expectedNonce: pending.nonce,
			requireIdToken: true
		});
		claims = oauth.getValidatedIdTokenClaims(result);
	} catch {
		return { ok: false, reason: 'exchange' };
	}
	const email = claims?.email;
	if (typeof email !== 'string' || claims?.email_verified !== true) return { ok: false, reason: 'unverified' };
	return { ok: true, email: email.toLowerCase() };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/lib/server/google.test.ts`
Expected: PASS.
- **If `customFetch` doesn't accept `typeof fetch`:** wrap it as `(url, init) => fetchFn(url, init)` and rerun.
- **If the fake ID token is refused for its signature:** stop and report. That would mean this oauth4webapi version checks signatures from the token endpoint, which the design assumed it does not.

- [ ] **Step 6: Check, lint, format, commit**

```bash
npx prettier --write src/lib/server/google.ts src/lib/server/google.test.ts
npm run check && npm run lint
git add package.json package-lock.json src/lib/server/google.ts src/lib/server/google.test.ts
git commit -m "feat: the exchange with Google through oauth4webapi, pinned (ADR-014)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: the two routes, `/login/google` and its callback

**Files:**
- Modify: `src/env.ts` (add the three variables; `SITE_PASSWORD` stays until Task 4)
- Create: `src/routes/login/google/+server.ts`, `src/routes/login/google/callback/+server.ts`
- Test: `src/routes/login/google/server.test.ts`

**Interfaces:**
- Consumes: from `#lib/server/session`: `SESSION_COOKIE`, `OAUTH_COOKIE`, `OAUTH_PATH`, `OAUTH_MS`, `createSession`, `createOAuthCookie`, `readOAuthCookie`, `isAllowed`, `userHash`, `signInConfig`. From `#lib/server/google`: `newPending`, `authorizationUrl`, `finishSignIn`. From `#lib/server/access`: `BYPASS_COOKIE`, `LEGACY_COOKIE_PATH`, `bypassToken`, `sessionCookieOptions`. From `#lib/return-path`: `returnPath`.
- Produces: `GET /login/google?from=` and `GET /login/google/callback`; redirects to `/login?error=denied` and `/login?error=failed`.

- [ ] **Step 1: Add the variables to `src/env.ts`**

Inside `defineEnvVars({ ... })`, after `SESSION_SECRET`, add:

```ts
	GOOGLE_CLIENT_ID: { schema: optional, description: 'OAuth client id for Sign in with Google' },
	GOOGLE_CLIENT_SECRET: { schema: optional, description: 'OAuth client secret for Sign in with Google' },
	ALLOWED_EMAILS: {
		schema: optional,
		description: 'Comma-separated Google addresses that may log in; unset lets nobody in'
	},
```

and change the comment above `optional` to name `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS` and `SESSION_SECRET` as the login's variables. Run `npx svelte-kit sync`.

- [ ] **Step 2: Write the failing tests**

`src/routes/login/google/server.test.ts`:

```ts
// The two routes of the Google sign-in. finishSignIn is replaced: google.test.ts tests it against a fake Google.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Env = Record<
	'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'ALLOWED_EMAILS' | 'SESSION_SECRET' | 'ISR_BYPASS_TOKEN',
	string | undefined
>;
const env = vi.hoisted(
	(): Env => ({
		GOOGLE_CLIENT_ID: 'id',
		GOOGLE_CLIENT_SECRET: 'cs',
		ALLOWED_EMAILS: 'person@example.test',
		SESSION_SECRET: 's'.repeat(32),
		ISR_BYPASS_TOKEN: 't'.repeat(40)
	})
);
vi.mock('$app/env/private', () => env);
const finish = vi.hoisted(() => vi.fn());
vi.mock('#lib/server/google', async (actual) => ({
	...(await actual<typeof import('#lib/server/google')>()),
	finishSignIn: finish
}));

import { BYPASS_COOKIE, LEGACY_COOKIE_PATH } from '#lib/server/access';
import {
	OAUTH_COOKIE,
	OAUTH_PATH,
	SESSION_COOKIE,
	createOAuthCookie,
	parseAllowed,
	readOAuthCookie,
	verifySession
} from '#lib/server/session';
import { GET as start } from './+server';
import { GET as callback } from './callback/+server';

type Call = { name: string; value?: string; options: Record<string, unknown> };
function fakeCookies(jar: Record<string, string> = {}) {
	const sets: Call[] = [];
	const deletes: Call[] = [];
	return {
		sets,
		deletes,
		cookies: {
			get: (name: string) => jar[name],
			set: (name: string, value: string, options: Record<string, unknown>) => sets.push({ name, value, options }),
			delete: (name: string, options: Record<string, unknown>) => deletes.push({ name, options })
		}
	};
}

async function redirected(run: () => unknown): Promise<{ status: number; location: string }> {
	try {
		await run();
	} catch (e) {
		const r = e as { status?: number; location?: string };
		if (typeof r.status === 'number' && typeof r.location === 'string') return { status: r.status, location: r.location };
		throw e;
	}
	throw new Error('expected a redirect');
}

const event = (path: string, cookies: ReturnType<typeof fakeCookies>['cookies']) => ({
	url: new URL(`https://app.example.test${path}`),
	cookies,
	setHeaders: vi.fn()
});
const call = (handler: unknown, e: unknown) => (handler as (e: unknown) => unknown)(e);

const pending = { state: 'st', nonce: 'no', verifier: 've', from: '/financials?symbol=AAPL' };
const withPending = async () => ({ [OAUTH_COOKIE]: await createOAuthCookie(env.SESSION_SECRET ?? '', pending) });
let logs: string[] = [];

beforeEach(() => {
	Object.assign(env, {
		GOOGLE_CLIENT_ID: 'id',
		GOOGLE_CLIENT_SECRET: 'cs',
		ALLOWED_EMAILS: 'person@example.test',
		SESSION_SECRET: 's'.repeat(32),
		ISR_BYPASS_TOKEN: 't'.repeat(40)
	});
	finish.mockReset();
	logs = [];
	for (const level of ['info', 'warn', 'error', 'log'] as const) {
		vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
			logs.push(args.map(String).join(' '));
		});
	}
});

describe('GET /login/google', () => {
	it('stores the pending sign-in and sends the browser to Google', async () => {
		const jar = fakeCookies();
		const r = await redirected(() => call(start, event('/login/google?from=%2Ffinancials', jar.cookies)));
		expect(r.status).toBe(303);
		const to = new URL(r.location);
		expect(to.origin).toBe('https://accounts.google.com');
		expect(to.searchParams.get('redirect_uri')).toBe('https://app.example.test/login/google/callback');
		const set = jar.sets.find((c) => c.name === OAUTH_COOKIE);
		expect(set?.options).toMatchObject({ path: OAUTH_PATH, httpOnly: true, sameSite: 'lax', maxAge: 600 });
		const stored = await readOAuthCookie(set?.value, env.SESSION_SECRET ?? '');
		expect(stored?.state).toBe(to.searchParams.get('state'));
		expect(stored?.from).toBe('/financials');
	});
	it('drops a from outside the allow-list', async () => {
		const jar = fakeCookies();
		await redirected(() => call(start, event('/login/google?from=https%3A%2F%2Fevil.test', jar.cookies)));
		const stored = await readOAuthCookie(jar.sets[0]?.value, env.SESSION_SECRET ?? '');
		expect(stored?.from).toBeNull();
	});
	it('goes back to /login when sign-in is not configured here', async () => {
		env.GOOGLE_CLIENT_ID = undefined;
		const jar = fakeCookies();
		expect(await redirected(() => call(start, event('/login/google', jar.cookies)))).toEqual({
			status: 303,
			location: '/login'
		});
		expect(jar.sets).toEqual([]);
	});
});

describe('GET /login/google/callback', () => {
	const at = '/login/google/callback?code=c&state=st';

	it('logs in an address on the list and returns to from', async () => {
		finish.mockResolvedValue({ ok: true, email: 'person@example.test' });
		const jar = fakeCookies(await withPending());
		const r = await redirected(() => call(callback, event(at, jar.cookies)));
		expect(r).toEqual({ status: 303, location: '/financials?symbol=AAPL' });
		const session = jar.sets.find((c) => c.name === SESSION_COOKIE);
		expect(await verifySession(session?.value, env.SESSION_SECRET ?? '', parseAllowed(env.ALLOWED_EMAILS))).toBe(
			'person@example.test'
		);
		expect(session?.options).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
		expect(jar.sets.find((c) => c.name === BYPASS_COOKIE)?.value).toBe(env.ISR_BYPASS_TOKEN);
		expect(jar.deletes).toContainEqual({ name: OAUTH_COOKIE, options: { path: OAUTH_PATH } });
		expect(jar.deletes).toContainEqual({ name: SESSION_COOKIE, options: { path: LEGACY_COOKIE_PATH } });
		expect(logs).toEqual([expect.stringMatching(/^login allowed user=[0-9a-f]{8}$/)]);
	});
	it('refuses an address not on the list, without a session', async () => {
		finish.mockResolvedValue({ ok: true, email: 'other@example.test' });
		const jar = fakeCookies(await withPending());
		expect(await redirected(() => call(callback, event(at, jar.cookies)))).toEqual({
			status: 303,
			location: '/login?error=denied'
		});
		expect(jar.sets).toEqual([]);
		expect(logs).toEqual([expect.stringMatching(/^login refused user=[0-9a-f]{8}$/)]);
	});
	it('refuses an address Google has not verified', async () => {
		finish.mockResolvedValue({ ok: false, reason: 'unverified' });
		const jar = fakeCookies(await withPending());
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login?error=denied');
		expect(jar.sets).toEqual([]);
	});
	it.each(['state', 'google', 'exchange'] as const)('fails without a session when the reason is %s', async (reason) => {
		finish.mockResolvedValue({ ok: false, reason });
		const jar = fakeCookies(await withPending());
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login?error=failed');
		expect(jar.sets).toEqual([]);
		expect(logs).toEqual([`login failed reason=${reason}`]);
	});
	it('fails without the pending cookie, and never asks Google', async () => {
		const jar = fakeCookies();
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login?error=failed');
		expect(finish).not.toHaveBeenCalled();
		expect(logs).toEqual(['login failed reason=cookie']);
	});
	it('returns home when the pending sign-in had no from', async () => {
		finish.mockResolvedValue({ ok: true, email: 'person@example.test' });
		const jar = fakeCookies({ [OAUTH_COOKIE]: await createOAuthCookie(env.SESSION_SECRET ?? '', { ...pending, from: null }) });
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/');
	});
	it('never logs or redirects with the address', async () => {
		finish.mockResolvedValue({ ok: true, email: 'other@example.test' });
		const jar = fakeCookies(await withPending());
		const r = await redirected(() => call(callback, event(at, jar.cookies)));
		expect(`${r.location} ${logs.join(' ')}`).not.toContain('example.test');
	});
	it('goes back to /login when sign-in is not configured here', async () => {
		env.ALLOWED_EMAILS = '';
		const jar = fakeCookies(await withPending());
		expect((await redirected(() => call(callback, event(at, jar.cookies)))).location).toBe('/login');
		expect(finish).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/routes/login/google/server.test.ts`
Expected: FAIL, "Failed to resolve import ./+server".

- [ ] **Step 4: Write the start route**

`src/routes/login/google/+server.ts`:

```ts
// Starts Sign in with Google (ADR-014): stores the state, nonce and PKCE verifier in a signed, short-lived cookie
// and sends the browser to Google.
import { ALLOWED_EMAILS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET } from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { returnPath } from '#lib/return-path';
import { authorizationUrl, newPending } from '#lib/server/google';
import { OAUTH_COOKIE, OAUTH_MS, OAUTH_PATH, createOAuthCookie, signInConfig } from '#lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const config = signInConfig({
		clientId: GOOGLE_CLIENT_ID,
		clientSecret: GOOGLE_CLIENT_SECRET,
		sessionSecret: SESSION_SECRET,
		allowed: ALLOWED_EMAILS
	});
	if (!config) redirect(303, '/login');
	const pending = newPending(returnPath(url.searchParams.get('from')));
	cookies.set(OAUTH_COOKIE, await createOAuthCookie(config.sessionSecret, pending), {
		path: OAUTH_PATH,
		httpOnly: true,
		sameSite: 'lax',
		maxAge: OAUTH_MS / 1000
	});
	const to = await authorizationUrl({ id: config.clientId, secret: config.clientSecret }, url.origin, pending);
	redirect(303, to.href);
};
```

- [ ] **Step 5: Write the callback route**

`src/routes/login/google/callback/+server.ts`:

```ts
// Finishes Sign in with Google (ADR-014): only an address on ALLOWED_EMAILS gets a session. Logs a keyed hash of the
// address, never the address, a token or Google's text.
import {
	ALLOWED_EMAILS,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	ISR_BYPASS_TOKEN,
	SESSION_SECRET
} from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { BYPASS_COOKIE, LEGACY_COOKIE_PATH, bypassToken, sessionCookieOptions } from '#lib/server/access';
import { finishSignIn } from '#lib/server/google';
import {
	OAUTH_COOKIE,
	OAUTH_PATH,
	SESSION_COOKIE,
	createSession,
	isAllowed,
	readOAuthCookie,
	signInConfig,
	userHash
} from '#lib/server/session';
import type { RequestHandler } from './$types';

const HOME = '/';

export const GET: RequestHandler = async ({ url, cookies, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const config = signInConfig({
		clientId: GOOGLE_CLIENT_ID,
		clientSecret: GOOGLE_CLIENT_SECRET,
		sessionSecret: SESSION_SECRET,
		allowed: ALLOWED_EMAILS
	});
	if (!config) redirect(303, '/login');

	const pending = await readOAuthCookie(cookies.get(OAUTH_COOKIE), config.sessionSecret);
	// single-use, whatever happens next
	cookies.delete(OAUTH_COOKIE, { path: OAUTH_PATH });
	if (!pending) {
		console.warn('login failed reason=cookie');
		redirect(303, '/login?error=failed');
	}

	const result = await finishSignIn({ id: config.clientId, secret: config.clientSecret }, url, pending);
	if (!result.ok && result.reason !== 'unverified') {
		console.warn(`login failed reason=${result.reason}`);
		redirect(303, '/login?error=failed');
	}
	if (!result.ok || !isAllowed(result.email, config.allowed)) {
		const user = result.ok ? await userHash(result.email, config.sessionSecret) : 'unverified';
		console.warn(`login refused user=${user}`);
		redirect(303, '/login?error=denied');
	}

	cookies.set(SESSION_COOKIE, await createSession(config.sessionSecret, result.email), sessionCookieOptions());
	cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
	const token = bypassToken(ISR_BYPASS_TOKEN);
	if (token) cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
	console.info(`login allowed user=${await userHash(result.email, config.sessionSecret)}`);
	redirect(303, pending.from ?? HOME);
};
```

An unverified address logs `login refused user=unverified`, because it has no hash worth trusting. Add that case to the "refuses an address Google has not verified" test: `expect(logs).toEqual(['login refused user=unverified'])`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/routes/login/google/server.test.ts`
Expected: PASS.

- [ ] **Step 7: Check, lint, format, commit**

```bash
npx prettier --write src/env.ts src/routes/login/google
npm run check && npm run lint
git add src/env.ts src/routes/login/google
git commit -m "feat: the /login/google routes, limited to ALLOWED_EMAILS (ADR-014)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: switch over: hooks, `/login`, the financials pages and e2e; the password goes

**Files:**
- Modify: `src/hooks.server.ts`, `src/hooks.server.test.ts`, `src/lib/server/access.ts`, `src/lib/server/access.test.ts` (imports only), `src/routes/login/+page.server.ts`, `src/routes/login/+page.svelte`, `src/routes/login/page.server.test.ts`, `src/lib/components/LoginForm.svelte`, `src/lib/components/login-views.test.ts`, `src/routes/financials/+page.server.ts`, `src/routes/financials/page.server.test.ts`, `src/routes/financials/valuation/+page.server.ts`, `src/routes/financials/valuation/page.server.test.ts`, `src/env.ts`, `.env.example`, `playwright.config.ts`, `e2e/smoke.spec.ts`
- Delete: `src/lib/server/auth.ts`, `src/lib/server/auth.test.ts`, `src/lib/server/ratelimit.ts`, `src/lib/server/ratelimit.test.ts`

**Interfaces:**
- Consumes: Task 1's `session.ts` and Task 3's routes.
- Produces: `LoginForm` props `{ configured: boolean; from: string | null; error: 'denied' | 'failed' | null }`. The `/login` load returns `{ configured, from, error }`. `actions` holds only `logout`.

- [ ] **Step 1: `access.ts` off `node:crypto`**

Replace the first two lines (`import { createHash, timingSafeEqual } from 'node:crypto';` and `import { SESSION_MS } from './auth';`) with:

```ts
import { SESSION_MS, safeEqual } from './session';
```

Delete `const digest = ...`. In `isInteractive`, replace the last line with:

```ts
	return bypassCookie !== undefined && safeEqual(bypassCookie, token);
```

Run: `npx vitest run src/lib/server/access.test.ts`. Expected: PASS with the assertions unchanged. If the test imports from `./auth`, point that import at `./session`.

- [ ] **Step 2: hooks**

In `src/hooks.server.ts`:
- change the first import to `import { ALLOWED_EMAILS, ISR_BYPASS_TOKEN, SESSION_SECRET } from '$app/env/private';`;
- change the second to `import { SESSION_COOKIE, parseAllowed, verifySession } from '#lib/server/session';`;
- delete `import { randomUUID } from 'node:crypto';` and use `crypto.randomUUID()` in `handleError`.

Replace the `authed` lines with:

```ts
	// Fails closed: with no SESSION_SECRET or an empty ALLOWED_EMAILS, nobody is logged in. An address taken off the
	// list ends its session at the next request after the redeploy (ADR-014).
	const email = await verifySession(event.cookies.get(SESSION_COOKIE), SESSION_SECRET ?? '', parseAllowed(ALLOWED_EMAILS));
	event.locals.authed = email !== null;
```

In `src/hooks.server.test.ts`:
- add `ALLOWED_EMAILS: undefined as string | undefined` to the hoisted `env`, and set `env.ALLOWED_EMAILS = 'person@example.test'` in `beforeEach`;
- import `createSession` from `#lib/server/session`;
- make `session` async: `const session = () => createSession(SECRET, 'person@example.test');`;
- at each use, `await session()`.

Add one test:

```ts
	it('ends the session of an address taken off the list', async () => {
		const cookie = await session();
		env.ALLOWED_EMAILS = 'other@example.test';
		const { locals } = await run('/companies', { cookies: { [SESSION_COOKIE]: cookie, [BYPASS_COOKIE]: TOKEN } });
		expect(locals.authed).toBe(false);
		expect(locals.interactive).toBe(false);
	});
```

Run: `npx vitest run src/hooks.server.test.ts`. Expected: PASS.

- [ ] **Step 3: the `/login` page**

Replace `src/routes/login/+page.server.ts` with:

```ts
import { ALLOWED_EMAILS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ISR_BYPASS_TOKEN, SESSION_SECRET } from '$app/env/private';
import { redirect } from '@sveltejs/kit';
import { returnPath } from '#lib/return-path';
import { BYPASS_COOKIE, LEGACY_COOKIE_PATH, bypassToRestore, sessionCookieOptions } from '#lib/server/access';
import { SESSION_COOKIE, signInConfig } from '#lib/server/session';
import type { Actions, PageServerLoad } from './$types';

/** Where to go when no allow-listed page was given. */
const HOME = '/';

const errorOf = (raw: string | null): 'denied' | 'failed' | null => (raw === 'denied' || raw === 'failed' ? raw : null);

export const load: PageServerLoad = ({ locals, url, setHeaders, cookies }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const from = returnPath(url.searchParams.get('from'));

	if (locals.authed) {
		// Logged in but without the bypass cookie (cleared, or the token was rotated): give it back here, where
		// nothing is cached. Hooks never set cookies.
		const token = bypassToRestore(locals.authed, locals.interactive, ISR_BYPASS_TOKEN);
		if (token) cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
		redirect(303, from ?? HOME);
	}

	const configured =
		signInConfig({
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
			sessionSecret: SESSION_SECRET,
			allowed: ALLOWED_EMAILS
		}) !== null;
	return { configured, from, error: errorOf(url.searchParams.get('error')) };
};

export const actions: Actions = {
	logout: ({ cookies, url }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		cookies.delete(BYPASS_COOKIE, { path: '/' });
		redirect(303, returnPath(url.searchParams.get('from')) ?? HOME);
	}
};
```

In `src/routes/login/+page.svelte`, change the component line to:

```svelte
	<LoginForm configured={data.configured} from={data.from} error={data.error} />
```

and remove `form` from the props destructuring (`let { data }: PageProps = $props();`).

Replace `src/lib/components/LoginForm.svelte` with:

```svelte
<script lang="ts">
	import Callout from '#lib/components/Callout.svelte';
	let {
		configured,
		from,
		error
	}: { configured: boolean; from: string | null; error: 'denied' | 'failed' | null } = $props();

	const start = $derived(from ? `/login/google?from=${encodeURIComponent(from)}` : '/login/google');
</script>

<p class="note">
	The data on every page is open to all. Logging in adds the selection and chart controls, and the Financials and
	Valuation pages.
</p>
{#if !configured}
	<Callout variant="negative">Logging in is only available on the production site.</Callout>
{:else}
	<p class="login"><a href={start} data-sveltekit-reload>Sign in with Google</a></p>
{/if}
{#if error === 'denied'}
	<Callout variant="negative">This Google account has no access.</Callout>
{:else if error === 'failed'}
	<Callout variant="negative">Signing in did not work. Try again.</Callout>
{/if}
{#if from}<p class="note"><a href={from}>Back without logging in</a></p>{/if}

<style>
	.note {
		color: var(--text-secondary);
	}
	.login {
		margin: var(--space-4) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
</style>
```

`data-sveltekit-reload` makes the link a full page load, because `/login/google` is a server route that redirects to Google. Run the Svelte MCP `svelte-autofixer` on the component and repeat until it reports nothing.

- [ ] **Step 4: their tests**

In `src/lib/components/login-views.test.ts`, replace the `describe('LoginForm', ...)` block with:

```ts
describe('LoginForm', () => {
	it('links to the Google sign-in with the page to return to, and back to it', () => {
		const body = html(LoginForm, { configured: true, from: '/financials?symbol=AAPL', error: null });
		expect(body).toContain('href="/login/google?from=%2Ffinancials%3Fsymbol%3DAAPL"');
		expect(body).toContain('Sign in with Google');
		expect(body).toContain('data-sveltekit-reload');
		expect(body).toContain('href="/financials?symbol=AAPL"');
		expect(body).not.toContain('type="password"');
	});
	it('links to the plain sign-in without a page to return to', () => {
		const body = html(LoginForm, { configured: true, from: null, error: null });
		expect(body).toContain('href="/login/google"');
		expect(body).not.toContain('Back without logging in');
	});
	it('says sign-in is only on production, with no link, where it is not configured', () => {
		const body = html(LoginForm, { configured: false, from: null, error: null });
		expect(body).toContain('Logging in is only available on the production site.');
		expect(body).not.toContain('/login/google');
	});
	it.each([
		['denied', 'This Google account has no access.'],
		['failed', 'Signing in did not work. Try again.']
	] as const)('shows the %s message', (error, text) => {
		expect(html(LoginForm, { configured: true, from: null, error })).toContain(text);
	});
});
```

Rewrite `src/routes/login/page.server.test.ts`:
- the hoisted env holds `GOOGLE_CLIENT_ID: 'id'`, `GOOGLE_CLIENT_SECRET: 'cs'`, `ALLOWED_EMAILS: 'person@example.test'`, `SESSION_SECRET` and `ISR_BYPASS_TOKEN`, and `beforeEach` resets the same;
- delete the `login` helper and every test of the `login` action;
- keep the logout tests and the load tests for "logged in", "bypass restored" and "home without from" as they are.

Change the two load tests that read `configured` to:

```ts
	it('is private and uncached, and offers the sign-in with an allow-listed from', () => {
		const setHeaders = vi.fn();
		const data = (load as unknown as (e: unknown) => unknown)({
			locals: { authed: false, interactive: false },
			url: new URL('http://x.test/login?from=%2Ffinancials'),
			setHeaders,
			cookies: fakeCookies().cookies
		});
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
		expect(data).toEqual({ configured: true, from: '/financials', error: null });
	});
	it('drops a from outside the allow-list, passes a known error and says when sign-in is not configured', () => {
		env.ALLOWED_EMAILS = undefined;
		const data = (load as unknown as (e: unknown) => unknown)({
			locals: { authed: false, interactive: false },
			url: new URL('http://x.test/login?from=https%3A%2F%2Fevil.test&error=denied'),
			setHeaders: vi.fn(),
			cookies: fakeCookies().cookies
		});
		expect(data).toEqual({ configured: false, from: null, error: 'denied' });
	});
	it('ignores an unknown error', () => {
		const data = (load as unknown as (e: unknown) => unknown)({
			locals: { authed: false, interactive: false },
			url: new URL('http://x.test/login?error=<script>'),
			setHeaders: vi.fn(),
			cookies: fakeCookies().cookies
		});
		expect(data).toMatchObject({ error: null });
	});
```

Keep the existing names of the logged-in tests; adapt their `load` event only if they relied on `SITE_PASSWORD`.

- [ ] **Step 5: the financials pages**

In `src/routes/financials/+page.server.ts` and `src/routes/financials/valuation/+page.server.ts`:
- in the `$app/env/private` import, replace `SITE_PASSWORD` with `ALLOWED_EMAILS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET`;
- add `import { signInConfig } from '#lib/server/session';`;
- replace `configured: Boolean(SITE_PASSWORD && SESSION_SECRET),` with:

```ts
		configured:
			signInConfig({
				clientId: GOOGLE_CLIENT_ID,
				clientSecret: GOOGLE_CLIENT_SECRET,
				sessionSecret: SESSION_SECRET,
				allowed: ALLOWED_EMAILS
			}) !== null,
```

In both `page.server.test.ts` files, replace `SITE_PASSWORD` in the env type, the hoisted values and `beforeEach` with `GOOGLE_CLIENT_ID: 'id'`, `GOOGLE_CLIENT_SECRET: 'cs'`, `ALLOWED_EMAILS: 'person@example.test'`. Where a test sets `env.SITE_PASSWORD = undefined` to check `configured: false`, set `env.ALLOWED_EMAILS = undefined` instead.

- [ ] **Step 6: remove the password**

```bash
git rm src/lib/server/auth.ts src/lib/server/auth.test.ts src/lib/server/ratelimit.ts src/lib/server/ratelimit.test.ts
grep -rn "SITE_PASSWORD\|passwordMatches\|server/auth'\|ratelimit" src e2e scripts playwright.config.ts .env.example
```

Expected after the next edits: no matches.
- In `src/env.ts`, delete the `SITE_PASSWORD` entry.
- In `.env.example`, replace the `SITE_PASSWORD=` line with:

```
# Sign in with Google (ADR-014): an OAuth client of type "Web application", callback
# http://localhost:5173/login/google/callback, and your own address in ALLOWED_EMAILS
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAILS=
```

- [ ] **Step 7: e2e**

In `playwright.config.ts`, replace `SITE_PASSWORD: 'e2e-password',` with:

```ts
			GOOGLE_CLIENT_ID: 'e2e-client-id',
			GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
			ALLOWED_EMAILS: 'e2e@example.test',
```

and change the comment to "test-only values: sign-in is configured, so /login offers it, and the tests log in by setting a signed session cookie; no test calls Google or FMP."

In `e2e/smoke.spec.ts`:
- add `import { SESSION_COOKIE, createSession } from '../src/lib/server/session';`;
- add the constants `const SESSION_SECRET = 'e2e-session-secret-0123456789abcdef';` and `const BYPASS = 'e2e-bypass-token-0123456789abcdefghij';`, which must equal `playwright.config.ts`;
- replace `logIn` with:

```ts
/** Logs in as the e2e address by setting the signed session and bypass cookies, as the Google callback would. */
async function logIn(page: Page): Promise<void> {
	const session = await createSession(SESSION_SECRET, 'e2e@example.test');
	await page.context().addCookies([
		{ name: SESSION_COOKIE, value: session, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
		{ name: '__prerender_bypass', value: BYPASS, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }
	]);
	await page.goto('/financials');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
}
```

Replace the test `'a wrong password is refused'` with:

```ts
test('the sign-in starts at Google, and a refused account is told so', async ({ page, request }) => {
	const response = await request.get('/login/google?from=%2Ffinancials', { maxRedirects: 0 });
	expect(response.status()).toBe(303);
	expect(response.headers().location).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
	await page.goto('/login?error=denied');
	await expect(page.getByText('This Google account has no access.')).toBeVisible();
	await expectAccessible(page);
});
```

In `'the menubar login returns to the page it was opened from'`, replace the three lines from `await page.getByLabel('Password')` to the Log-out check with:

```ts
	await expect(page.getByRole('link', { name: 'Sign in with Google' })).toHaveAttribute(
		'href',
		'/login/google?from=%2Fcompanies'
	);
	await logIn(page);
	await page.goto('/companies');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
```

In `'logging in opens /financials and logging out locks it again'`, `logIn` already lands on `/financials`. Keep the rest.

If the `Callout` for "has no access" has `role="alert"`, use `page.getByRole('alert')` with `toHaveText` instead of `getByText`.

- [ ] **Step 8: Run everything**

```bash
npx svelte-kit sync
npm run check && npm run lint && npm run format:check
npm run test:coverage
npm run build && npm run test:e2e
npx svelte-kit sync
```

Expected: all pass, coverage above the thresholds. If a coverage threshold fails, add the missing case to the test of the file named in the report.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: sign in with Google only; the shared password and its rate limit go (ADR-014)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: ADR-014 and the documents

**Files:**
- Create: `docs/adr/0014-google-sign-in.md`
- Modify: `docs/adr/0003-public-pages-isr-login-unlocks.md`, `docs/adr/README.md`, `src/lib/overview/adr.ts`, `AGENTS.md`, `docs/configuration.md`, `docs/financials.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: the behaviour of Tasks 1–4.
- Produces: documents only. `ADR_THEMES` gains `'ADR-014': 'Access'`.

- [ ] **Step 1: Write ADR-014**

`docs/adr/0014-google-sign-in.md`:

```markdown
---
status: Proposed
date: 2026-11-26
decision-makers: Jan-Ru Muller (sole maintainer)
---
# ADR-014: Sign in with Google, limited to a list of permitted addresses

- **Proposed:** 2026-11-26. Supersedes ADR-003's sign-in method (the shared password), not its split between public
  and logged-in views.
- **Spec:** `docs/superpowers/specs/2026-11-26-google-sign-in-design.md`, for #133.
- **Component:** `src/lib/server/session.ts`, `src/lib/server/google.ts`, `src/routes/login/`, `src/hooks.server.ts`

## Context

One shared password (`SITE_PASSWORD`) opened `/financials` and made the public pages interactive. Everyone who knew it
was the same user, a leaver could only be locked out by changing it for everyone, and the log could not say who
looked. The site may also move from Vercel to Cloudflare or a VPS (#175), so the login must not depend on one host.

## Decision

1. **Google is the only sign-in.** OpenID Connect, authorization code with PKCE, scopes `openid email`, through
   `oauth4webapi`, pinned exactly. It uses Web standards only, so it runs on Node, Cloudflare Workers and a VPS.
   `SITE_PASSWORD` and its rate limit are removed.
2. **Only addresses on `ALLOWED_EMAILS` get in.** Exact addresses, compared lower-cased, in an environment variable,
   never in the repository, which is public. Google must have verified the address. The list is checked at sign-in
   and on every request, so removing an address and redeploying ends that session.
3. **The session cookie carries the address,** signed with `SESSION_SECRET` (HMAC-SHA256, Web Crypto), for seven
   days. The state, nonce and verifier travel in a second signed cookie, valid for ten minutes and used once.
4. **No login on previews.** Google needs every callback URL registered in advance, and each preview has a new
   address. Logged-in work is tested locally and on production.
5. **Logs hold no addresses.** A login logs `login allowed`, `login refused` or `login failed`, with an 8-character
   keyed hash of the address or a fixed reason.
6. **ADR-003's split stands.** The ISR bypass cookie, `isInteractive`, `isRevalidation` and `pageParams` are unchanged.

## Alternatives ruled out

- **Keep the password beside Google, or as a fallback.** A shared secret with all its rotation duties, kept for a
  case a revert of the release covers.
- **`arctic`.** Deprecated on npm.
- **Auth.js.** Replaces the session, cookies and pages, and sits badly with the ISR bypass cookie and the CSP.
- **Host-level protection** (Cloudflare Access, Vercel deployment protection). Tied to one host, and blind to ADR-003's
  split.
- **Domains in the list** (`@hva.nl`). A much wider door than named people.
- **A shared store for the list** (a database, a key-value service). One more service and key, and code that differs
  by host, for a short list that rarely changes.

## Consequences

- Each person logs in as themselves, and access is withdrawn from one person by editing the list and redeploying.
- Everyone logs in once more after the deploy: older session cookies have no address.
- The maintainer registers each host's callback URL with Google (production and localhost now). An own domain makes a
  move of host keep the same callback.
- Previews cannot show `/financials`. A fixed staging address can be added later with one more registered callback.
- Rotating `SESSION_SECRET` ends every session and changes every log hash.
```

- [ ] **Step 2: ADR-003, the README and the theme**

Append to `docs/adr/0003-public-pages-isr-login-unlocks.md`:

```markdown

## Clarification, 2026-11-26: the sign-in is now Google's (ADR-014)

The shared password is gone. People sign in with Google, limited to the addresses on `ALLOWED_EMAILS`
([ADR-014](0014-google-sign-in.md)). The split between the cached anonymous view and the interactive view, the bypass
cookie and the revalidation rule are unchanged.
```

In `docs/adr/README.md`, add after the ADR-013 row:

```markdown
| ADR-014 | Sign in with Google, limited to a list of permitted addresses | Proposed | [0014-google-sign-in.md](0014-google-sign-in.md) |
```

Do not add ADR-014 to `ADR_THEMES` yet: that table may name only accepted ADRs, and a test checks it. That edit, the status change to Accepted and the README row change happen when the maintainer says "accept ADR-014".

- [ ] **Step 3: AGENTS.md** (`CLAUDE.md` is a symlink to it)

- In the `/financials` line, replace "is password protected" with "is behind Sign in with Google (ADR-014)".
- Replace the **Login** bullet with:

```markdown
- **Login** is Sign in with Google (ADR-014): `/login` (private, `no-store`) offers it and the `logout` action; `/login/google` starts it and `/login/google/callback` finishes it. Only Google-verified addresses on `ALLOWED_EMAILS` (exact, comma-separated, never committed) get a session, and hooks re-check the list on every request. Previews have no login (Google needs each callback URL registered). Logs carry an 8-character keyed hash of the address (`userHash`), never the address. Every "Log in" link goes to `/login` through `loginHref(from)` and logout posts to `logoutAction(from)` (`src/lib/return-path.ts`); `from` is an allow-listed path (`RETURN_PATHS`) with its query kept. A new page that offers a login adds its path to `RETURN_PATHS`. The login code uses Web Crypto, not `node:crypto`, so it runs on Vercel, Cloudflare and a VPS.
```

- In the **Secrets** bullet, replace the list with `(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS, SESSION_SECRET, FMP_API_KEY, EULERPOOL_API_KEY, ISR_BYPASS_TOKEN)`.
- In the `ISR_BYPASS_TOKEN` bullet, replace "together with a password change" with "together with `SESSION_SECRET`".

- [ ] **Step 4: `docs/configuration.md` and `docs/financials.md`**

In `docs/configuration.md`:
- replace the `SITE_PASSWORD` bullet with three bullets: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, from an OAuth client of type "Web application" in Google Cloud Console, with the callback `https://<host>/login/google/callback` registered for each host and `http://localhost:5173/login/google/callback` for local work; and `ALLOWED_EMAILS`, the exact Google addresses that may log in, comma-separated;
- say these are set for **Production only**, so previews have no login;
- in the `ISR_BYPASS_TOKEN` text, replace "ideally together with a `SITE_PASSWORD` change" with "ideally together with `SESSION_SECRET`";
- replace "If `SITE_PASSWORD` or `SESSION_SECRET` is unset, nobody can log in" with "If any of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS` or `SESSION_SECRET` is unset, nobody can log in, and `/login` says logging in is only available on the production site".

Replace the login paragraph with:

```markdown
Logging in is Sign in with Google (ADR-014). Only an address on `ALLOWED_EMAILS` that Google has verified gets a signed, HTTP-only session cookie that lasts 7 days and applies to the whole site (path `/`); when `ISR_BYPASS_TOKEN` is usable, the `__prerender_bypass` cookie is set too. Hooks re-check the address against the list on every request, so removing it and redeploying logs that person out. Logging out clears the cookies in that browser; to log everyone out, change `SESSION_SECRET`. Login events are logged with an 8-character keyed hash of the address, never the address: to find a person's hash, compute it with `userHash` and the production secret. To test the login locally, put the three Google variables and your own address in `.env` and use `npm run dev` on port 5173.
```

In `docs/financials.md`, line 37, replace "is password protected" with "is behind Sign in with Google (ADR-014)".

- [ ] **Step 5: CHANGELOG**

Under `## [Unreleased]`, add after the "Releases and security" section:

```markdown
### Access

- Sign in with Google replaces the shared password (#<PR>, ADR-014). Only the Google addresses on `ALLOWED_EMAILS` get in, checked again on every request, so one person's access can be withdrawn. The login runs on Web Crypto and `oauth4webapi`, so it works on Vercel, Cloudflare and a Node server alike. Previews have no login. Everyone logs in once more after the release.
```

and change the count line at the top of the Unreleased section from "12 merged PRs (#164, #166 to #174, #176, #177)" to "13 merged PRs (#164, #166 to #174, #176, #177, #<PR>)". Fill in `<PR>` once the pull request exists.

- [ ] **Step 6: Check and commit**

```bash
npx vitest run src/lib/overview
npm run check && npm run lint
git add -A
git commit -m "docs: ADR-014 (Proposed), sign in with Google; ADR-003 clarified, configuration and AGENTS.md updated

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Push and open the pull request (do not merge)**

```bash
gitleaks git --log-opts="main..HEAD" --redact --no-banner
git push -u origin feat/google-sign-in
gh pr create --title "feat: sign in with Google, limited to a list of permitted addresses (ADR-014)" --body-file <body>
```

The body says what changes, closes #133, and lists the maintainer's setup from the spec: create the OAuth client, register the two callback URLs, set the three variables for Production only and delete `SITE_PASSWORD`. Then fill in `<PR>` in `CHANGELOG.md`, commit and push.
