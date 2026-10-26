# Company Data and News tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Coming soon" placeholders for Company Data and News on `/financials` with an FMP profile card and a list of the latest news articles.

**Architecture:** The FMP request logic in `fmp.ts` is split into a shared `fmpGet` helper (timeout, size cap, key redaction, status mapping). A new `fmp-info.ts` holds the profile and news fetch/parse code. `loadFinancials` branches on `nav.tab`. A pure `company.ts` formats the profile card. Links from API data pass through `safeUrl` (http/https only).

**Tech Stack:** SvelteKit 3 / Svelte 5, TypeScript (strict), Vitest, FMP stable API.

**Spec:** `docs/superpowers/specs/2026-10-26-company-and-news-tabs-design.md` (builds on `2026-10-26-financials-tabs-design.md`).

## Global Constraints

- TypeScript only: no `.js`/`.mjs`/`.cjs` files (`npm run check:ts-only`). `erasableSyntaxOnly`: no constructor parameter properties.
- Import `src/lib` with `#lib/...` from routes; relative imports inside `src/lib`. Modules under `src/lib` must not import `$env/*` or `$app/*`.
- The FMP key and URL are never logged or returned. All `/financials*` responses stay `Cache-Control: private, no-store`; auth is enforced inside `loadFinancials` before any FMP call.
- Links built from API data: only `http:`/`https:` URLs become links (`safeUrl`); links open with `target="_blank" rel="noopener noreferrer"`; no remote images.
- Cache: profile 24 h, news 15 min, keyed per symbol; failures never cached as results (existing `createCache`).
- Tests use Vitest with no network. Before the PR: `svelte-check` 0 errors, full test run, `npm run check:ts-only`, `vite build` all pass.
- Node 24 for all commands: `npx -y node@24 node_modules/.bin/<tool>` or `npx -y node@24 node_modules/vitest/vitest.mjs run <file>`. Below, `npx vitest run <file>` stands for that.
- Work on branch `feat/company-news-tabs` (exists; spec committed). Open a PR; do not merge without the owner's approval.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File map

| File | Change |
|---|---|
| `src/lib/safe-url.ts` (+ test) | New. `safeUrl` |
| `src/lib/server/fmp.ts` (+ existing tests) | Extract `fmpGet`, `throwIfErrorBody`; `fetchStatement` uses them (behaviour unchanged) |
| `src/lib/server/fmp-info.ts` (+ test) | New. `Profile`, `NewsItem`, `parseProfile`, `parseNews`, `fetchProfile`, `fetchNews` |
| `src/lib/company.ts` (+ test) | New. `profileFields`, `formatNewsDate` |
| `src/lib/server/financials.ts` (+ tests) | New view states `profile`, `news`; caches; only `price` stays `soon` |
| `src/routes/financials/+page.svelte`, `README.md`, `CLAUDE.md` | Render the two tabs; docs |

---

### Task 1: safeUrl

**Files:**
- Create: `src/lib/safe-url.ts`
- Test: `src/lib/safe-url.test.ts`

**Interfaces:**
- Produces: `safeUrl(value: unknown): string | null` (normalised absolute URL string for http/https, else `null`).

- [ ] **Step 1: Failing test**

```ts
// src/lib/safe-url.test.ts
import { describe, expect, it } from 'vitest';
import { safeUrl } from './safe-url';

describe('safeUrl', () => {
	it('accepts http and https', () => {
		expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
		expect(safeUrl('http://example.com')).toBe('http://example.com/');
		expect(safeUrl('  https://example.com/x  ')).toBe('https://example.com/x');
	});
	it('rejects other schemes', () => {
		expect(safeUrl('javascript:alert(1)')).toBeNull();
		expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull();
		expect(safeUrl('data:text/html,<b>x</b>')).toBeNull();
		expect(safeUrl('ftp://example.com/file')).toBeNull();
		expect(safeUrl('file:///etc/passwd')).toBeNull();
	});
	it('rejects relative, malformed, empty and non-string values', () => {
		expect(safeUrl('/relative/path')).toBeNull();
		expect(safeUrl('example.com')).toBeNull();
		expect(safeUrl('not a url')).toBeNull();
		expect(safeUrl('')).toBeNull();
		expect(safeUrl(null)).toBeNull();
		expect(safeUrl(undefined)).toBeNull();
		expect(safeUrl(42)).toBeNull();
	});
});
```
- [ ] **Step 2: Run, expect FAIL** (module not found).
- [ ] **Step 3: Implement**

