# Financial statements page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A password-protected `/financials` page that shows the annual income statement, balance sheet and cash flow statement (last 5 fiscal years) for a ticker typed by the visitor, using the owner's Financial Modeling Prep (FMP) key.

**Architecture:** Pure, separately tested modules (ticker pattern, signed session cookie, rate limiter, FMP client/parser, table builder) feed one server-side loader. `hooks.server.ts` verifies the session cookie and sets `event.locals.authed`; the page's `load` is the only code that can reach FMP and it refuses without `authed`. Secrets are read from `$env/dynamic/private` only in the route and hook; library modules take them as arguments so they test without SvelteKit.

**Tech Stack:** SvelteKit 3 / Svelte 5, TypeScript (strict), Vitest, `node:crypto`, FMP stable API.

**Spec:** `docs/superpowers/specs/2026-10-25-financials-page-design.md`

## Global Constraints

- TypeScript only: no `.js`/`.mjs`/`.cjs` files (CLAUDE.md; `npm run check:ts-only` enforces it).
- Import `src/lib` with the `#lib/...` alias, never `$lib`.
- Library modules under `src/lib` must not import `$env/*` or `$app/*`; only `hooks.server.ts` and `src/routes/financials/*` may read the environment.
- Secrets are named exactly `FMP_API_KEY`, `SITE_PASSWORD`, `SESSION_SECRET`. They are never logged, never placed in a returned error message and never committed. The FMP URL contains `apikey=` and must never be logged or shown.
- Fail closed: if `SITE_PASSWORD` or `SESSION_SECRET` is empty or unset, `verifySession` and `passwordMatches` return `false`.
- The `/financials` response must carry `Cache-Control: private, no-store` (the other pages use public CDN caching; this page must never be cached that way).
- Tests use Vitest with no network. `npm run check` must report 0 errors; `npm test`, `npm run check:ts-only` and `npm run build` must pass before the PR is opened.
- Use Node 24 for all commands (local Node is newer): prefix with `npx -y node@24 node_modules/.bin/<tool>` or `npx -y node@24 node_modules/vitest/vitest.mjs run <file>`. Below, `npx vitest run <file>` stands for that.
- Work on branch `feat/financials-page`, created from `docs/financials-spec` so the spec and this plan ship with the code. Open a PR; do not merge without the owner's approval.

## Rulings

- Spec says an unauthenticated visit returns HTTP 401. SvelteKit's `load` cannot set a non-error status, so the login view is returned with HTTP 200 and `no-store`. The guarantee that matters (no data and no FMP call without a session) is unchanged. Task 8 amends the spec line.
- Spec says the gate lives in `hooks.server.ts`. The hook only computes `locals.authed`; the enforcement is inside `loadFinancials`, the only code path that calls FMP, so a missed hook match cannot leak data. Task 8 amends the spec wording.
- Spec says fixtures are recorded real responses. The parser is deliberately generic (every numeric field except known metadata becomes a line item), so field-name differences are harmless. Tests use representative fixtures; Task 9 checks the real shape on a preview deployment.
- Caching is per statement (`kind:SYMBOL`), not per ticker, because `createCache` rethrows failures instead of caching them; a combined entry would cache error results for 24 hours.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/symbol.ts` (+ test) | `parseSymbol`: validate and normalise a ticker |
| `src/lib/server/auth.ts` (+ test) | `passwordMatches`, `createSession`, `verifySession`, `SESSION_COOKIE`, `SESSION_MS` |
| `src/lib/server/ratelimit.ts` (+ test) | `createRateLimiter`: failed-login counter per key |
| `src/lib/server/fmp.ts` (+ test) | `fetchStatement`, `parseStatement`, `FmpError`, types |
| `src/lib/statements.ts` (+ test) | `buildTable`, `humanise`, `formatValue` |
| `src/lib/server/financials.ts` (+ test) | `loadFinancials`: the gate and the three-statement load |
| `src/app.d.ts` | `App.Locals.authed` |
| `src/hooks.server.ts` | set `locals.authed`; `no-store` for `/financials` |
| `src/routes/financials/+page.server.ts` | `load`, `login`, `logout` |
| `src/routes/financials/+page.svelte` | login form, ticker form, tables |
| `src/routes/+layout.svelte` | add the nav link |
| `.gitignore`, `README.md`, `CLAUDE.md`, spec | env files ignored; documentation; spec amendments |

---

### Task 1: Ticker pattern

**Files:**
- Create: `src/lib/symbol.ts`
- Test: `src/lib/symbol.test.ts`

**Interfaces:**
- Produces: `parseSymbol(raw: string | null | undefined): string | null` (upper-cased, trimmed; `null` when invalid)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/symbol.test.ts
import { describe, expect, it } from 'vitest';
import { parseSymbol } from './symbol';

describe('parseSymbol', () => {
	it('upper-cases and trims', () => {
		expect(parseSymbol('aapl')).toBe('AAPL');
		expect(parseSymbol('  abn.as ')).toBe('ABN.AS');
	});
	it('accepts dots, dashes and a leading caret', () => {
		expect(parseSymbol('BRK-B')).toBe('BRK-B');
		expect(parseSymbol('7203.T')).toBe('7203.T');
		expect(parseSymbol('^GSPC')).toBe('^GSPC');
	});
	it('rejects empty, missing and over-long input', () => {
		expect(parseSymbol('')).toBeNull();
		expect(parseSymbol('   ')).toBeNull();
		expect(parseSymbol(null)).toBeNull();
		expect(parseSymbol(undefined)).toBeNull();
		expect(parseSymbol('A'.repeat(16))).toBeNull();
	});
	it('rejects characters that could alter a URL', () => {
		for (const bad of ['A B', 'AAPL&x=1', 'a/b', 'A?B', 'A#B', 'A%20B', 'A=B', "A'B"]) {
			expect(parseSymbol(bad), bad).toBeNull();
		}
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/symbol.test.ts`
Expected: FAIL (cannot find module `./symbol`).

