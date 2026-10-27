# Public static site, interactive after login: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anonymous visitors get a cached, static version of Home, Classification, Companies and About; after logging in with the existing shared password the site is fully interactive.

**Architecture:** `adapter-vercel` ISR per route (`expiration: 86400`, `allowQuery: []`, `bypassToken` from `ISR_BYPASS_TOKEN`). A request is *interactive* only with a valid session cookie and, when the cache is on, the `__prerender_bypass` cookie equal to the token. Anonymous code paths never read the query string. Without a usable token ISR is off and `interactive` equals `authed`.

**Tech Stack:** SvelteKit 3.1 / Svelte 5, `@sveltejs/adapter-vercel` 7.0.1, Vitest, TypeScript only.

**Spec:** `docs/superpowers/specs/2026-10-27-static-public-site-design.md` (binding).

## Global Constraints

- TypeScript only (`npm run check:ts-only`); Svelte components allowed.
- Internal imports use the `#lib/...` alias; env vars are declared in `src/env.ts` and read via `$app/env/private`.
- ISR: `expiration: 86400`, `allowQuery: []`, bypass cookie name exactly `__prerender_bypass`; token shorter than 32 characters or absent means ISR off (`isr: false`).
- Interactive rule: `authed && (token absent || bypassCookie === token)`. Anonymous loaders must not read `url.searchParams`.
- Companies preview for anonymous visitors: exactly 20 rows, no filters, no paging, no Financials buttons.
- `/financials` stays `private, no-store`, locked first, unchanged behaviour.
- Interactive responses get `Cache-Control: private, no-store`.
- Session cookie path becomes `/`; login and logout also delete the old `/financials`-path cookie.
- The `from` query value is an allow-list: `/`, `/classification`, `/companies`, `/about`, `/financials` (never an open redirect).
- Tests: Vitest, no network. Coverage floor stays (statements 95, branches 85, functions 95, lines 95); `svelte-check` 0 errors; `vite build` OK.
- Commit trailer exactly: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Commands: `npx -y node@24 node_modules/vitest/vitest.mjs run <file>`, `npx -y node@24 node_modules/.bin/svelte-kit sync`, `npx -y node@24 node_modules/.bin/svelte-check --tsconfig ./tsconfig.json`, `npx -y node@24 node_modules/.bin/vite build`, `npx -y node@24 scripts/check-no-js.ts`. Use Python for scripted edits (macOS BSD sed).

## File Structure

- Create `src/lib/return-path.ts` (+ test): the `from` allow-list.
- Create `src/lib/server/access.ts` (+ test): token, ISR config, interactive rule, cookie options, `pageParams`.
- Modify `src/lib/financials-nav.ts` (+ test): `loginAction`/`afterLogin` carry `from`.
- Modify `src/lib/companies.ts` (+ test): `PREVIEW_ROWS`, `previewOf`.
- Create `src/lib/components/LoginPrompt.svelte`.
- Modify `src/env.ts`, `src/app.d.ts`, `src/hooks.server.ts`, `src/routes/financials/+page.server.ts`, `src/routes/financials/+page.svelte`.
- Create `src/routes/+layout.server.ts`; modify `src/routes/+layout.svelte`.
- Modify loaders `src/routes/+page.server.ts`, `classification/+page.server.ts`, `companies/+page.server.ts`; create `about/+page.server.ts`.
- Modify pages `src/routes/+page.svelte`, `classification/+page.svelte`, `companies/+page.svelte`.
- Create `static/robots.txt`; modify `.env.example`, `README.md`, `CLAUDE.md`, the spec status line.

---

### Task 1: Pure helpers (return path, access rules, preview)

**Files:**
- Create: `src/lib/return-path.ts`, `src/lib/return-path.test.ts`, `src/lib/server/access.ts`, `src/lib/server/access.test.ts`
- Modify: `src/lib/financials-nav.ts`, `src/lib/financials-nav.test.ts`, `src/lib/companies.ts`, `src/lib/companies.test.ts`