```ts
// src/lib/safe-url.ts
/** The URL as an absolute string if it is http(s); anything else (javascript:, data:, relative, junk) is null. */
export function safeUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	try {
		const url = new URL(value.trim());
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}
```
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: safeUrl for links from API data`.

---

### Task 2: Extract the shared FMP request helper

**Files:**
- Modify: `src/lib/server/fmp.ts`
- Test: existing `src/lib/server/fmp.test.ts` (must pass unchanged), plus one new test.

**Interfaces:**
- Produces:
  - `throwIfErrorBody(body: unknown): void` — throws the mapped `FmpError` when `body` is an object (not array) with a string `Error Message`; otherwise returns.
  - `fmpGet(path: string, params: Record<string, string>, apiKey: string, fetchFn?: typeof fetch): Promise<unknown>` — does the request to `https://financialmodelingprep.com/stable/<path>?<params>&apikey=<key>` with the 10 s timeout, 5 MB cap, key redaction, JSON parse, and HTTP-status → `FmpError` mapping (401 config, 402/403 plan, 429 limit, other non-ok unavailable; a non-ok body with a string `Error Message` is mapped by `throwIfErrorBody` first). Returns the parsed JSON body (or `undefined` if not JSON, for an ok response).
- `fetchStatement` keeps its signature and behaviour; `parseStatement` calls `throwIfErrorBody(body)` first.

This is a behaviour-preserving refactor: all existing tests in `fmp.test.ts` must keep passing without edits.

- [ ] **Step 1: Add a test** to the `fetchStatement` describe block in `fmp.test.ts` (it currently passes; it pins behaviour the refactor must keep):

```ts
	it('maps an Error Message body on a non-ok response, and reports a non-JSON ok body as unavailable', async () => {
		const plan = vi.fn().mockResolvedValue(json({ 'Error Message': 'Special Endpoint : not on your plan' }, 402));
		await expect(fetchStatement('income', 'AAPL', 'K', 'annual', plan)).rejects.toMatchObject({ kind: 'plan' });
		const html = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
		await expect(fetchStatement('income', 'AAPL', 'K', 'annual', html)).rejects.toMatchObject({ kind: 'unavailable' });
	});
```
Run `npx vitest run src/lib/server/fmp.test.ts` — expect PASS (baseline).
- [ ] **Step 2: Refactor.** In `fmp.ts`:
  - Add (exported) `throwIfErrorBody` containing the `Error Message` block that now sits at the top of `parseStatement`, and call it as the first line of `parseStatement`.
  - Add exported `fmpGet(path, params, apiKey, fetchFn = fetch)`: move the request/timeout/`content-length`/`response.text()`/size/`redactKey`/`JSON.parse` code out of `fetchStatement` verbatim, build the query as `new URLSearchParams({ ...params, apikey: apiKey })`, request `` `${BASE}/${path}?${query}` ``, and in the `!response.ok` branch call `throwIfErrorBody(body)` (instead of `parseStatement(body)`) before the status mapping. End with `return body;`.
  - `fetchStatement` becomes:

```ts
export async function fetchStatement(
	kind: Kind,
	symbol: string,
	apiKey: string,
	period: Period = 'annual',
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	const params =
		period === 'ttm' ? { symbol, limit: '1' } : { symbol, period: 'annual', limit: '5' };
	const path = period === 'ttm' ? `${ENDPOINTS[kind]}-ttm` : ENDPOINTS[kind];
	const statement = parseStatement(await fmpGet(path, params, apiKey, fetchFn));
	// a TTM figure is a single column; keep the newest row even if FMP ignores limit=1
	return period === 'ttm' ? { ...statement, years: statement.years.slice(0, 1) } : statement;
}
```
- [ ] **Step 3: Run `fmp.test.ts` and the full suite** (`npx vitest run`): everything passes.
- [ ] **Step 4: Commit** `refactor: shared fmpGet request helper`.

---

### Task 3: Profile and news fetchers

**Files:**
- Create: `src/lib/server/fmp-info.ts`
- Test: `src/lib/server/fmp-info.test.ts`

**Interfaces:**
- Consumes: `fmpGet`, `throwIfErrorBody`, `FmpError` from `./fmp`; `safeUrl` from `../safe-url`.
- Produces:
  - `interface Profile { name; exchange; sector; industry; country; ceo; website; ipoDate; currency; description: string | null; employees; price; marketCap; beta: number | null }`
  - `interface NewsItem { title: string; publisher: string | null; date: string | null; text: string | null; url: string | null }`
  - `parseProfile(body: unknown): Profile | null`, `parseNews(body: unknown): NewsItem[]`
  - `fetchProfile(symbol: string, apiKey: string, fetchFn?: typeof fetch): Promise<Profile | null>`
  - `fetchNews(symbol: string, apiKey: string, fetchFn?: typeof fetch): Promise<NewsItem[]>`
  - `NEWS_LIMIT = 20`.

- [ ] **Step 1: Failing test**