- [ ] **Step 3: Implement**

```ts
// src/lib/symbol.ts
const PATTERN = /^[A-Z0-9.^-]{1,15}$/;

/** A ticker in FMP style (AAPL, ABN.AS, BRK-B), upper-cased; null when it is not safe to send to FMP. */
export function parseSymbol(raw: string | null | undefined): string | null {
	const symbol = (raw ?? '').trim().toUpperCase();
	return PATTERN.test(symbol) ? symbol : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/symbol.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/symbol.ts src/lib/symbol.test.ts
git commit -m "feat: ticker validation for the financials page"
```

---

### Task 2: Session cookie and password check

**Files:**
- Create: `src/lib/server/auth.ts`
- Test: `src/lib/server/auth.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_COOKIE = 'fin_session'`, `SESSION_MS = 7 * 24 * 60 * 60 * 1000`
  - `passwordMatches(input: string, expected: string): boolean` (false when `expected` is empty)
  - `createSession(secret: string, now?: number): string` (value `"<expiresMs>.<hexSignature>"`)
  - `verifySession(value: string | undefined, secret: string, now?: number): boolean` (false for empty value or secret)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/auth.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/auth.test.ts`
Expected: FAIL (cannot find module `./auth`).

- [ ] **Step 3: Implement**

```ts
// src/lib/server/auth.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/server/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/auth.ts src/lib/server/auth.test.ts
git commit -m "feat: signed session cookie and constant-time password check"
```

---

### Task 3: Failed-login rate limiter

**Files:**
- Create: `src/lib/server/ratelimit.ts`
- Test: `src/lib/server/ratelimit.test.ts`

**Interfaces:**
- Produces: `createRateLimiter(options: { max: number; windowMs: number; now?: () => number }): RateLimiter` where `RateLimiter = { isLimited(key: string): boolean; recordFailure(key: string): void; reset(key: string): void }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/ratelimit.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/ratelimit.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement**

```ts
// src/lib/server/ratelimit.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/server/ratelimit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/ratelimit.ts src/lib/server/ratelimit.test.ts
git commit -m "feat: in-memory failed-login rate limiter"
```

---

### Task 4: FMP client and parser

**Files:**
- Create: `src/lib/server/fmp.ts`
- Test: `src/lib/server/fmp.test.ts`

**Interfaces:**
- Produces:
  - `type Kind = 'income' | 'balance' | 'cashflow'`
  - `class FmpError extends Error { kind: 'config' | 'plan' | 'limit' | 'unavailable' }`
  - `interface StatementYear { fiscalYear: string; date: string; currency: string | null; values: Record<string, number | null> }`
  - `interface Statement { lines: string[]; years: StatementYear[] }` (years newest first, at most 5; `lines` = numeric field names in first-seen order)
  - `parseStatement(body: unknown): Statement` (throws `FmpError`)
  - `fetchStatement(kind: Kind, symbol: string, apiKey: string, fetchFn?: typeof fetch): Promise<Statement>`
  - `FETCH_TIMEOUT_MS = 10_000`, `MAX_BYTES = 5 * 1024 * 1024`