**Interfaces:**
- Produces: `RETURN_PATHS`, `ReturnPath`, `returnPath(raw): ReturnPath | null`; `loginAction(nav, symbol, from?: ReturnPath | null)`; `afterLogin(params)`; from `access.ts`: `BYPASS_COOKIE`, `ISR_EXPIRATION_SECONDS`, `MIN_BYPASS_TOKEN_LENGTH`, `bypassToken(raw)`, `isrConfig(raw)`, `isInteractive(authed, bypassCookie, rawToken)`, `pageParams(interactive, url)`, `sessionCookieOptions()`, `LEGACY_COOKIE_PATH`; from `companies.ts`: `PREVIEW_ROWS = 20`, `previewOf(page)`.

- [ ] **Step 1: Write the failing tests**

`src/lib/return-path.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RETURN_PATHS, returnPath } from './return-path';

describe('returnPath', () => {
	it('accepts exactly the allow-listed local pages', () => {
		for (const p of RETURN_PATHS) expect(returnPath(p)).toBe(p);
	});
	it('rejects everything else', () => {
		for (const bad of ['//evil.com', 'https://evil.com', '/financials/x', '/companies?x=1', '', 'companies', null, undefined]) {
			expect(returnPath(bad)).toBeNull();
		}
	});
});
```

Append to `src/lib/financials-nav.test.ts` (inside the existing `describe('login round trip', ...)`, before its closing):

```ts
	it('carries the page to come back to on the login action', () => {
		expect(loginAction(nav, '', '/companies')).toBe('?/login&from=%2Fcompanies');
		expect(loginAction(nav, 'AAPL', '/about')).toBe('?/login&symbol=AAPL&tab=price&statement=balance&period=ttm&from=%2Fabout');
		expect(loginAction(nav, '', null)).toBe('?/login');
	});
	it('goes back to an allowed page without a ticker, never to an unlisted one', () => {
		expect(afterLogin(q('from=%2Fcompanies'))).toBe('/companies');
		expect(afterLogin(q('from=//evil.com'))).toBe('/financials');
		expect(afterLogin(q('from=https://evil.com'))).toBe('/financials');
		// the ticker still wins when both are present
		expect(afterLogin(q('symbol=aapl&from=%2Fcompanies'))).toBe('/financials?symbol=AAPL&tab=financials&statement=income&period=annual');
	});
```

`src/lib/server/access.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	BYPASS_COOKIE,
	ISR_EXPIRATION_SECONDS,
	LEGACY_COOKIE_PATH,
	bypassToken,
	isInteractive,
	isrConfig,
	pageParams,
	sessionCookieOptions
} from './access';

const TOKEN = 'a'.repeat(32);

describe('bypassToken', () => {
	it('needs at least 32 characters', () => {
		expect(bypassToken(TOKEN)).toBe(TOKEN);
		expect(bypassToken('a'.repeat(31))).toBeUndefined();
		expect(bypassToken('')).toBeUndefined();
		expect(bypassToken(undefined)).toBeUndefined();
	});
});

describe('isrConfig', () => {
	it('turns ISR on for a usable token, one day, ignoring query strings', () => {
		expect(isrConfig(TOKEN)).toEqual({ isr: { expiration: ISR_EXPIRATION_SECONDS, bypassToken: TOKEN, allowQuery: [] } });
		expect(ISR_EXPIRATION_SECONDS).toBe(86400);
	});
	it('turns ISR off without a usable token', () => {
		expect(isrConfig(undefined)).toEqual({ isr: false });
		expect(isrConfig('short')).toEqual({ isr: false });
	});
});

describe('isInteractive', () => {
	it('is never true without a session', () => {
		expect(isInteractive(false, TOKEN, TOKEN)).toBe(false);
		expect(isInteractive(false, undefined, undefined)).toBe(false);
	});
	it('needs the matching bypass cookie when the cache is on', () => {
		expect(isInteractive(true, TOKEN, TOKEN)).toBe(true);
		expect(isInteractive(true, undefined, TOKEN)).toBe(false);
		expect(isInteractive(true, 'b'.repeat(32), TOKEN)).toBe(false);
		expect(isInteractive(true, TOKEN.slice(1), TOKEN)).toBe(false);
	});
	it('follows the session alone when the cache is off', () => {
		expect(isInteractive(true, undefined, undefined)).toBe(true);
		expect(isInteractive(true, undefined, 'short')).toBe(true);
	});
});

describe('pageParams', () => {
	const url = new URL('https://x.test/companies?country=Japan&page=3');
	it('hands the real query to interactive requests', () => {
		expect(pageParams(true, url).get('country')).toBe('Japan');
	});
	it('hands an empty query to anonymous requests', () => {
		expect([...pageParams(false, url)]).toEqual([]);
	});
});

describe('cookie constants', () => {
	it('uses the name Vercel looks for, and a site-wide session cookie', () => {
		expect(BYPASS_COOKIE).toBe('__prerender_bypass');
		expect(LEGACY_COOKIE_PATH).toBe('/financials');
		expect(sessionCookieOptions()).toEqual({ path: '/', httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 });
	});
});
```

