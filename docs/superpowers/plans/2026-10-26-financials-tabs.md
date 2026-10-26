# Financials tabs and TTM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/financials` vertical tabs (Financials, News, Stock Price, Company Data), horizontal statement tabs and a "Latest 5 years / TTM" toggle, all driven by URL parameters.

**Architecture:** A small pure module (`financials-nav.ts`) parses and builds the URL state. `fmp.ts` gets a `period` argument that switches to FMP's `-ttm` endpoints. The loader fetches only the selected statement. The page renders links, so it works without JavaScript.

**Tech Stack:** SvelteKit 3 / Svelte 5, TypeScript (strict), Vitest, FMP stable API.

**Spec:** `docs/superpowers/specs/2026-10-26-financials-tabs-design.md` (builds on `2026-10-25-financials-page-design.md`).

## Global Constraints

- TypeScript only: no `.js`/`.mjs`/`.cjs` files (`npm run check:ts-only` enforces it). `erasableSyntaxOnly`: no constructor parameter properties.
- Import `src/lib` with `#lib/...`, never `$lib`. Library modules under `src/lib` must not import `$env/*`, `$app/*`.
- The FMP key and URL are never logged or returned. All `/financials*` responses stay `Cache-Control: private, no-store`; enforcement stays inside `loadFinancials`.
- Tests use Vitest with no network. Before the PR: `npm run check` 0 errors, `npm test`, `npm run check:ts-only`, `npm run build` all pass.
- Node 24 for all commands: `npx -y node@24 node_modules/.bin/<tool>` or `npx -y node@24 node_modules/vitest/vitest.mjs run <file>`. Below, `npx vitest run <file>` stands for that.
- Work on branch `feat/financials-tabs` (already created; the spec is committed on it). Open a PR; do not merge without the owner's approval.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File map

| File | Change |
|---|---|
| `src/lib/financials-nav.ts` (+ `.test.ts`) | New. Tab/statement/period ids, `parseNav`, `navHref` |
| `src/lib/server/fmp.ts` (+ test) | `fetchStatement(kind, symbol, apiKey, period = 'annual', fetchFn = fetch)` |
| `src/lib/statements.ts` (+ test) | `buildTable(statement, period = 'annual')`, TTM column label |
| `src/lib/server/financials.ts` (+ test) | One-statement loader taking `nav`; new view shape |
| `src/routes/financials/+page.server.ts` | Parse nav, return `nav` and `symbol` |
| `src/routes/financials/+page.svelte` | Layout, tabs, toggle |
| `README.md`, `CLAUDE.md` | One-line mention |

---

### Task 1: Navigation state module

**Files:**
- Create: `src/lib/financials-nav.ts`
- Test: `src/lib/financials-nav.test.ts`

**Interfaces:**
- Produces: `TABS`, `STATEMENTS`, `PERIODS` (arrays of `{id, label}`), types `Tab`, `StatementId`, `Period`, `Nav`; `parseNav(params: URLSearchParams): Nav`; `navHref(nav: Nav, symbol: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/financials-nav.test.ts
import { describe, expect, it } from 'vitest';
import { navHref, parseNav } from './financials-nav';

const q = (s: string) => new URLSearchParams(s);

describe('parseNav', () => {
	it('defaults to financials / income / annual', () => {
		expect(parseNav(q(''))).toEqual({ tab: 'financials', statement: 'income', period: 'annual' });
	});
	it('accepts every valid value', () => {
		expect(parseNav(q('tab=price&statement=cashflow&period=ttm'))).toEqual({
			tab: 'price',
			statement: 'cashflow',
			period: 'ttm'
		});
		expect(parseNav(q('tab=news')).tab).toBe('news');
		expect(parseNav(q('tab=company')).tab).toBe('company');
		expect(parseNav(q('statement=balance')).statement).toBe('balance');
	});
	it('falls back to the default for unknown values', () => {
		expect(parseNav(q('tab=nope&statement=x&period=quarterly'))).toEqual({
			tab: 'financials',
			statement: 'income',
			period: 'annual'
		});
	});
});

describe('navHref', () => {
	const nav = { tab: 'financials', statement: 'balance', period: 'ttm' } as const;
	it('keeps the symbol and all three choices', () => {
		expect(navHref(nav, 'AAPL')).toBe('/financials?symbol=AAPL&tab=financials&statement=balance&period=ttm');
	});
	it('omits an empty symbol', () => {
		expect(navHref(nav, '')).toBe('/financials?tab=financials&statement=balance&period=ttm');
	});
	it('round-trips through parseNav', () => {
		const url = new URL(navHref(nav, 'BRK-B'), 'http://x');
		expect(parseNav(url.searchParams)).toEqual(nav);
		expect(url.searchParams.get('symbol')).toBe('BRK-B');
	});
});
```