- Consumes: nothing from earlier tasks (callers validate the symbol with `parseSymbol`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/fmp.test.ts
import { describe, expect, it, vi } from 'vitest';
import { FmpError, fetchStatement, parseStatement } from './fmp';

const record = (year: number, extra: Record<string, unknown> = {}) => ({
	date: `${year}-12-31`,
	symbol: 'AAPL',
	reportedCurrency: 'USD',
	fiscalYear: String(year),
	period: 'FY',
	revenue: 1000 + year,
	costOfRevenue: 400,
	netIncome: null,
	eps: 1.25,
	...extra
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers });

describe('parseStatement', () => {
	it('keeps numeric fields as lines in first-seen order and drops metadata', () => {
		const s = parseStatement([record(2024), record(2023)]);
		expect(s.lines).toEqual(['revenue', 'costOfRevenue', 'netIncome', 'eps']);
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2024', '2023']);
		expect(s.years[0]).toMatchObject({ date: '2024-12-31', currency: 'USD' });
		expect(s.years[0].values.revenue).toBe(3024);
	});
	it('orders years newest first and keeps at most five', () => {
		const s = parseStatement([2019, 2024, 2020, 2023, 2021, 2022].map((y) => record(y)));
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2024', '2023', '2022', '2021', '2020']);
	});
	it('maps non-numeric values to null', () => {
		const s = parseStatement([record(2024, { revenue: 'n/a' })]);
		expect(s.years[0].values.revenue).toBeNull();
		expect(s.years[0].values.netIncome).toBeNull();
	});
	it('returns no years for an empty list', () => {
		expect(parseStatement([])).toEqual({ lines: [], years: [] });
	});
	it('maps FMP error bodies to FmpError kinds', () => {
		const kind = (message: string) => {
			try {
				parseStatement({ 'Error Message': message });
			} catch (error) {
				return (error as FmpError).kind;
			}
		};
		expect(kind('Invalid API KEY.')).toBe('config');
		expect(kind('Limit Reach. Please upgrade')).toBe('limit');
		expect(kind('Special Endpoint : This endpoint is not available under your current subscription')).toBe('plan');
	});
	it('rejects an unexpected shape', () => {
		expect(() => parseStatement('nope')).toThrow(FmpError);
		expect(() => parseStatement({ foo: 1 })).toThrow(FmpError);
	});
});

describe('fetchStatement', () => {
	it('requests the stable endpoint with the ticker, period and limit', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([record(2024)]));
		await fetchStatement('balance', 'ABN.AS', 'KEY123', fetchFn);
		const url = new URL(fetchFn.mock.calls[0][0] as string);
		expect(url.origin + url.pathname).toBe('https://financialmodelingprep.com/stable/balance-sheet-statement');
		expect(url.searchParams.get('symbol')).toBe('ABN.AS');
		expect(url.searchParams.get('period')).toBe('annual');
		expect(url.searchParams.get('limit')).toBe('5');
		expect(url.searchParams.get('apikey')).toBe('KEY123');
	});
	it('uses the three statement endpoints', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		for (const kind of ['income', 'balance', 'cashflow'] as const) await fetchStatement(kind, 'AAPL', 'K', fetchFn);
		const paths = fetchFn.mock.calls.map((c) => new URL(c[0] as string).pathname);
		expect(paths).toEqual([
			'/stable/income-statement',
			'/stable/balance-sheet-statement',
			'/stable/cash-flow-statement'
		]);
	});
	it('maps HTTP statuses to error kinds', async () => {
		const kindFor = async (status: number) => {
			const fetchFn = vi.fn().mockResolvedValue(json({}, status));
			try {
				await fetchStatement('income', 'AAPL', 'K', fetchFn);
			} catch (error) {
				return (error as FmpError).kind;
			}
		};
		expect(await kindFor(401)).toBe('config');
		expect(await kindFor(402)).toBe('plan');
		expect(await kindFor(403)).toBe('plan');
		expect(await kindFor(429)).toBe('limit');
		expect(await kindFor(500)).toBe('unavailable');
	});
	it('never leaks the key in an error message', async () => {
		const secret = 'SUPERSECRETKEY';
		const cases: Array<() => Promise<Response>> = [
			async () => json({ 'Error Message': `bad request https://x/y?apikey=${secret}&symbol=A` }, 400),
			async () => json({ 'Error Message': `Limit Reach for ${secret}` }),
			async () => {
				throw new Error(`connect failed for https://financialmodelingprep.com/stable/x?apikey=${secret}`);
			},
			async () => new Response('not json at all', { status: 200 })
		];
		for (const make of cases) {
			const fetchFn = vi.fn().mockImplementation(make);
			const error = await fetchStatement('income', 'AAPL', secret, fetchFn).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(FmpError);
			expect((error as Error).message).not.toContain(secret);
		}
	});
	it('rejects a response that is too large', async () => {
		const fetchFn = vi.fn().mockResolvedValue(json([], 200, { 'content-length': String(6 * 1024 * 1024) }));
		await expect(fetchStatement('income', 'AAPL', 'K', fetchFn)).rejects.toMatchObject({ kind: 'unavailable' });
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/fmp.test.ts`
Expected: FAIL (cannot find module `./fmp`).

- [ ] **Step 3: Implement**

```ts
// src/lib/server/fmp.ts
export type Kind = 'income' | 'balance' | 'cashflow';

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BYTES = 5 * 1024 * 1024;

const BASE = 'https://financialmodelingprep.com/stable';
const ENDPOINTS: Record<Kind, string> = {
	income: 'income-statement',
	balance: 'balance-sheet-statement',
	cashflow: 'cash-flow-statement'
};

/** Fields that describe the filing, not a figure in it. */
const META = new Set([
	'symbol', 'date', 'fiscalYear', 'calendarYear', 'period', 'reportedCurrency', 'cik',
	'filingDate', 'acceptedDate', 'link', 'finalLink'
]);

export class FmpError extends Error {
	constructor(
		readonly kind: 'config' | 'plan' | 'limit' | 'unavailable',
		message: string
	) {
		super(message);
	}
}

export interface StatementYear {
	fiscalYear: string;
	date: string;
	currency: string | null;
	values: Record<string, number | null>;
}

export interface Statement {
	/** Names of the figures, in the order FMP first returns them. */
	lines: string[];
	/** Newest first, at most five. */
	years: StatementYear[];
}

/** Remove anything that looks like the API key from text that may reach a log or a visitor. */
const clean = (text: string): string => text.replace(/apikey=[^&\s"']+/gi, 'apikey=***').slice(0, 200);

function fromMessage(message: string): FmpError {
	if (/invalid api key/i.test(message)) return new FmpError('config', 'FMP rejected the API key');
	if (/limit/i.test(message)) return new FmpError('limit', 'FMP rate limit reached');
	return new FmpError('plan', clean(message));
}

export function parseStatement(body: unknown): Statement {
	if (body && typeof body === 'object' && !Array.isArray(body)) {
		const message = (body as Record<string, unknown>)['Error Message'];
		if (typeof message === 'string') throw fromMessage(message);
	}
	if (!Array.isArray(body)) throw new FmpError('unavailable', 'Unexpected response from FMP');

	const lines: string[] = [];
	const years: StatementYear[] = [];
	for (const item of body) {
		if (!item || typeof item !== 'object') continue;
		const record = item as Record<string, unknown>;
		const date = typeof record.date === 'string' ? record.date : '';
		const values: Record<string, number | null> = {};
		for (const [key, value] of Object.entries(record)) {
			if (META.has(key)) continue;
			if (!lines.includes(key) && (typeof value === 'number' || value === null)) lines.push(key);
			values[key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
		}
		years.push({
			fiscalYear: String(record.fiscalYear ?? record.calendarYear ?? date.slice(0, 4)),
			date,
			currency: typeof record.reportedCurrency === 'string' ? record.reportedCurrency : null,
			values
		});
	}
	years.sort((a, b) => b.date.localeCompare(a.date));
	return { lines: lines.filter((key) => years.some((y) => key in y.values)), years: years.slice(0, 5) };
}

export async function fetchStatement(
	kind: Kind,
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	const query = new URLSearchParams({ symbol, period: 'annual', limit: '5', apikey: apiKey });
	let response: Response;
	try {
		response = await fetchFn(`${BASE}/${ENDPOINTS[kind]}?${query}`, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
	} catch {
		// the underlying error can contain the request URL, which holds the key
		throw new FmpError('unavailable', 'FMP could not be reached');
	}

	const declared = Number(response.headers.get('content-length'));
	if (declared > MAX_BYTES) throw new FmpError('unavailable', 'FMP response too large');
	const text = await response.text();
	if (text.length > MAX_BYTES) throw new FmpError('unavailable', 'FMP response too large');

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		body = undefined;
	}

	if (!response.ok) {
		if (body && typeof body === 'object' && 'Error Message' in body) return parseStatement(body);
		if (response.status === 401) throw new FmpError('config', 'FMP rejected the API key');
		if (response.status === 402 || response.status === 403) {
			throw new FmpError('plan', 'Not available on this FMP plan');
		}
		if (response.status === 429) throw new FmpError('limit', 'FMP rate limit reached');
		throw new FmpError('unavailable', `FMP returned ${response.status}`);
	}
	return parseStatement(body);
}
```

Note: `lines` keeps only keys that were numeric (or null) in at least one record, so string fields not in `META` (for example a free-text field) never become rows.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/server/fmp.test.ts`
Expected: PASS. If the first "keeps numeric fields" test fails on `lines`, check that `netIncome: null` is kept as a line (it is, because `value === null` qualifies).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/fmp.ts src/lib/server/fmp.test.ts
git commit -m "feat: FMP statements client and parser"
```

---

### Task 5: Statement tables

**Files:**
- Create: `src/lib/statements.ts`
- Test: `src/lib/statements.test.ts`

**Interfaces:**
- Consumes: `Statement`, `StatementYear` from `src/lib/server/fmp.ts` (types only, imported with `import type`)
- Produces:
  - `humanise(key: string): string` (`costOfRevenue` → `Cost of revenue`; `ebitda` → `EBITDA`)
  - `formatValue(key: string, value: number | null): string` (`null` → `n/a`; keys starting `eps` → two decimals; others in millions with one decimal)
  - `interface StatementTable { currency: string | null; columns: { year: string; date: string }[]; rows: { key: string; label: string; cells: string[] }[] }`
  - `buildTable(statement: Statement): StatementTable`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/statements.test.ts
import { describe, expect, it } from 'vitest';
import type { Statement } from './server/fmp';
import { buildTable, formatValue, humanise } from './statements';

describe('humanise', () => {
	it('turns camelCase into a sentence', () => {
		expect(humanise('costOfRevenue')).toBe('Cost of revenue');
		expect(humanise('netIncome')).toBe('Net income');
	});
	it('upper-cases known abbreviations', () => {
		expect(humanise('ebitda')).toBe('EBITDA');
		expect(humanise('epsDiluted')).toBe('EPS diluted');
	});
});

describe('formatValue', () => {
	it('shows money in millions with one decimal', () => {
		expect(formatValue('revenue', 1_234_500_000)).toBe('1,234.5');
		expect(formatValue('netIncome', -2_000_000)).toBe('-2.0');
	});
	it('shows per-share figures with two decimals, unscaled', () => {
		expect(formatValue('eps', 1.256)).toBe('1.26');
		expect(formatValue('epsDiluted', 0.5)).toBe('0.50');
	});
	it('shows n/a for missing values', () => {
		expect(formatValue('revenue', null)).toBe('n/a');
	});
});

describe('buildTable', () => {
	const statement: Statement = {
		lines: ['revenue', 'eps'],
		years: [
			{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { revenue: 2_000_000, eps: 1 } },
			{ fiscalYear: '2023', date: '2023-12-31', currency: 'USD', values: { revenue: null } }
		]
	};
	it('has one column per year and one row per line', () => {
		const t = buildTable(statement);
		expect(t.currency).toBe('USD');
		expect(t.columns).toEqual([
			{ year: '2024', date: '2024-12-31' },
			{ year: '2023', date: '2023-12-31' }
		]);
		expect(t.rows).toEqual([
			{ key: 'revenue', label: 'Revenue', cells: ['2.0', 'n/a'] },
			{ key: 'eps', label: 'EPS', cells: ['1.00', 'n/a'] }
		]);
	});
	it('is empty without years', () => {
		expect(buildTable({ lines: [], years: [] })).toEqual({ currency: null, columns: [], rows: [] });
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/statements.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement**

```ts
// src/lib/statements.ts
import type { Statement } from './server/fmp';

export interface StatementTable {
	currency: string | null;
	columns: { year: string; date: string }[];
	rows: { key: string; label: string; cells: string[] }[];
}

const ABBREVIATIONS = /\b(ebitda|ebit|eps|ppe|sga|rd)\b/gi;

export function humanise(key: string): string {
	const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
	const sentence = words.charAt(0).toUpperCase() + words.slice(1);
	return sentence.replace(ABBREVIATIONS, (m) => m.toUpperCase());
}

const millions = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatValue(key: string, value: number | null): string {
	if (value === null) return 'n/a';
	if (/^eps/i.test(key)) return value.toFixed(2);
	return millions.format(value / 1_000_000);
}

export function buildTable(statement: Statement): StatementTable {
	if (statement.years.length === 0) return { currency: null, columns: [], rows: [] };
	return {
		currency: statement.years[0].currency,
		columns: statement.years.map((y) => ({ year: y.fiscalYear, date: y.date })),
		rows: statement.lines.map((key) => ({
			key,
			label: humanise(key),
			cells: statement.years.map((y) => formatValue(key, y.values[key] ?? null))
		}))
	};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/statements.test.ts`
Expected: PASS. (`-2.0` for `-2_000_000`: `Intl` renders `-2.0`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/statements.ts src/lib/statements.test.ts
git commit -m "feat: statement tables with money formatting"
```

---

### Task 6: The gated loader

**Files:**
- Create: `src/lib/server/financials.ts`
- Test: `src/lib/server/financials.test.ts`

**Interfaces:**
- Consumes: `parseSymbol` (Task 1), `fetchStatement`, `FmpError`, `Kind`, `Statement` (Task 4), `buildTable`, `StatementTable` (Task 5), `createCache` from `src/lib/server/cache.ts` (existing: `createCache<T>({ ttlMs, now? })` with `get(key, load)`)
- Produces:
  - `type StatementFetcher = (kind: Kind, symbol: string, apiKey: string) => Promise<Statement>`
  - `type FinancialsView = { state: 'locked' } | { state: 'unconfigured' } | { state: 'idle' } | { state: 'invalid' } | { state: 'ready'; symbol: string; tables: { kind: Kind; title: string; table: StatementTable | null; message: string | null }[] }`
  - `loadFinancials(input: { authed: boolean; rawSymbol: string | null; apiKey: string | undefined; fetcher?: StatementFetcher }): Promise<FinancialsView>`
  - `cachedFetcher: StatementFetcher` (default; 24 h cache per `kind:SYMBOL`)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/financials.test.ts
import { describe, expect, it, vi } from 'vitest';
import { FmpError, type Statement } from './fmp';
import { loadFinancials, type StatementFetcher } from './financials';

const statement: Statement = {
	lines: ['revenue'],
	years: [{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { revenue: 5_000_000 } }]
};

const base = { authed: true, rawSymbol: 'aapl', apiKey: 'KEY' };

describe('loadFinancials', () => {
	it('does not call FMP without a session', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, authed: false, fetcher })).toEqual({ state: 'locked' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('does not call FMP without an API key', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, apiKey: undefined, fetcher })).toEqual({ state: 'unconfigured' });
		expect(await loadFinancials({ ...base, apiKey: '', fetcher })).toEqual({ state: 'unconfigured' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('is idle without a ticker and invalid for a bad one, without calling FMP', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		expect(await loadFinancials({ ...base, rawSymbol: null, fetcher })).toEqual({ state: 'idle' });
		expect(await loadFinancials({ ...base, rawSymbol: '', fetcher })).toEqual({ state: 'idle' });
		expect(await loadFinancials({ ...base, rawSymbol: 'A&B', fetcher })).toEqual({ state: 'invalid' });
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('loads the three statements for the normalised ticker', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		const view = await loadFinancials({ ...base, fetcher });
		expect(view.state).toBe('ready');
		if (view.state !== 'ready') return;
		expect(view.symbol).toBe('AAPL');
		expect(view.tables.map((t) => [t.kind, t.title])).toEqual([
			['income', 'Income statement'],
			['balance', 'Balance sheet'],
			['cashflow', 'Cash flow statement']
		]);
		expect(view.tables.every((t) => t.table && t.message === null)).toBe(true);
		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(fetcher).toHaveBeenCalledWith('income', 'AAPL', 'KEY');
	});
	it('still shows the other statements when one fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher: StatementFetcher = async (kind) => {
			if (kind === 'balance') throw new FmpError('limit', 'FMP rate limit reached');
			return statement;
		};
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		const balance = view.tables.find((t) => t.kind === 'balance')!;
		expect(balance.table).toBeNull();
		expect(balance.message).toMatch(/rate limit/i);
		expect(view.tables.filter((t) => t.table)).toHaveLength(2);
	});
	it('says so when there are no annual statements', async () => {
		const fetcher: StatementFetcher = async () => ({ lines: [], years: [] });
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.tables.every((t) => t.table === null && /no annual statements/i.test(t.message ?? ''))).toBe(true);
	});
	it('logs failures without the key and without a URL', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new FmpError('config', 'FMP rejected the API key');
		};
		await loadFinancials({ ...base, apiKey: 'TOPSECRET', fetcher });
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).toContain('AAPL');
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('apikey');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/financials.test.ts`
Expected: FAIL (cannot find module `./financials`).

- [ ] **Step 3: Implement**

```ts
// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable, type StatementTable } from '../statements';
import { createCache } from './cache';
import { FmpError, fetchStatement, type Kind, type Statement } from './fmp';

export type StatementFetcher = (kind: Kind, symbol: string, apiKey: string) => Promise<Statement>;

export type FinancialsView =
	| { state: 'locked' }
	| { state: 'unconfigured' }
	| { state: 'idle' }
	| { state: 'invalid' }
	| {
			state: 'ready';
			symbol: string;
			tables: { kind: Kind; title: string; table: StatementTable | null; message: string | null }[];
	  };

const KINDS: { kind: Kind; title: string }[] = [
	{ kind: 'income', title: 'Income statement' },
	{ kind: 'balance', title: 'Balance sheet' },
	{ kind: 'cashflow', title: 'Cash flow statement' }
];

const cache = createCache<Statement>({ ttlMs: 24 * 60 * 60 * 1000 });

/** One cache entry per statement, so a failure of one is never stored as a result. */
export const cachedFetcher: StatementFetcher = (kind, symbol, apiKey) =>
	cache.get(`${kind}:${symbol}`, () => fetchStatement(kind, symbol, apiKey));

function messageFor(error: unknown, symbol: string): string {
	if (error instanceof FmpError) {
		switch (error.kind) {
			case 'config':
				return 'The FMP key was not accepted. Check FMP_API_KEY.';
			case 'plan':
				return `FMP does not provide this for ${symbol} on your plan (${error.message}).`;
			case 'limit':
				return 'FMP rate limit reached. Try again in a minute.';
		}
	}
	return 'FMP is unavailable right now. Try again shortly.';
}

export async function loadFinancials(input: {
	authed: boolean;
	rawSymbol: string | null;
	apiKey: string | undefined;
	fetcher?: StatementFetcher;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	if (!input.apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	const symbol = parseSymbol(input.rawSymbol);
	if (!symbol) return { state: 'invalid' };

	const fetcher = input.fetcher ?? cachedFetcher;
	const apiKey = input.apiKey;
	const tables = await Promise.all(
		KINDS.map(async ({ kind, title }) => {
			try {
				const table = buildTable(await fetcher(kind, symbol, apiKey));
				if (table.columns.length === 0) {
					return { kind, title, table: null, message: `No annual statements found for ${symbol}.` };
				}
				return { kind, title, table, message: null };
			} catch (error) {
				const detail = error instanceof FmpError ? error.kind : 'error';
				console.error(`FMP ${kind} statement for ${symbol} failed (${detail})`);
				return { kind, title, table: null, message: messageFor(error, symbol) };
			}
		})
	);
	return { state: 'ready', symbol, tables };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/server/financials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/financials.ts src/lib/server/financials.test.ts
git commit -m "feat: gated loader for the three statements"
```

---

### Task 7: Hook, route and page

**Files:**
- Create: `src/app.d.ts`, `src/routes/financials/+page.server.ts`, `src/routes/financials/+page.svelte`
- Modify: `src/hooks.server.ts`, `src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `SESSION_MS`, `createSession`, `passwordMatches`, `verifySession` (Task 2); `createRateLimiter` (Task 3); `loadFinancials`, `FinancialsView` (Task 6)
- Produces: the `/financials` route; `App.Locals.authed: boolean`

This task is wiring and is verified by the type-check, the build and a dev-server smoke test, not by unit tests (everything it calls is already tested).

- [ ] **Step 1: Declare the locals type**

```ts
// src/app.d.ts
declare global {
	namespace App {
		interface Locals {
			/** true when the request carries a valid /financials session cookie */
			authed: boolean;
		}
	}
}

export {};
```

- [ ] **Step 2: Update the hook**

Replace `src/hooks.server.ts` with:

```ts
import { env } from '$env/dynamic/private';
import { SESSION_COOKIE, verifySession } from '#lib/server/auth';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	// Fails closed: with no SESSION_SECRET configured, verifySession is always false.
	event.locals.authed = verifySession(event.cookies.get(SESSION_COOKIE), env.SESSION_SECRET ?? '');

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (event.url.pathname.startsWith('/financials')) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};
```

- [ ] **Step 3: Write the route**

```ts
// src/routes/financials/+page.server.ts
import { env } from '$env/dynamic/private';
import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, SESSION_MS, createSession, passwordMatches } from '#lib/server/auth';
import { loadFinancials } from '#lib/server/financials';
import { createRateLimiter } from '#lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const COOKIE_PATH = '/financials';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	return {
		configured: Boolean(env.SITE_PASSWORD && env.SESSION_SECRET),
		view: await loadFinancials({
			authed: locals.authed,
			rawSymbol: url.searchParams.get('symbol'),
			apiKey: env.FMP_API_KEY
		})
	};
};

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress }) => {
		const password = env.SITE_PASSWORD ?? '';
		const secret = env.SESSION_SECRET ?? '';
		if (!password || !secret) {
			console.error('financials login attempted but SITE_PASSWORD or SESSION_SECRET is not set');
			return fail(503, { message: 'This page is not configured.' });
		}

		const ip = getClientAddress();
		if (limiter.isLimited(ip)) return fail(429, { message: 'Too many attempts. Try again later.' });

		const submitted = String((await request.formData()).get('password') ?? '');
		if (!passwordMatches(submitted, password)) {
			limiter.recordFailure(ip);
			return fail(401, { message: 'Wrong password.' });
		}

		limiter.reset(ip);
		cookies.set(SESSION_COOKIE, createSession(secret), {
			path: COOKIE_PATH,
			httpOnly: true,
			sameSite: 'lax',
			maxAge: Math.floor(SESSION_MS / 1000)
		});
		redirect(303, '/financials');
	},

	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE, { path: COOKIE_PATH });
		redirect(303, '/financials');
	}
};
```

SvelteKit sets `Secure` automatically except on plain `http://localhost`; do not set it by hand. If `svelte-check` reports that `redirect` does not return `never` in this SvelteKit version, write `throw redirect(303, '/financials')`.

- [ ] **Step 4: Write the page**

```svelte
<!-- src/routes/financials/+page.svelte -->
<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const view = $derived(data.view);
</script>

<svelte:head>
	<title>Financial statements</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>Financial statements</h1>

	{#if view.state === 'locked'}
		<p>This page is password protected.</p>
		{#if !data.configured}
			<p class="error" role="alert">This page is not configured on this deployment.</p>
		{:else}
			<form method="POST" action="?/login">
				<label for="password">Password</label>
				<input id="password" name="password" type="password" autocomplete="current-password" required />
				<button type="submit">Log in</button>
			</form>
		{/if}
		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
	{:else}
		<div class="bar">
			<form method="GET">
				<label for="symbol">Ticker</label>
				<input id="symbol" name="symbol" placeholder="AAPL or ABN.AS" maxlength="15" autocomplete="off" />
				<button type="submit">Show</button>
			</form>
			<form method="POST" action="?/logout"><button type="submit">Log out</button></form>
		</div>

		{#if view.state === 'unconfigured'}
			<p class="error" role="alert">The FMP key is not configured on this deployment.</p>
		{:else if view.state === 'invalid'}
			<p class="error" role="alert">That is not a valid ticker. Use letters, digits, dots and dashes, for example BRK-B.</p>
		{:else if view.state === 'idle'}
			<p>Enter an FMP ticker to see five years of annual statements.</p>
		{:else if view.state === 'ready'}
			<h2 class="symbol">{view.symbol}</h2>
			{#each view.tables as t (t.kind)}
				<section>
					<h2>{t.title}{#if t.table?.currency} <small>(millions of {t.table.currency}; per-share figures as reported)</small>{/if}</h2>
					{#if t.table}
						<table>
							<thead>
								<tr>
									<th scope="col">Line item</th>
									{#each t.table.columns as c (c.date)}
										<th scope="col" class="num">{c.year}<br /><small>{c.date}</small></th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each t.table.rows as row (row.key)}
									<tr>
										<th scope="row">{row.label}</th>
										{#each row.cells as cell, i (i)}<td class="num">{cell}</td>{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<p>{t.message}</p>
					{/if}
				</section>
			{/each}
		{/if}
	{/if}
</main>

<style>
	main { max-width: 64rem; margin: 0 auto; padding: 0 1rem 3rem; }
	.bar { display: flex; gap: 1rem; justify-content: space-between; flex-wrap: wrap; align-items: center; }
	form { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin: 1rem 0; }
	input { padding: 0.4rem 0.5rem; }
	table { border-collapse: collapse; width: 100%; }
	th, td { padding: 0.3rem 0.6rem; border-bottom: 1px solid #ddd; text-align: left; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	thead th { white-space: nowrap; }
	small { font-weight: 400; color: #555; }
	.error { color: #b00020; }
	.symbol { margin-bottom: 0; }
</style>
```

- [ ] **Step 5: Add the navigation link**

In `src/routes/+layout.svelte`, add `{ href: '/financials', label: 'financials' }` to `links` after the `companies` entry.

- [ ] **Step 6: Type-check, test and build**

Run: `npm run check` — expect 0 errors.
Run: `npm test` — expect all tests pass.
Run: `npm run build` — expect success.

- [ ] **Step 7: Smoke-test the gate locally**

Create `.env` (not committed; Task 8 adds it to `.gitignore`) with `SITE_PASSWORD=test-pass`, `SESSION_SECRET=local-dev-secret-0123456789`, `FMP_API_KEY=` left empty.
Run `npx -y node@24 node_modules/.bin/vite dev --port 5199` in the background, then:

```bash
curl -s -i localhost:5199/financials | grep -i -E "^HTTP|cache-control|password protected"
curl -s -i -c /tmp/fin.jar -d "password=wrong" "localhost:5199/financials?/login" | head -1
curl -s -i -c /tmp/fin.jar -H "Origin: http://localhost:5199" -d "password=test-pass" "localhost:5199/financials?/login" | grep -i -E "^HTTP|set-cookie"
curl -s -b /tmp/fin.jar "localhost:5199/financials?symbol=AAPL" | grep -o "not configured\|Enter an FMP ticker\|FMP key"
```

Expected: first call shows `private, no-store` and "password protected"; the wrong password does not set a cookie; the correct one returns a 303 with a `fin_session` cookie (`HttpOnly`, `Path=/financials`); the last call, with FMP key empty, shows the "FMP key is not configured" message and no statement tables. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/app.d.ts src/hooks.server.ts src/routes/financials src/routes/+layout.svelte
git commit -m "feat: password-protected financials page"
```

---

### Task 8: Documentation, ignore rules, spec amendments

**Files:**
- Modify: `.gitignore`, `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-25-financials-page-design.md`

- [ ] **Step 1: Ignore local env files**

Append to `.gitignore`:

```
.env
.env.*
!.env.example
```

Create `.env.example`:

```
# Copy to .env for local development. Never commit real values.
SITE_PASSWORD=
SESSION_SECRET=
FMP_API_KEY=
```

Run `git status` and confirm `.env` is not listed.

- [ ] **Step 2: Document the page in `README.md`**

Add a section "Financial statements (`/financials`)" covering: what it shows; that it needs `FMP_API_KEY`, `SITE_PASSWORD`, `SESSION_SECRET` as environment variables (Vercel: linked to the project for Production and Preview; locally in `.env`); how to generate the secret (`openssl rand -base64 32`); that logging out and changing `SESSION_SECRET` log everyone out; that the page is never cached publicly; and the limits (shared password, FMP plan coverage, FMP terms on sharing data).

- [ ] **Step 3: Add conventions to `CLAUDE.md`**

Add two bullets: "`/financials` is password protected. Never cache it publicly, never log or return the FMP URL or key, and keep `$env` reads in `hooks.server.ts` and `src/routes/financials/`." and "Secrets are Vercel environment variables (`FMP_API_KEY`, `SITE_PASSWORD`, `SESSION_SECRET`); never commit them."

- [ ] **Step 4: Amend the spec**

In the spec's "Access gate" section replace point 1 with: "A visitor without a valid cookie who requests anything under `/financials` gets the login form (HTTP 200, `no-store`; SvelteKit's `load` cannot return another status) and no data. No FMP call is made." In the architecture table change the `hooks.server.ts` row to "Existing security headers; sets `locals.authed` from the session cookie; `no-store` for `/financials`. The page's `load` enforces the gate." Under Testing replace the last bullet with "`loadFinancials`: without a session or key, or with a bad ticker, the FMP fetcher is never called."

- [ ] **Step 5: Verify and commit**

Run: `npm run check && npm test && npm run check:ts-only` — all pass.

```bash
git add .gitignore .env.example README.md CLAUDE.md docs/superpowers/specs/2026-10-25-financials-page-design.md
git commit -m "docs: financials page, env files ignored, spec amendments"
```

---

### Task 9: Pull request and preview verification

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin feat/financials-page
gh pr create --title "Password-protected financial statements page" --body "<summary of the page, the three env variables, and the manual checks below>"
```

Wait for CI (`test`) and the Vercel preview to pass.

- [ ] **Step 2: Manual checks on the preview (the owner does these; the variables must be linked to the project for Preview)**

1. `curl -s "<preview-url>/financials?symbol=AAPL" | grep -c -i revenue` prints `0` (no data without a login).
2. `curl -sI "<preview-url>/financials" | grep -i cache-control` shows `private, no-store`.
3. In a browser: a wrong password shows "Wrong password."; six wrong attempts in 15 minutes show the "Too many attempts" message.
4. Log in, enter `AAPL`: three tables with five years each appear, money in millions. Compare a few figures with another source.
5. Enter a non-US ticker such as `ABN.AS`: either tables appear or a clear "does not provide this on your plan" message.
6. Enter `NOTATICKER`: "No annual statements found" per table. Enter `A B`: the invalid-ticker message.
7. Log out; the login form returns. The Vercel function logs contain no `apikey=` text.
8. If any row labels or numbers look wrong (field names differ from the fixtures), report the statement and line so the parser or formatter can be adjusted.

- [ ] **Step 3: Report**

Tell the owner the results of the automated checks and ask for approval before merging.