Append to `src/lib/companies.test.ts` (add `PREVIEW_ROWS, previewOf` to the import from './companies'):

```ts
describe('previewOf', () => {
	it('keeps the first 20 rows as a single page and the total', () => {
		const many: CompanyData = {
			...data,
			companies: Array.from({ length: PAGE_SIZE + 5 }, (_, i) => [`Co ${String(i).padStart(3, '0')}`, '', '', 0, 0, 0, 0, 0])
		};
		const full = queryCompanies(many, {});
		const preview = previewOf(full);
		expect(PREVIEW_ROWS).toBe(20);
		expect(preview.rows).toHaveLength(20);
		expect(preview.rows[0].name).toBe('Co 000');
		expect(preview.total).toBe(PAGE_SIZE + 5);
		expect([preview.page, preview.pages]).toEqual([1, 1]);
	});
});
```

- [ ] **Step 2: Run to verify they fail** — `npx -y node@24 node_modules/vitest/vitest.mjs run src/lib/return-path.test.ts src/lib/server/access.test.ts src/lib/financials-nav.test.ts src/lib/companies.test.ts`. Expected: FAIL (modules / exports missing).

- [ ] **Step 3: Implement**

`src/lib/return-path.ts`:

```ts
/** Local pages the login may send the visitor back to. An allow-list, so `from` can never become an open redirect. */
export const RETURN_PATHS = ['/', '/classification', '/companies', '/about', '/financials'] as const;
export type ReturnPath = (typeof RETURN_PATHS)[number];

export function returnPath(raw: string | null | undefined): ReturnPath | null {
	return RETURN_PATHS.find((path) => path === raw) ?? null;
}
```

In `src/lib/financials-nav.ts` add `import { returnPath, type ReturnPath } from './return-path';` and replace `loginAction` and `afterLogin`:

```ts
/** Form action for the login form that keeps the page state in the URL (`?/login&symbol=...&from=...`). */
export function loginAction(nav: Nav, symbol: string, from: ReturnPath | null = null): string {
	const tail = symbol ? navHref(nav, symbol).split('?')[1] : '';
	const parts = [tail, from ? `from=${encodeURIComponent(from)}` : ''].filter(Boolean);
	return parts.length ? `?/login&${parts.join('&')}` : '?/login';
}

/** Where to go after logging in: the ticker that was asked for, else the page the visitor came from, else the plain page. Always local. */
export function afterLogin(params: URLSearchParams): string {
	const symbol = parseSymbol(params.get('symbol'));
	if (symbol) return navHref(parseNav(params), symbol);
	return returnPath(params.get('from')) ?? '/financials';
}
```

`src/lib/server/access.ts`:

```ts
import { createHash, timingSafeEqual } from 'node:crypto';
import { SESSION_MS } from './auth';

/** The cookie name Vercel checks to skip the ISR cache for one browser. */
export const BYPASS_COOKIE = '__prerender_bypass';
export const ISR_EXPIRATION_SECONDS = 86400;
export const MIN_BYPASS_TOKEN_LENGTH = 32;
/** The session cookie used to be scoped to /financials; login and logout also clear that one. */
export const LEGACY_COOKIE_PATH = '/financials';

/** The token, or undefined when it is missing or too short to be safe (then the cache is off). */
export function bypassToken(raw: string | undefined): string | undefined {
	return raw && raw.length >= MIN_BYPASS_TOKEN_LENGTH ? raw : undefined;
}

/** Route `config` fragment: ISR for the public pages when a usable token exists, else no ISR. */
export function isrConfig(raw: string | undefined) {
	const token = bypassToken(raw);
	return token
		? { isr: { expiration: ISR_EXPIRATION_SECONDS, bypassToken: token, allowQuery: [] as string[] } }
		: { isr: false as const };
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Interactive = a valid session and, when the cache is on, the bypass cookie equal to the token. A request that
 * can fill the ISR cache has no bypass cookie, so what gets cached is always the anonymous view.
 */
export function isInteractive(authed: boolean, bypassCookie: string | undefined, rawToken: string | undefined): boolean {
	if (!authed) return false;
	const token = bypassToken(rawToken);
	if (!token) return true;
	return bypassCookie !== undefined && timingSafeEqual(digest(bypassCookie), digest(token));
}

/** Anonymous requests never read the real query string, so a bot's first request cannot change what is cached. */
export function pageParams(interactive: boolean, url: URL): URLSearchParams {
	return interactive ? url.searchParams : new URLSearchParams();
}

/** Options for the session and bypass cookies: site-wide, HTTP-only, as long as the session. */
export function sessionCookieOptions() {
	return { path: '/', httpOnly: true, sameSite: 'lax' as const, maxAge: Math.floor(SESSION_MS / 1000) };
}
```

In `src/lib/companies.ts` after `PAGE_SIZE` add:

```ts
/** What anonymous visitors see of the list: the first rows of the unfiltered list, as one page. */
export const PREVIEW_ROWS = 20;

export function previewOf(result: CompanyPage): CompanyPage {
	return { ...result, rows: result.rows.slice(0, PREVIEW_ROWS), page: 1, pages: 1 };
}
```

- [ ] **Step 4: Run to verify they pass** — same command as Step 2. Expected: PASS. Then `npx -y node@24 node_modules/.bin/svelte-check --tsconfig ./tsconfig.json` shows 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "feat: access rules, return path allow-list and company preview helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the auth: env, hooks, login and logout, layout data

**Files:**
- Modify: `src/env.ts`, `src/app.d.ts`, `src/hooks.server.ts`, `src/routes/financials/+page.server.ts`, `src/routes/financials/+page.svelte`, `.env.example`
- Create: `src/routes/+layout.server.ts`, `src/lib/components/LoginPrompt.svelte`
- Modify: `src/routes/+layout.svelte`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `locals.interactive: boolean`; layout data `{ interactive: boolean }` on every page; `<LoginPrompt from="/path">…</LoginPrompt>`.

- [ ] **Step 1: Implement** (no unit test: these files need `$app` modules; Task 1 holds the logic and is tested; verification is svelte-check, build and the smoke test in Step 3)

`src/env.ts`, add inside `defineEnvVars({ ... })`:

```ts
	ISR_BYPASS_TOKEN: { schema: optional, description: 'Random string (32+ characters) that lets a logged-in browser skip the ISR cache; unset turns the cache off' }
```

`src/app.d.ts`, add to `Locals`:

```ts
			/** true when the request may see the interactive site: a valid session and, with the cache on, the bypass cookie */
			interactive: boolean;
```

`src/hooks.server.ts` (full file):

```ts
import { ISR_BYPASS_TOKEN, SESSION_SECRET } from '$app/env/private';
import { SESSION_COOKIE, verifySession } from '#lib/server/auth';
import { BYPASS_COOKIE, isInteractive } from '#lib/server/access';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	// Fails closed: with no SESSION_SECRET configured, verifySession is always false.
	event.locals.authed = verifySession(event.cookies.get(SESSION_COOKIE), SESSION_SECRET ?? '');
	event.locals.interactive = isInteractive(event.locals.authed, event.cookies.get(BYPASS_COOKIE), ISR_BYPASS_TOKEN);

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	// Interactive pages are per person; /financials is always dynamic.
	if (event.locals.interactive || event.url.pathname.startsWith('/financials')) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};
```