```ts
// src/lib/server/fmp-info.test.ts
import { describe, expect, it, vi } from 'vitest';
import { FmpError } from './fmp';
import { fetchNews, fetchProfile, parseNews, parseProfile } from './fmp-info';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const raw = {
	symbol: 'AAPL',
	companyName: ' Apple Inc. ',
	exchangeFullName: 'NASDAQ Global Select',
	sector: 'Technology',
	industry: 'Consumer Electronics',
	country: 'US',
	ceo: 'Tim Cook',
	fullTimeEmployees: '164000',
	website: 'https://www.apple.com',
	ipoDate: '1980-12-12',
	currency: 'USD',
	price: 189.5,
	marketCap: 2_900_000_000_000,
	beta: 1.24,
	description: 'Apple designs phones.',
	image: 'https://images.example/aapl.png'
};

describe('parseProfile', () => {
	it('reads the first record, trims strings and converts numeric strings', () => {
		expect(parseProfile([raw])).toEqual({
			name: 'Apple Inc.',
			exchange: 'NASDAQ Global Select',
			sector: 'Technology',
			industry: 'Consumer Electronics',
			country: 'US',
			ceo: 'Tim Cook',
			website: 'https://www.apple.com/',
			ipoDate: '1980-12-12',
			currency: 'USD',
			description: 'Apple designs phones.',
			employees: 164000,
			price: 189.5,
			marketCap: 2_900_000_000_000,
			beta: 1.24
		});
	});
	it('returns null for an empty array or a non-object record', () => {
		expect(parseProfile([])).toBeNull();
		expect(parseProfile([null])).toBeNull();
	});
	it('drops missing, empty and wrongly typed fields', () => {
		const p = parseProfile([{ companyName: 'X', sector: '  ', ceo: 5, price: 'abc', marketCap: null }])!;
		expect(p.name).toBe('X');
		expect(p.sector).toBeNull();
		expect(p.ceo).toBeNull();
		expect(p.price).toBeNull();
		expect(p.marketCap).toBeNull();
	});
	it('drops an unsafe website', () => {
		expect(parseProfile([{ companyName: 'X', website: 'javascript:alert(1)' }])!.website).toBeNull();
	});
	it('maps an FMP error body and rejects other shapes', () => {
		expect(() => parseProfile({ 'Error Message': 'Invalid API KEY.' })).toThrowError(FmpError);
		expect(() => parseProfile({ nope: 1 })).toThrowError(/Unexpected response/);
	});
});

describe('parseNews', () => {
	const item = {
		symbol: 'AAPL',
		publishedDate: '2026-10-25 14:30:00',
		publisher: 'Reuters',
		title: 'Apple ships thing',
		image: 'https://images.example/x.png',
		site: 'reuters.com',
		text: 'Short text.',
		url: 'https://reuters.com/a'
	};
	it('maps items', () => {
		expect(parseNews([item])).toEqual([
			{
				title: 'Apple ships thing',
				publisher: 'Reuters',
				date: '2026-10-25 14:30:00',
				text: 'Short text.',
				url: 'https://reuters.com/a'
			}
		]);
	});
	it('falls back to site when there is no publisher', () => {
		expect(parseNews([{ ...item, publisher: undefined }])[0].publisher).toBe('reuters.com');
	});
	it('drops items without a title and unsafe urls, and truncates long text', () => {
		const items = parseNews([
			{ ...item, title: '' },
			{ ...item, url: 'javascript:alert(1)' },
			{ ...item, text: 'x'.repeat(500) }
		]);
		expect(items).toHaveLength(2);
		expect(items[0].url).toBeNull();
		expect(items[1].text!.length).toBeLessThanOrEqual(301);
		expect(items[1].text!.endsWith('…')).toBe(true);
	});
	it('returns [] for an empty list and throws unavailable for a non-array', () => {
		expect(parseNews([])).toEqual([]);
		expect(() => parseNews({ nope: 1 })).toThrowError(/Unexpected response/);
	});
});

describe('fetchProfile / fetchNews', () => {
	it('request the right endpoints and parameters', async () => {
		const fetchFn = vi.fn().mockImplementation(async () => json([]));
		await fetchProfile('AAPL', 'KEY', fetchFn);
		await fetchNews('AAPL', 'KEY', fetchFn);
		const [a, b] = fetchFn.mock.calls.map((c) => new URL(c[0] as string));
		expect(a.pathname).toBe('/stable/profile');
		expect(a.searchParams.get('symbol')).toBe('AAPL');
		expect(a.searchParams.get('apikey')).toBe('KEY');
		expect(b.pathname).toBe('/stable/news/stock');
		expect(b.searchParams.get('symbols')).toBe('AAPL');
		expect(b.searchParams.get('limit')).toBe('20');
	});
	it('never leak the key in an error message', async () => {
		const secret = 'SUPERSECRETKEY';
		const cases: Array<() => Promise<Response>> = [
			async () => json({ 'Error Message': `bad request https://x/y?apikey=${secret}` }, 400),
			async () => {
				throw new Error(`connect failed https://financialmodelingprep.com/stable/x?apikey=${secret}`);
			},
			async () => new Response('not json', { status: 200 })
		];
		for (const make of cases) {
			for (const run of [
				(f: typeof fetch) => fetchProfile('AAPL', secret, f),
				(f: typeof fetch) => fetchNews('AAPL', secret, f)
			]) {
				const error = await run(vi.fn().mockImplementation(make)).catch((e: unknown) => e);
				expect(error).toBeInstanceOf(FmpError);
				expect((error as Error).message).not.toContain(secret);
			}
		}
	});
	it('maps HTTP statuses', async () => {
		const kind = async (status: number) =>
			(await fetchProfile('AAPL', 'K', vi.fn().mockResolvedValue(json({}, status))).catch((e) => e)).kind;
		expect(await kind(402)).toBe('plan');
		expect(await kind(429)).toBe('limit');
		expect(await kind(500)).toBe('unavailable');
	});
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/lib/server/fmp-info.ts
import { safeUrl } from '../safe-url';
import { FmpError, fmpGet, throwIfErrorBody } from './fmp';