- [ ] **Step 2: Run it, expect FAIL** (`npx vitest run src/lib/financials-nav.test.ts`: cannot find module).

- [ ] **Step 3: Implement**

```ts
// src/lib/financials-nav.ts
export const TABS = [
	{ id: 'financials', label: 'Financials' },
	{ id: 'news', label: 'News' },
	{ id: 'price', label: 'Stock Price' },
	{ id: 'company', label: 'Company Data' }
] as const;
export const STATEMENTS = [
	{ id: 'income', label: 'Income Statement' },
	{ id: 'balance', label: 'Balance Sheet' },
	{ id: 'cashflow', label: 'Cash Flow' }
] as const;
export const PERIODS = [
	{ id: 'annual', label: 'Latest 5 years' },
	{ id: 'ttm', label: 'TTM' }
] as const;

export type Tab = (typeof TABS)[number]['id'];
export type StatementId = (typeof STATEMENTS)[number]['id'];
export type Period = (typeof PERIODS)[number]['id'];
export interface Nav {
	tab: Tab;
	statement: StatementId;
	period: Period;
}

const pick = <T extends string>(options: readonly { id: T }[], value: string | null, fallback: T): T =>
	options.find((o) => o.id === value)?.id ?? fallback;

export function parseNav(params: URLSearchParams): Nav {
	return {
		tab: pick(TABS, params.get('tab'), 'financials'),
		statement: pick(STATEMENTS, params.get('statement'), 'income'),
		period: pick(PERIODS, params.get('period'), 'annual')
	};
}

export function navHref(nav: Nav, symbol: string): string {
	const sp = new URLSearchParams();
	if (symbol) sp.set('symbol', symbol);
	sp.set('tab', nav.tab);
	sp.set('statement', nav.statement);
	sp.set('period', nav.period);
	return `/financials?${sp}`;
}
```

- [ ] **Step 4: Run it, expect PASS.**
- [ ] **Step 5: Commit** `feat: URL state for the financials tabs`.

---

### Task 2: FMP client: period argument

**Files:**
- Modify: `src/lib/server/fmp.ts` (the `fetchStatement` function)
- Test: `src/lib/server/fmp.test.ts`

**Interfaces:**
- Consumes: `Period` from `../financials-nav`.
- Produces: `fetchStatement(kind: Kind, symbol: string, apiKey: string, period: Period = 'annual', fetchFn: typeof fetch = fetch): Promise<Statement>`.

- [ ] **Step 1: Update existing tests.** In `fmp.test.ts` every call `fetchStatement(a, b, c, fetchFn)` becomes `fetchStatement(a, b, c, 'annual', fetchFn)` (all calls in the `fetchStatement` describe block; the `vi.fn()...` fourth argument at the oversized-response test moves the same way). Then add:

```ts
	it('uses the -ttm endpoint with limit 1 and no period for TTM', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('[]'));
		for (const [kind, path] of [
			['income', 'income-statement-ttm'],
			['balance', 'balance-sheet-statement-ttm'],
			['cashflow', 'cash-flow-statement-ttm']
		] as const) {
			await fetchStatement(kind, 'AAPL', 'K', 'ttm', fetchFn);
			const url = String(fetchFn.mock.calls.at(-1)![0]);
			expect(url).toContain(`/stable/${path}?`);
			expect(url).toContain('symbol=AAPL');
			expect(url).toContain('limit=1');
			expect(url).not.toContain('period=');
		}
	});
	it('keeps the annual URL unchanged', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('[]'));
		await fetchStatement('income', 'AAPL', 'K', 'annual', fetchFn);
		const url = String(fetchFn.mock.calls[0][0]);
		expect(url).toContain('/stable/income-statement?');
		expect(url).toContain('period=annual');
		expect(url).toContain('limit=5');
	});
```

- [ ] **Step 2: Run, expect FAIL** (type errors / URL assertions).
- [ ] **Step 3: Implement.** Add `import type { Period } from '../financials-nav';` at the top. Replace the start of `fetchStatement`:

```ts
export async function fetchStatement(
	kind: Kind,
	symbol: string,
	apiKey: string,
	period: Period = 'annual',
	fetchFn: typeof fetch = fetch
): Promise<Statement> {
	const query = new URLSearchParams(
		period === 'ttm'
			? { symbol, limit: '1', apikey: apiKey }
			: { symbol, period: 'annual', limit: '5', apikey: apiKey }
	);
	const path = period === 'ttm' ? `${ENDPOINTS[kind]}-ttm` : ENDPOINTS[kind];
	let response: Response;
	try {
		response = await fetchFn(`${BASE}/${path}?${query}`, {
```
(the rest of the function is unchanged).
- [ ] **Step 4: Run `fmp.test.ts`, expect PASS** (other files will not compile until Task 4; run only this file).
- [ ] **Step 5: Commit** `feat: FMP trailing-twelve-month endpoints`.

---

### Task 3: Table builder: TTM label

**Files:**
- Modify: `src/lib/statements.ts` (`buildTable`)
- Test: `src/lib/statements.test.ts`

**Interfaces:**
- Consumes: `Period` from `./financials-nav`.
- Produces: `buildTable(statement: Statement, period: Period = 'annual'): StatementTable`; for `'ttm'` every column's `year` is `'TTM'`.