`src/routes/financials/+page.server.ts`: change imports to add `ISR_BYPASS_TOKEN` (from `$app/env/private`), `returnPath` (from `#lib/return-path`) and `BYPASS_COOKIE, LEGACY_COOKIE_PATH, bypassToken, sessionCookieOptions` (from `#lib/server/access`); remove the `COOKIE_PATH` constant and the now-unused `SESSION_MS` import. In `load`, add `from: returnPath(url.searchParams.get('from')),` to the returned object. Replace the `cookies.set(...)` call in `login` with:

```ts
		cookies.set(SESSION_COOKIE, createSession(secret), sessionCookieOptions());
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		const token = bypassToken(ISR_BYPASS_TOKEN);
		if (token) cookies.set(BYPASS_COOKIE, token, sessionCookieOptions());
```

and replace the `logout` action with:

```ts
	logout: async ({ cookies, url }) => {
		cookies.delete(SESSION_COOKIE, { path: '/' });
		cookies.delete(SESSION_COOKIE, { path: LEGACY_COOKIE_PATH });
		cookies.delete(BYPASS_COOKIE, { path: '/' });
		redirect(303, returnPath(url.searchParams.get('from')) ?? '/financials');
	}
```

`src/routes/financials/+page.svelte`: change the login form to `action={loginAction(nav, data.symbol, data.from)}`.

`src/routes/+layout.server.ts`:

```ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({ interactive: locals.interactive });
```

`src/lib/components/LoginPrompt.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { from, children }: { from: string; children: Snippet } = $props();
</script>

<p class="login-prompt" role="note"><a href={`/financials?from=${encodeURIComponent(from)}`}>Log in</a> {@render children()}</p>

<style>
	.login-prompt { margin: var(--space-4) 0; padding: var(--space-3) var(--space-4); color: var(--text-secondary); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
</style>
```

`src/routes/+layout.svelte`: change the props line to `let { children, data }: { children: Snippet; data: { interactive: boolean } } = $props();`, and inside `<nav>` after the `{#each}` add:

```svelte
	<span class="spacer"></span>
	{#if data.interactive}
		<form method="POST" action={`/financials?/logout&from=${encodeURIComponent(page.url.pathname)}`}>
			<button type="submit" class="link">Log out</button>
		</form>
	{:else if page.url.pathname !== '/financials'}
		<a href={`/financials?from=${encodeURIComponent(page.url.pathname)}`}>Log in</a>
	{/if}
```

and add to the `<style>`:

```css
	.spacer { margin-left: auto; }
	nav form { display: flex; align-items: center; }
	button.link { padding: 0 var(--space-3); font: inherit; color: var(--text-primary); background: none; border: 0; cursor: pointer; }
	button.link:hover { color: var(--color-primary); }
```

`.env.example`: append `ISR_BYPASS_TOKEN=` (and a comment line above it: `# 32+ random characters, e.g. openssl rand -hex 32; unset turns the page cache off`).

- [ ] **Step 2: Verify** — `svelte-kit sync`, then `svelte-check` (0 errors), `vitest run` (all pass), `vite build` (OK), `scripts/check-no-js.ts` (pass).

- [ ] **Step 3: Smoke test on a production build** (`SITE_PASSWORD=pw SESSION_SECRET=0123456789abcdef0123456789abcdef` set, with and without `ISR_BYPASS_TOKEN=$(printf 'b%.0s' {1..40})`, `vite preview --port 4390`; use `curl -c/-b` with `Accept: text/html`): a GET of `/financials` shows the login form; a POST to `/financials?/login&from=%2Fcompanies` with `password=pw` answers 303 to `/companies` and sets `fin_session` with `Path=/` (and `__prerender_bypass` when a token is set); a following GET `/companies` with the cookies has the nav button "Log out"; without cookies it has the "Log in" link; a POST to `/financials?/logout&from=%2Fabout` answers 303 to `/about`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: site-wide session, bypass cookie and interactive flag" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Loaders and ISR config on the four public routes