export interface Profile {
	name: string | null;
	exchange: string | null;
	sector: string | null;
	industry: string | null;
	country: string | null;
	ceo: string | null;
	website: string | null;
	ipoDate: string | null;
	currency: string | null;
	description: string | null;
	employees: number | null;
	price: number | null;
	marketCap: number | null;
	beta: number | null;
}

export interface NewsItem {
	title: string;
	publisher: string | null;
	date: string | null;
	text: string | null;
	url: string | null;
}

export const NEWS_LIMIT = 20;
const NEWS_PATH = 'news/stock';
const SNIPPET_MAX = 300;

const str = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const num = (value: unknown): number | null => {
	const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const unexpected = () => new FmpError('unavailable', 'Unexpected response from FMP');

export function parseProfile(body: unknown): Profile | null {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw unexpected();
	const r = body[0];
	if (!r || typeof r !== 'object') return null;
	const rec = r as Record<string, unknown>;
	return {
		name: str(rec.companyName),
		exchange: str(rec.exchangeFullName) ?? str(rec.exchange),
		sector: str(rec.sector),
		industry: str(rec.industry),
		country: str(rec.country),
		ceo: str(rec.ceo),
		website: safeUrl(rec.website),
		ipoDate: str(rec.ipoDate),
		currency: str(rec.currency),
		description: str(rec.description),
		employees: num(rec.fullTimeEmployees),
		price: num(rec.price),
		marketCap: num(rec.marketCap),
		beta: num(rec.beta)
	};
}

export function parseNews(body: unknown): NewsItem[] {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw unexpected();
	const items: NewsItem[] = [];
	for (const entry of body) {
		if (!entry || typeof entry !== 'object') continue;
		const rec = entry as Record<string, unknown>;
		const title = str(rec.title);
		if (!title) continue;
		const text = str(rec.text);
		items.push({
			title,
			publisher: str(rec.publisher) ?? str(rec.site),
			date: str(rec.publishedDate),
			text: text && text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX).trimEnd()}…` : text,
			url: safeUrl(rec.url)
		});
	}
	return items;
}

export async function fetchProfile(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Profile | null> {
	return parseProfile(await fmpGet('profile', { symbol }, apiKey, fetchFn));
}

export async function fetchNews(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<NewsItem[]> {
	return parseNews(await fmpGet(NEWS_PATH, { symbols: symbol, limit: String(NEWS_LIMIT) }, apiKey, fetchFn));
}
```
- [ ] **Step 4: Run, expect PASS** (`fmp-info.test.ts`, then `fmp.test.ts`).
- [ ] **Step 5: Commit** `feat: FMP profile and news fetchers`.

---

### Task 4: Profile card formatting

**Files:**
- Create: `src/lib/company.ts`
- Test: `src/lib/company.test.ts`

**Interfaces:**
- Consumes: type `Profile` from `./server/fmp-info`.
- Produces: `interface Field { label: string; value: string; href?: string }`; `profileFields(profile: Profile): Field[]`; `formatNewsDate(date: string | null): string | null`.

- [ ] **Step 1: Failing test**

```ts
// src/lib/company.test.ts
import { describe, expect, it } from 'vitest';
import { formatNewsDate, profileFields } from './company';
import type { Profile } from './server/fmp-info';

const empty: Profile = {
	name: null, exchange: null, sector: null, industry: null, country: null, ceo: null, website: null,
	ipoDate: null, currency: null, description: null, employees: null, price: null, marketCap: null, beta: null
};

describe('profileFields', () => {
	it('lists the fields in display order with formatting', () => {
		const fields = profileFields({
			...empty,
			name: 'Apple Inc.',
			exchange: 'NASDAQ',
			sector: 'Technology',
			industry: 'Consumer Electronics',
			country: 'US',
			ceo: 'Tim Cook',
			employees: 164000,
			website: 'https://www.apple.com/',
			ipoDate: '1980-12-12',
			currency: 'USD',
			price: 189.5,
			marketCap: 2_900_000_000_000,
			beta: 1.2345
		});
		expect(fields.map((f) => f.label)).toEqual([
			'Company', 'Exchange', 'Sector', 'Industry', 'Country', 'CEO', 'Employees', 'Website',
			'IPO date', 'Currency', 'Price', 'Market cap', 'Beta'
		]);
		const by = Object.fromEntries(fields.map((f) => [f.label, f]));
		expect(by.Employees.value).toBe('164,000');
		expect(by.Price.value).toBe('189.50 USD');
		expect(by['Market cap'].value).toBe('2.9 trillion USD');
		expect(by.Beta.value).toBe('1.23');
		expect(by.Website).toEqual({ label: 'Website', value: 'www.apple.com', href: 'https://www.apple.com/' });
	});
	it('skips missing values', () => {
		expect(profileFields({ ...empty, name: 'X' })).toEqual([{ label: 'Company', value: 'X' }]);
		expect(profileFields(empty)).toEqual([]);
	});
	it('scales market cap', () => {
		const cap = (v: number) => profileFields({ ...empty, marketCap: v })[0].value;
		expect(cap(5_500_000_000)).toBe('5.5 billion');
		expect(cap(250_000_000)).toBe('250 million');
		expect(cap(12_345)).toBe('12,345');
	});
});

describe('formatNewsDate', () => {
	it('keeps the date part', () => {
		expect(formatNewsDate('2026-10-25 14:30:00')).toBe('2026-10-25');
		expect(formatNewsDate('2026-10-25T14:30:00.000Z')).toBe('2026-10-25');
	});
	it('passes through unknown formats and null', () => {
		expect(formatNewsDate('yesterday')).toBe('yesterday');
		expect(formatNewsDate(null)).toBeNull();
	});
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/lib/company.ts
import type { Profile } from './server/fmp-info';

export interface Field {
	label: string;
	value: string;
	href?: string;
}

function scaled(value: number): string {
	const abs = Math.abs(value);
	const [n, unit] =
		abs >= 1e12 ? [value / 1e12, ' trillion'] : abs >= 1e9 ? [value / 1e9, ' billion'] : abs >= 1e6 ? [value / 1e6, ' million'] : [value, ''];
	return `${(n as number).toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`;
}

export function profileFields(p: Profile): Field[] {
	const cur = p.currency ? ` ${p.currency}` : '';
	const host = (url: string) => new URL(url).host;
	const candidates: Array<Field | null> = [
		p.name ? { label: 'Company', value: p.name } : null,
		p.exchange ? { label: 'Exchange', value: p.exchange } : null,
		p.sector ? { label: 'Sector', value: p.sector } : null,
		p.industry ? { label: 'Industry', value: p.industry } : null,
		p.country ? { label: 'Country', value: p.country } : null,
		p.ceo ? { label: 'CEO', value: p.ceo } : null,
		p.employees !== null ? { label: 'Employees', value: p.employees.toLocaleString('en-US') } : null,
		p.website ? { label: 'Website', value: host(p.website), href: p.website } : null,
		p.ipoDate ? { label: 'IPO date', value: p.ipoDate } : null,
		p.currency ? { label: 'Currency', value: p.currency } : null,
		p.price !== null ? { label: 'Price', value: `${p.price.toFixed(2)}${cur}` } : null,
		p.marketCap !== null ? { label: 'Market cap', value: `${scaled(p.marketCap)}${cur}` } : null,
		p.beta !== null ? { label: 'Beta', value: p.beta.toFixed(2) } : null
	];
	return candidates.filter((f): f is Field => f !== null);
}

export function formatNewsDate(date: string | null): string | null {
	if (date === null) return null;
	return /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : date;
}
```
(The expected `cap(12_345)` is `'12,345'` and `cap(250_000_000)` is `'250 million'`; keep the formats consistent with the test.)
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: profile card fields and news date formatting`.

---

### Task 5: Loader: profile and news views

**Files:**
- Modify: `src/lib/server/financials.ts`
- Test: `src/lib/server/financials.test.ts` (edit one test, add tests), new `src/lib/server/financials-info-cache.test.ts`

**Interfaces:**
- Consumes: `fetchProfile`, `fetchNews`, types `Profile`, `NewsItem` from `./fmp-info`.
- Produces:
  - `ProfileFetcher = (symbol: string, apiKey: string) => Promise<Profile | null>`; `NewsFetcher = (symbol: string, apiKey: string) => Promise<NewsItem[]>`.
  - `FinancialsView` additionally: `{ state: 'profile'; symbol: string; profile: Profile | null; message: string | null }` and `{ state: 'news'; symbol: string; items: NewsItem[]; message: string | null }`.
  - `loadFinancials` input additionally accepts optional `profileFetcher?: ProfileFetcher`, `newsFetcher?: NewsFetcher`.
  - `cachedProfile: ProfileFetcher` (24 h), `cachedNews: NewsFetcher` (15 min), both keyed by symbol; exported `PROFILE_TTL_MS`, `NEWS_TTL_MS`.

Check order: not authed -> `locked`; `tab === 'price'` -> `soon` (no FMP call); no key -> `unconfigured`; empty symbol -> `idle`; bad symbol -> `invalid`; then `company` -> profile, `news` -> news, `financials` -> statement as today.

- [ ] **Step 1: Tests.** In `financials.test.ts` change the placeholder test to cover only `price`:

```ts
	it('fetches nothing on the Stock Price placeholder', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const profileFetcher = vi.fn();
		const newsFetcher = vi.fn();
		expect(await loadFinancials({ ...base, nav: { ...nav, tab: 'price' }, fetcher, profileFetcher, newsFetcher })).toEqual({ state: 'soon' });
		expect(fetcher).not.toHaveBeenCalled();
		expect(profileFetcher).not.toHaveBeenCalled();
		expect(newsFetcher).not.toHaveBeenCalled();
	});
```
and the "still requires a session" test to use `tab: 'news'` unchanged (it expects `locked`). Add (import `Profile`, `NewsItem` types from `./fmp-info`):

```ts
const profile = { name: 'Apple Inc.' } as Profile;
const newsItem: NewsItem = { title: 'T', publisher: null, date: null, text: null, url: null };

describe('company and news tabs', () => {
	it('loads only the profile on the company tab', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const profileFetcher = vi.fn().mockResolvedValue(profile);
		const newsFetcher = vi.fn();
		const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'company' }, fetcher, profileFetcher, newsFetcher });
		expect(view).toEqual({ state: 'profile', symbol: 'AAPL', profile, message: null });
		expect(profileFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
		expect(fetcher).not.toHaveBeenCalled();
		expect(newsFetcher).not.toHaveBeenCalled();
	});
	it('loads only the news on the news tab', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const profileFetcher = vi.fn();
		const newsFetcher = vi.fn().mockResolvedValue([newsItem]);
		const view = await loadFinancials({ ...base, nav: { ...nav, tab: 'news' }, fetcher, profileFetcher, newsFetcher });
		expect(view).toEqual({ state: 'news', symbol: 'AAPL', items: [newsItem], message: null });
		expect(newsFetcher).toHaveBeenCalledWith('AAPL', 'KEY');
		expect(profileFetcher).not.toHaveBeenCalled();
	});
	it('says so when there is no profile or no news', async () => {
		const noProfile = await loadFinancials({ ...base, nav: { ...nav, tab: 'company' }, profileFetcher: async () => null });
		expect(noProfile).toEqual({ state: 'profile', symbol: 'AAPL', profile: null, message: 'No company profile found for AAPL.' });
		const noNews = await loadFinancials({ ...base, nav: { ...nav, tab: 'news' }, newsFetcher: async () => [] });
		expect(noNews).toEqual({ state: 'news', symbol: 'AAPL', items: [], message: 'No recent news found for AAPL.' });
	});
	it('guards both tabs: no key, no ticker, bad ticker, no session', async () => {
		for (const tab of ['company', 'news'] as const) {
			const profileFetcher = vi.fn();
			const newsFetcher = vi.fn();
			const n = { ...nav, tab };
			expect(await loadFinancials({ ...base, authed: false, nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'locked' });
			expect(await loadFinancials({ ...base, apiKey: '', nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'unconfigured' });
			expect(await loadFinancials({ ...base, rawSymbol: '', nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'idle' });
			expect(await loadFinancials({ ...base, rawSymbol: 'A&B', nav: n, profileFetcher, newsFetcher })).toEqual({ state: 'invalid' });
			expect(profileFetcher).not.toHaveBeenCalled();
			expect(newsFetcher).not.toHaveBeenCalled();
		}
	});
	it('maps failures to messages and logs without key or URL', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const boom = async () => {
			throw new FmpError('plan', 'Not available on this FMP plan');
		};
		const c = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: { ...nav, tab: 'company' }, profileFetcher: boom });
		const n = await loadFinancials({ ...base, apiKey: 'TOPSECRET', nav: { ...nav, tab: 'news' }, newsFetcher: boom });
		if (c.state !== 'profile' || n.state !== 'news') throw new Error('unexpected state');
		expect(c.message).toMatch(/plan/i);
		expect(n.message).toMatch(/plan/i);
		expect(c.profile).toBeNull();
		expect(n.items).toEqual([]);
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).toContain('AAPL');
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('apikey');
	});
});
```
New file `financials-info-cache.test.ts` (own file so the module mock does not touch other tests):

```ts
// src/lib/server/financials-info-cache.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fmp-info', async (importActual) => ({
	...(await importActual<typeof import('./fmp-info')>()),
	fetchProfile: vi.fn(async () => ({ name: 'X' })),
	fetchNews: vi.fn(async () => [])
}));