- [ ] **Step 1: Failing test** (append to `statements.test.ts`, inside the file's existing style):

```ts
describe('buildTable period', () => {
	const statement: Statement = {
		lines: ['revenue'],
		years: [{ fiscalYear: '', date: '2025-06-30', currency: 'USD', values: { revenue: 3_000_000 } }]
	};
	it('labels the column TTM for trailing twelve months', () => {
		expect(buildTable(statement, 'ttm').columns).toEqual([{ year: 'TTM', date: '2025-06-30' }]);
	});
	it('keeps the fiscal year for annual', () => {
		const annual = { ...statement, years: [{ ...statement.years[0], fiscalYear: '2024' }] };
		expect(buildTable(annual).columns[0].year).toBe('2024');
	});
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Add `import type { Period } from './financials-nav';`; change the signature to `buildTable(statement: Statement, period: Period = 'annual')` and the columns line to `columns: statement.years.map((y) => ({ year: period === 'ttm' ? 'TTM' : y.fiscalYear, date: y.date })),`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: TTM column label`.

---

### Task 4: Loader: one statement, nav-aware

**Files:**
- Modify: `src/lib/server/financials.ts`
- Rewrite: `src/lib/server/financials.test.ts`

**Interfaces:**
- Consumes: `Nav`, `Period` from `../financials-nav`; `fetchStatement` from `./fmp`; `buildTable(statement, period)`.
- Produces:
  - `StatementFetcher = (kind: Kind, symbol: string, apiKey: string, period: Period) => Promise<Statement>`
  - `FinancialsView = {state:'locked'} | {state:'unconfigured'} | {state:'idle'} | {state:'invalid'} | {state:'soon'} | {state:'ready'; symbol: string; title: string; table: StatementTable | null; message: string | null}`
  - `statementTitle(kind: Kind, period: Period): string`
  - `loadFinancials(input: {authed; nav: Nav; rawSymbol; apiKey; fetcher?}): Promise<FinancialsView>`

Order of checks: not authed → `locked`; `nav.tab !== 'financials'` → `soon` (no FMP call); no key → `unconfigured`; empty symbol → `idle`; bad symbol → `invalid`; else fetch the one selected statement (`nav.statement`) with `nav.period`.

- [ ] **Step 1: Replace the test file**

```ts
// src/lib/server/financials.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Nav } from '../financials-nav';
import { FmpError, type Statement } from './fmp';
import { loadFinancials, statementTitle, type StatementFetcher } from './financials';

const statement: Statement = {
	lines: ['revenue'],
	years: [{ fiscalYear: '2024', date: '2024-12-31', currency: 'USD', values: { revenue: 5_000_000 } }]
};
const nav: Nav = { tab: 'financials', statement: 'income', period: 'annual' };
const base = { authed: true, nav, rawSymbol: 'aapl', apiKey: 'KEY' };

afterEach(() => {
	vi.restoreAllMocks();
});

describe('statementTitle', () => {
	it('names each statement, and the TTM balance sheet as the latest one', () => {
		expect(statementTitle('income', 'annual')).toBe('Income statement');
		expect(statementTitle('income', 'ttm')).toBe('Income statement (trailing twelve months)');
		expect(statementTitle('cashflow', 'ttm')).toBe('Cash flow statement (trailing twelve months)');
		expect(statementTitle('balance', 'annual')).toBe('Balance sheet');
		expect(statementTitle('balance', 'ttm')).toBe('Latest balance sheet');
	});
});

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
	it('fetches nothing on the placeholder tabs', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		for (const tab of ['news', 'price', 'company'] as const) {
			expect(await loadFinancials({ ...base, nav: { ...nav, tab }, fetcher })).toEqual({ state: 'soon' });
		}
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('still requires a session on the placeholder tabs', async () => {
		const fetcher = vi.fn<StatementFetcher>();
		const view = await loadFinancials({ ...base, authed: false, nav: { ...nav, tab: 'news' }, fetcher });
		expect(view).toEqual({ state: 'locked' });
	});
	it('fetches only the selected statement, with the period', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		const view = await loadFinancials({ ...base, nav: { ...nav, statement: 'balance', period: 'ttm' }, fetcher });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledWith('balance', 'AAPL', 'KEY', 'ttm');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.symbol).toBe('AAPL');
		expect(view.title).toBe('Latest balance sheet');
		expect(view.table?.columns[0].year).toBe('TTM');
		expect(view.message).toBeNull();
	});
	it('shows the annual income statement by default', async () => {
		const fetcher = vi.fn<StatementFetcher>().mockResolvedValue(statement);
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.title).toBe('Income statement');
		expect(view.table?.columns[0].year).toBe('2024');
	});
	it('reports a failure for the selected statement only', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new FmpError('limit', 'FMP rate limit reached');
		};
		const view = await loadFinancials({ ...base, fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table).toBeNull();
		expect(view.message).toMatch(/rate limit/i);
	});
	it('says so when there are no figures', async () => {
		const annual = await loadFinancials({ ...base, fetcher: async () => ({ lines: [], years: [] }) });
		if (annual.state !== 'ready') throw new Error('expected ready');
		expect(annual.table).toBeNull();
		expect(annual.message).toMatch(/no annual statements/i);
		const ttm = await loadFinancials({
			...base,
			nav: { ...nav, period: 'ttm' },
			fetcher: async () => ({ lines: [], years: [] })
		});
		if (ttm.state !== 'ready') throw new Error('expected ready');
		expect(ttm.message).toMatch(/trailing-twelve-month/i);
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
	it('treats a non-FmpError as unavailable and logs nothing sensitive', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const fetcher: StatementFetcher = async () => {
			throw new Error('boom https://financialmodelingprep.com/stable/x?apikey=TOPSECRET');
		};
		const view = await loadFinancials({ ...base, apiKey: 'TOPSECRET', fetcher });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table).toBeNull();
		expect(view.message).toMatch(/FMP is unavailable/);
		expect(view.message).not.toContain('TOPSECRET');
		const logged = JSON.stringify([spy.mock.calls, warn.mock.calls, log.mock.calls]);
		expect(logged).not.toContain('TOPSECRET');
		expect(logged).not.toContain('financialmodelingprep');
	});
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Replace `financials.ts`** (keep `messageFor` exactly as it is today):

```ts
// src/lib/server/financials.ts
import { parseSymbol } from '../symbol';
import { buildTable } from '../statements';
import type { StatementTable } from '../statements';
import type { Nav, Period } from '../financials-nav';
import { createCache } from './cache';
import { FmpError, fetchStatement } from './fmp';
import type { Kind, Statement } from './fmp';

export type StatementFetcher = (kind: Kind, symbol: string, apiKey: string, period: Period) => Promise<Statement>;

export type FinancialsView =
	| { state: 'locked' }
	| { state: 'unconfigured' }
	| { state: 'idle' }
	| { state: 'invalid' }
	| { state: 'soon' }
	| { state: 'ready'; symbol: string; title: string; table: StatementTable | null; message: string | null };

const TITLES: Record<Kind, string> = {
	income: 'Income statement',
	balance: 'Balance sheet',
	cashflow: 'Cash flow statement'
};

export function statementTitle(kind: Kind, period: Period): string {
	if (period === 'annual') return TITLES[kind];
	// a balance sheet is a snapshot, so FMP's "TTM" balance sheet is simply the latest one
	return kind === 'balance' ? 'Latest balance sheet' : `${TITLES[kind]} (trailing twelve months)`;
}

const cache = createCache<Statement>({ ttlMs: 24 * 60 * 60 * 1000 });

/** One cache entry per statement and period, so a failure of one is never stored as a result. */
export const cachedFetcher: StatementFetcher = (kind, symbol, apiKey, period) =>
	cache.get(period === 'ttm' ? `${kind}:${symbol}:ttm` : `${kind}:${symbol}`, () =>
		fetchStatement(kind, symbol, apiKey, period)
	);

// messageFor(error, symbol): unchanged from the current file

export async function loadFinancials(input: {
	authed: boolean;
	nav: Nav;
	rawSymbol: string | null;
	apiKey: string | undefined;
	fetcher?: StatementFetcher;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	if (input.nav.tab !== 'financials') return { state: 'soon' };
	if (!input.apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	const symbol = parseSymbol(input.rawSymbol);
	if (!symbol) return { state: 'invalid' };

	const { statement: kind, period } = input.nav;
	const title = statementTitle(kind, period);
	const fetcher = input.fetcher ?? cachedFetcher;
	try {
		const table = buildTable(await fetcher(kind, symbol, input.apiKey, period), period);
		if (table.columns.length === 0) {
			const what = period === 'ttm' ? 'trailing-twelve-month figures' : 'annual statements';
			return { state: 'ready', symbol, title, table: null, message: `No ${what} found for ${symbol}.` };
		}
		return { state: 'ready', symbol, title, table, message: null };
	} catch (error) {
		const detail = error instanceof FmpError ? error.kind : 'error';
		console.error(`FMP ${kind} ${period} statement for ${symbol} failed (${detail})`);
		return { state: 'ready', symbol, title, table: null, message: messageFor(error, symbol) };
	}
}
```
- [ ] **Step 4: Run `financials.test.ts` and `fmp.test.ts` and `statements.test.ts`, expect PASS.**
- [ ] **Step 5: Commit** `feat: load only the selected statement and period`.

---

### Task 5: Route and page

**Files:**
- Modify: `src/routes/financials/+page.server.ts` (the `load` function only)
- Rewrite: `src/routes/financials/+page.svelte`

**Interfaces:**
- Consumes: `parseNav`, `navHref`, `TABS`, `STATEMENTS`, `PERIODS` from `#lib/financials-nav`; `parseSymbol` from `#lib/symbol`; `loadFinancials`.
- Produces: page data `{configured: boolean, nav: Nav, symbol: string, view: FinancialsView}` where `symbol` is the normalised ticker or `''`.

- [ ] **Step 1: Update `load`** (add imports `import { parseNav } from '#lib/financials-nav'; import { parseSymbol } from '#lib/symbol';`):

```ts
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const nav = parseNav(url.searchParams);
	const rawSymbol = url.searchParams.get('symbol');
	return {
		configured: Boolean(SITE_PASSWORD && SESSION_SECRET),
		nav,
		symbol: (rawSymbol && parseSymbol(rawSymbol)) || '',
		view: await loadFinancials({ authed: locals.authed, nav, rawSymbol, apiKey: FMP_API_KEY })
	};
};
```

- [ ] **Step 2: Rewrite `+page.svelte`.** Keep the `locked` branch (login form, "not configured" message, `form?.message`) exactly as today. Replace the unlocked branch:

```svelte
<script lang="ts">
	import type { PageProps } from './$types';
	import { PERIODS, STATEMENTS, TABS, navHref } from '#lib/financials-nav';

	let { data, form }: PageProps = $props();
	const view = $derived(data.view);
	const nav = $derived(data.nav);
	const tabLabel = $derived(TABS.find((t) => t.id === nav.tab)?.label ?? '');
</script>
```
Unlocked markup (inside `<main>`, after `<h1>Company financials</h1>` and the locked branch's `{:else}`):

```svelte
		<div class="bar">
			<form method="GET">
				<input type="hidden" name="tab" value={nav.tab} />
				<input type="hidden" name="statement" value={nav.statement} />
				<input type="hidden" name="period" value={nav.period} />
				<label for="symbol">Ticker</label>
				<input id="symbol" name="symbol" value={data.symbol} placeholder="AAPL or ABN.AS" maxlength="15" autocomplete="off" />
				<button type="submit">Show</button>
			</form>
			<form method="POST" action="?/logout"><button type="submit">Log out</button></form>
		</div>

		<div class="layout">
			<nav class="side" aria-label="Sections">
				<ul>
					{#each TABS as t (t.id)}
						<li><a href={navHref({ ...nav, tab: t.id }, data.symbol)} aria-current={nav.tab === t.id ? 'page' : undefined}>{t.label}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="content">
				{#if nav.tab === 'financials'}
					<nav class="tabs" aria-label="Statements">
						{#each STATEMENTS as s (s.id)}
							<a href={navHref({ ...nav, statement: s.id }, data.symbol)} aria-current={nav.statement === s.id ? 'page' : undefined}>{s.label}</a>
						{/each}
					</nav>
					<nav class="period" aria-label="Period">
						{#each PERIODS as p (p.id)}
							<a href={navHref({ ...nav, period: p.id }, data.symbol)} aria-current={nav.period === p.id ? 'page' : undefined}>{p.label}</a>
						{/each}
					</nav>
				{/if}

				{#if view.state === 'soon'}
					<h2>{tabLabel}</h2>
					<p>Coming soon.</p>
				{:else if view.state === 'unconfigured'}
					<p class="error" role="alert">The FMP key is not configured on this deployment.</p>
				{:else if view.state === 'invalid'}
					<p class="error" role="alert">That is not a valid ticker. Use letters, digits, dots and dashes, for example BRK-B.</p>
				{:else if view.state === 'idle'}
					<p>Enter an FMP ticker to see its financial statements.</p>
				{:else if view.state === 'ready'}
					<h2 class="symbol">{view.symbol}</h2>
					<section>
						<h3>{view.title}{#if view.table?.currency} <small>(millions of {view.table.currency}; per-share figures as reported)</small>{/if}</h3>
						{#if view.table}
							<!-- the existing <table> markup, with view.table in place of t.table -->
						{:else}
							<p>{view.message}</p>
						{/if}
					</section>
				{/if}
			</div>
		</div>
```
Move the existing `<table>…</table>` markup unchanged into the marked spot (replace `t.table` by `view.table`). Styles: keep the existing ones, change `main` max-width to `72rem`, and add:

```css
	.layout { display: grid; grid-template-columns: 11rem 1fr; gap: 1.5rem; align-items: start; }
	.side ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
	.side a, .tabs a, .period a { padding: 0.45rem 0.8rem; text-decoration: none; color: inherit; border: 1px solid transparent; }
	.side a[aria-current='page'] { font-weight: 600; background: #eef2ff; border-left: 3px solid #3730a3; }
	.tabs { display: flex; flex-wrap: wrap; border-bottom: 1px solid #ddd; }
	.tabs a[aria-current='page'] { font-weight: 600; border: 1px solid #ddd; border-bottom-color: #fff; margin-bottom: -1px; }
	.period { display: inline-flex; margin: 0.8rem 0; border: 1px solid #ddd; border-radius: 0.3rem; overflow: hidden; }
	.period a[aria-current='page'] { background: #3730a3; color: #fff; }
	.content { min-width: 0; overflow-x: auto; }
	@media (max-width: 40rem) {
		.layout { grid-template-columns: 1fr; }
		.side ul { flex-direction: row; flex-wrap: wrap; }
	}
```
Change the `<title>` to "Company financials".

- [ ] **Step 3: Verify.** `npx -y node@24 node_modules/.bin/svelte-check` reports 0 errors; `npm test` passes (all files); `npm run build` and `npm run check:ts-only` pass.
- [ ] **Step 4: Manual check** with a production build and `SITE_PASSWORD`/`SESSION_SECRET` set in the environment and no FMP key: log in, confirm the four vertical tabs, that News shows "Coming soon", that the statement tabs and the toggle links carry `symbol`, `tab`, `statement`, `period`, and that a tampered `?tab=zzz` shows Financials.
- [ ] **Step 5: Commit** `feat: vertical tabs, statement tabs and TTM toggle on /financials`.

---

### Task 6: Docs and PR

**Files:**
- Modify: `README.md` and `CLAUDE.md` (the existing financials paragraph in each)

- [ ] **Step 1:** In the financials section of `README.md` and `CLAUDE.md` add: "`/financials` has vertical tabs (Financials, News, Stock Price, Company Data) and, under Financials, statement tabs and a Latest 5 years / TTM toggle, all in the URL (`tab`, `statement`, `period`). News, Stock Price and Company Data are placeholders. TTM uses FMP's `-ttm` endpoints; the TTM balance sheet is the latest balance sheet."
- [ ] **Step 2:** Run the full verification (check, test, check:ts-only, build). Push the branch and open a PR titled "Financials page: vertical tabs, statement tabs and TTM toggle". The PR body lists the preview checks for the owner:
  1. Log in; the four vertical tabs show, News/Stock Price/Company Data say "Coming soon".
  2. Enter `AAPL`: Income Statement, 5 years. Switch to Balance Sheet and Cash Flow.
  3. Toggle TTM on each statement and confirm FMP returns figures (income statement TTM is the unverified endpoint). Note any "not available on your plan" message.
  4. Reload and share the URL; the same view appears.
  5. Narrow the window: tabs stack above the content.
- [ ] **Step 3:** Do not merge. Wait for the owner's approval.