**Files:**
- Modify: `src/routes/+page.server.ts`, `src/routes/classification/+page.server.ts`, `src/routes/companies/+page.server.ts`
- Create: `src/routes/about/+page.server.ts`, `src/routes/companies/page.server.test.ts`, `src/routes/classification/page.server.test.ts`

**Interfaces:**
- Consumes: `isrConfig`, `pageParams`, `previewOf`, `PREVIEW_ROWS`.
- Produces: companies loader data gains `preview: boolean`; all four routes export `config` with the ISR fragment.

- [ ] **Step 1: Write the failing tests**

`src/routes/companies/page.server.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PAGE_SIZE, PREVIEW_ROWS } from '#lib/companies';
import { load } from './+page.server';

type Data = { result: { rows: unknown[]; total: number; page: number; pages: number }; filters: Record<string, string>; preview: boolean };
const run = async (query: string, interactive: boolean) =>
	(await load({
		url: new URL(`http://x.test/companies${query}`),
		locals: { authed: interactive, interactive },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof load>[0])) as unknown as Data;

describe('companies loader', () => {
	it('gives anonymous visitors the first 20 unfiltered rows, whatever the query says', async () => {
		const plain = await run('', false);
		const asked = await run('?country=Japan&industry=Steel&q=zzz&page=7&sic=1234', false);
		expect(asked).toEqual(plain);
		expect(plain.preview).toBe(true);
		expect(plain.result.rows).toHaveLength(PREVIEW_ROWS);
		expect(plain.result.total).toBeGreaterThan(40_000);
		expect([plain.result.page, plain.result.pages]).toEqual([1, 1]);
		expect(Object.values(plain.filters).every((v) => v === '')).toBe(true);
	});
	it('keeps the full interactive behaviour for logged-in requests', async () => {
		const japan = await run('?country=Japan', true);
		expect(japan.preview).toBe(false);
		expect(japan.filters.country).toBe('Japan');
		expect(japan.result.rows).toHaveLength(PAGE_SIZE);
		expect(japan.result.pages).toBeGreaterThan(1);
	});
});
```

`src/routes/classification/page.server.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