import * as info from './fmp-info';
import { NEWS_TTL_MS, PROFILE_TTL_MS, cachedNews, cachedProfile } from './financials';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
	vi.mocked(info.fetchProfile).mockClear();
	vi.mocked(info.fetchNews).mockClear();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('info caches', () => {
	it('uses 24 h for the profile and 15 min for news', () => {
		expect(PROFILE_TTL_MS).toBe(24 * 60 * 60 * 1000);
		expect(NEWS_TTL_MS).toBe(15 * 60 * 1000);
	});
	it('serves repeat calls from cache and refreshes news after its lifetime but not the profile', async () => {
		await cachedProfile('CACHEA', 'K');
		await cachedNews('CACHEA', 'K');
		await cachedProfile('CACHEA', 'K');
		await cachedNews('CACHEA', 'K');
		expect(info.fetchProfile).toHaveBeenCalledTimes(1);
		expect(info.fetchNews).toHaveBeenCalledTimes(1);
		vi.setSystemTime(Date.now() + NEWS_TTL_MS + 1000);
		await cachedProfile('CACHEA', 'K');
		await cachedNews('CACHEA', 'K');
		expect(info.fetchProfile).toHaveBeenCalledTimes(1);
		expect(info.fetchNews).toHaveBeenCalledTimes(2);
		vi.setSystemTime(Date.now() + PROFILE_TTL_MS);
		await cachedProfile('CACHEA', 'K');
		expect(info.fetchProfile).toHaveBeenCalledTimes(2);
	});
	it('keeps separate entries per symbol', async () => {
		await cachedNews('CACHEB', 'K');
		await cachedNews('CACHEC', 'K');
		expect(info.fetchNews).toHaveBeenCalledTimes(2);
	});
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement in `financials.ts`** (keep `messageFor`, the statement code and `cachedFetcher` as they are):

```ts
import { fetchNews, fetchProfile } from './fmp-info';
import type { NewsItem, Profile } from './fmp-info';

export type ProfileFetcher = (symbol: string, apiKey: string) => Promise<Profile | null>;
export type NewsFetcher = (symbol: string, apiKey: string) => Promise<NewsItem[]>;

// add to FinancialsView:
//   | { state: 'profile'; symbol: string; profile: Profile | null; message: string | null }
//   | { state: 'news'; symbol: string; items: NewsItem[]; message: string | null }

export const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
export const NEWS_TTL_MS = 15 * 60 * 1000;
const profileCache = createCache<Profile | null>({ ttlMs: PROFILE_TTL_MS });
const newsCache = createCache<NewsItem[]>({ ttlMs: NEWS_TTL_MS });
export const cachedProfile: ProfileFetcher = (symbol, apiKey) =>
	profileCache.get(symbol, () => fetchProfile(symbol, apiKey));
export const cachedNews: NewsFetcher = (symbol, apiKey) =>
	newsCache.get(symbol, () => fetchNews(symbol, apiKey));

function failure(what: string, symbol: string, error: unknown): string {
	console.error(`FMP ${what} for ${symbol} failed (${error instanceof FmpError ? error.kind : 'error'})`);
	return messageFor(error, symbol);
}

async function loadProfile(symbol: string, apiKey: string, fetcher: ProfileFetcher): Promise<FinancialsView> {
	try {
		const profile = await fetcher(symbol, apiKey);
		return {
			state: 'profile',
			symbol,
			profile,
			message: profile ? null : `No company profile found for ${symbol}.`
		};
	} catch (error) {
		return { state: 'profile', symbol, profile: null, message: failure('profile', symbol, error) };
	}
}

async function loadNews(symbol: string, apiKey: string, fetcher: NewsFetcher): Promise<FinancialsView> {
	try {
		const items = await fetcher(symbol, apiKey);
		return { state: 'news', symbol, items, message: items.length ? null : `No recent news found for ${symbol}.` };
	} catch (error) {
		return { state: 'news', symbol, items: [], message: failure('news', symbol, error) };
	}
}
```
In `loadFinancials`: add `profileFetcher?: ProfileFetcher; newsFetcher?: NewsFetcher` to the input type; replace `if (input.nav.tab !== 'financials') return { state: 'soon' };` with `if (input.nav.tab === 'price') return { state: 'soon' };`; after `if (!symbol) return { state: 'invalid' };` add:

```ts
	if (input.nav.tab === 'company') return loadProfile(symbol, input.apiKey, input.profileFetcher ?? cachedProfile);
	if (input.nav.tab === 'news') return loadNews(symbol, input.apiKey, input.newsFetcher ?? cachedNews);
```
- [ ] **Step 4: Run all `financials*` tests and the full suite, expect PASS.**
- [ ] **Step 5: Commit** `feat: load the company profile and news`.

---

### Task 6: Page, docs, verification

**Files:**
- Modify: `src/routes/financials/+page.svelte`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `profileFields`, `formatNewsDate` from `#lib/company`; view states `profile` and `news`.

`+page.server.ts` needs no change (it passes `view` through; the load already forwards `nav`).

- [ ] **Step 1: Page script.** Add `import { formatNewsDate, profileFields } from '#lib/company';`.
- [ ] **Step 2: Markup.** In the unlocked content, after the `{#if view.state === 'soon'} … {:else if view.state === 'unconfigured'}` chain's `soon` branch and before `unconfigured`, keep as is; add two branches before the final `{:else if view.state === 'ready'}`:

```svelte
				{:else if view.state === 'profile'}
					<h2 class="symbol">{view.symbol}</h2>
					{#if view.profile}
						<dl class="facts">
							{#each profileFields(view.profile) as f (f.label)}
								<dt>{f.label}</dt>
								<dd>
									{#if f.href}<a href={f.href} target="_blank" rel="noopener noreferrer">{f.value}</a>{:else}{f.value}{/if}
								</dd>
							{/each}
						</dl>
						{#if view.profile.description}
							<h3>About</h3>
							<p class="desc">{view.profile.description}</p>
						{/if}
					{:else}
						<p>{view.message}</p>
					{/if}
				{:else if view.state === 'news'}
					<h2 class="symbol">{view.symbol}</h2>
					{#if view.items.length > 0}
						<ul class="news">
							{#each view.items as item, i (i)}
								<li>
									<h3>
										{#if item.url}<a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>{:else}{item.title}{/if}
									</h3>
									<p class="meta">{[item.publisher, formatNewsDate(item.date)].filter(Boolean).join(' · ')}</p>
									{#if item.text}<p>{item.text}</p>{/if}
								</li>
							{/each}
						</ul>
					{:else}
						<p>{view.message}</p>
					{/if}
```
Change the idle message to `Enter an FMP ticker to see its data.`. Add styles:

```css
	.facts { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 1rem 0; }
	.facts dt { font-weight: 600; }
	.facts dd { margin: 0; }
	.desc { max-width: 60rem; line-height: 1.5; }
	.news { list-style: none; margin: 0; padding: 0; }
	.news li { padding: 0.8rem 0; border-bottom: 1px solid #ddd; }
	.news h3 { margin: 0 0 0.2rem; font-size: 1rem; }
	.meta { margin: 0 0 0.3rem; color: #555; font-size: 0.85rem; }
```
- [ ] **Step 3: Docs.** README: in the Financial statements section replace "News, Stock Price and Company Data are placeholders for now." with "Company Data shows the FMP company profile (cached 24 h) and News the latest 20 articles for the ticker (cached 15 min); links to articles and websites open in a new tab and only http(s) URLs are linked. Stock Price is a placeholder for now." CLAUDE.md `/financials` bullet: append " Profile and news go through the shared `fmpGet` in `src/lib/server/fmp.ts`; links from API data must pass `safeUrl`."
- [ ] **Step 4: Verify.** `svelte-check` 0 errors; full `vitest`; `npm run check:ts-only`; `vite build`. Manual: production build with `SITE_PASSWORD`/`SESSION_SECRET` set and no FMP key: log in, `?tab=company` and `?tab=news` show the "key is not configured" message, `?tab=price` shows "Coming soon", all tab links still carry `symbol`/`tab`/`statement`/`period`.
- [ ] **Step 5: Commit** `feat: Company Data and News tabs on /financials`, then (controller) push and open the PR. PR body lists the preview checks for the owner:
  1. Company Data for `AAPL`: card with name, exchange, sector, market cap etc., and the description; the website link opens in a new tab.
  2. News for `AAPL`: up to 20 articles, headlines link out in a new tab, no images. If FMP says "not available on your plan" or "unavailable", report it (the news path is the unverified piece).
  3. A European ticker such as `ABN.AS` on both tabs.
  4. Stock Price still says "Coming soon".
- [ ] **Step 6:** Do not merge. Wait for the owner's approval.