type Data = { q: string; industry: string; trace: unknown; reverse: unknown };
const run = async (query: string, interactive: boolean) =>
	(await load({
		url: new URL(`http://x.test/classification${query}`),
		locals: { authed: interactive, interactive },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof load>[0])) as unknown as Data;

describe('classification loader', () => {
	it('ignores search, code and industry for anonymous visitors', async () => {
		const asked = await run('?q=bank&code=64&industry=Banks%20(Regional)', false);
		expect(asked).toEqual(await run('', false));
		expect(asked.q).toBe('');
		expect(asked.industry).toBe('');
		expect(asked.trace).toBeNull();
	});
	it('searches for logged-in requests', async () => {
		expect((await run('?q=bank', true)).q).toBe('bank');
	});
});
```

- [ ] **Step 2: Run to verify they fail** — `npx -y node@24 node_modules/vitest/vitest.mjs run src/routes`. Expected: FAIL (loaders still read the URL; `preview` missing).

- [ ] **Step 3: Implement**

`src/routes/companies/+page.server.ts` (full file):

```ts
import companies from '#lib/data/companies.json';
import crosswalk from '#lib/data/crosswalk.json';
import { previewOf, queryCompanies, type CompanyData } from '#lib/companies';
import { isrConfig, pageParams } from '#lib/server/access';
import type { PageServerLoad } from './$types';

const data = companies as unknown as CompanyData;
const sicTitles = (crosswalk as unknown as { sicTitles: Record<string, string> }).sicTitles;

const text = (value: string | null, max: number) => (value ?? '').slice(0, max);

// The page is cached for anonymous visitors; logged-in browsers skip the cache.
export const config = isrConfig(process.env.ISR_BYPASS_TOKEN);

export const load: PageServerLoad = ({ url, locals, setHeaders }) => {
	// Anonymous requests get an empty query, so what the cache stores never depends on who asked first.
	const params = pageParams(locals.interactive, url);
	const industry = text(params.get('industry'), 100);
	const sic = /^\d{4}$/.test(params.get('sic') ?? '') ? params.get('sic')! : '';
	const country = text(params.get('country'), 100);
	const region = text(params.get('region'), 100);
	const sector = text(params.get('sector'), 100);
	const q = text(params.get('q'), 100);
	const page = Number.parseInt(params.get('page') ?? '1', 10);

	setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' });
	const result = queryCompanies(data, { industry, sic, country, region, sector, q, page });
	return {
		filters: { industry, sic, country, region, sector, q },
		result: locals.interactive ? result : previewOf(result),
		preview: !locals.interactive,
		industries: data.industries,
		regions: data.groups,
		sectors: [...data.sectors].sort((a, b) => a.localeCompare(b)),
		unknownIndustry: industry !== '' && !data.industries.includes(industry),
		sicTitle: sic ? (sicTitles[sic] ?? '') : '',
		generated: data.generated
	};
};
```

(Compare with the current file first: keep every returned key the current loader has; the block above is the current loader plus `params`, `config`, `locals`, `previewOf` and `preview`.)

`src/routes/classification/+page.server.ts`: add `import { isrConfig, pageParams } from '#lib/server/access';`, add `export const config = isrConfig(process.env.ISR_BYPASS_TOKEN);` above `load`, change the signature to `({ url, locals, setHeaders })`, add `const params = pageParams(locals.interactive, url);` as the first line and read `q`, `code` and `industry` from `params` instead of `url.searchParams`.

`src/routes/+page.server.ts`: add `import { isrConfig, pageParams } from '#lib/server/access';`; replace `export const config = { maxDuration: 30 };` with `export const config = { maxDuration: 30, ...isrConfig(process.env.ISR_BYPASS_TOKEN) };`; change the signature to `async ({ url, locals, setHeaders })` and the `parseParams(url.searchParams, ...)` call to `parseParams(pageParams(locals.interactive, url), ...)`.

`src/routes/about/+page.server.ts`:

```ts
import { isrConfig } from '#lib/server/access';

// The page itself is static; the config lets it share the cache and the login bypass with the other pages.
export const config = isrConfig(process.env.ISR_BYPASS_TOKEN);
```

- [ ] **Step 4: Run to verify they pass** — `vitest run src/routes` then the whole suite; `svelte-kit sync` and `svelte-check` (0 errors).

- [ ] **Step 5: Verify the adapter output** — with Node 24, `vite build` once without a token: `ls .vercel/output/functions/*.prerender-config.json 2>/dev/null | wc -l` prints `0`. Then `ISR_BYPASS_TOKEN=$(printf 'b%.0s' {1..40}) vite build`: four prerender configs exist (for `__root__`, `classification`, `companies`, `about`) and each contains `"expiration": 86400`, the `bypassToken` and `"allowQuery"` with only `__pathname`. Record the result in the report.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: ISR config and query-blind loaders for the public pages" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Anonymous views of the pages

**Files:**
- Modify: `src/routes/+page.svelte`, `src/routes/classification/+page.svelte`, `src/routes/companies/+page.svelte`

**Interfaces:**
- Consumes: `data.interactive` (layout data), `data.preview` (companies), `<LoginPrompt>`, `PREVIEW_ROWS`.

- [ ] **Step 1: Implement**

Home (`src/routes/+page.svelte`): import `LoginPrompt from '#lib/components/LoginPrompt.svelte'`. Wrap the whole `<form method="GET" ...> ... </form>` (from its opening tag to the matching `</form>` before `{#if data.loadError}`) in:

```svelte
{#if data.interactive}
	<form ...unchanged...> ... </form>
{:else}
	<LoginPrompt from="/">to change the selection and the chart options.</LoginPrompt>
{/if}
```

Classification (`src/routes/classification/+page.svelte`): import `LoginPrompt`. Wrap each of the two `<form method="get" aria-labelledby=...> ... </form>` blocks in `{#if data.interactive} ... {:else}<LoginPrompt from="/classification">to search the classification.</LoginPrompt>{/if}`. Keep the headings (`<h2 id="forward">` and `<h2 id="reverse">`) outside the `{#if}`.

Companies (`src/routes/companies/+page.svelte`): import `LoginPrompt` and `PREVIEW_ROWS` (`import { PREVIEW_ROWS, financialsLink } from '#lib/companies'`).
- Wrap the `<form method="get"> ... </form>` in `{#if data.interactive} ... {:else}<LoginPrompt from="/companies">to filter and page through all companies.</LoginPrompt>{/if}`.
- After the status paragraph add `{#if data.preview}<p class="note">Showing the first {PREVIEW_ROWS} companies.</p>{/if}`.
- Add this snippet in the template section (before `<main>`):

```svelte
{#snippet cell(key: string, value: string)}
	{#if data.interactive}<a href={narrow(key, value)}>{value}</a>{:else}{value}{/if}
{/snippet}
```

and replace the industry, sector, region and country links in the table row with `{@render cell('industry', c.industry)}`, `{@render cell('sector', c.sector)}`, `{@render cell('region', c.region)}` and `{@render cell('country', c.country)}` (keep the "multiples" link next to the industry as it is). In the SIC cell show the link only when `data.interactive`, else `<code>{c.sic}</code>`.
- Show the `Financials` column header and cell only when `data.interactive` (`{#if data.interactive}…{/if}` around both).
- Hide the pager unless `data.interactive` (it already needs `pages > 1`, which a preview never has; no change needed).

- [ ] **Step 2: Verify** — `svelte-check` 0 errors, `vite build` OK, whole suite passes. Smoke test on a production build without cookies: `/companies?country=Japan` shows exactly 20 body rows, the login prompt, no `name="country"` select, no "Financials" header, and the counts line; `/` shows the chart and the login prompt and no `<form method="GET"`; `/classification?q=bank` shows no results and the prompts. With the cookies from Task 2's login (token set) the same URLs are interactive: `/companies?country=Japan` shows 50 rows and the filters.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: anonymous views with login prompts" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: robots.txt, docs and spec status

**Files:**
- Create: `static/robots.txt`
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-27-static-public-site-design.md`

- [ ] **Step 1: Implement**

`static/robots.txt`:

```
User-agent: *
Disallow: /
```

`README.md`: in the `/financials` section's list of environment variables add `- `ISR_BYPASS_TOKEN`: random string of at least 32 characters (`openssl rand -hex 32`). It makes the public pages (Multiples, Find industry, Companies, About) a cached static copy for anonymous visitors; logging in sets a cookie that skips the cache. Unset or shorter than 32 characters turns the cache off (the site still works). Set it for Production and Preview and redeploy after changing it, because the token is read at build time and at runtime.` Add a short "Public and logged-in" paragraph: anonymous visitors see the default view of Multiples, Find industry, Companies (first 20 companies) and About, cached for a day; the same shared password unlocks interactive versions of every page; `/financials` is unchanged; `robots.txt` disallows crawlers. Fix the sentence "Login sets a signed, HTTP-only cookie that lasts 7 days" to say the cookie is site-wide and a second cookie (`__prerender_bypass`) is set with it.

`CLAUDE.md`: add `ISR_BYPASS_TOKEN` to the secrets line, and one bullet: "Public pages are ISR-cached for anonymous visitors; their loaders must read the query only through `pageParams(locals.interactive, url)` so that what is cached never depends on the first requester."

Spec: change the `Status:` line to `Status: approved; implemented (see PR).`

- [ ] **Step 2: Verify** — whole suite, `svelte-check`, `vite build`, `check-no-js`, and `npm run test:coverage` (floor holds; run via `npx -y node@24 "$(dirname $(readlink -f $(which npm)))/../bin/npm-cli.js" run test:coverage`). `curl` of `/robots.txt` on a preview server returns the two lines.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: robots.txt, ISR_BYPASS_TOKEN and the public/logged-in split" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
