# Yahoo Finance data source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `/financials` show prices, profile, news and statements from Yahoo Finance for tickers outside the US (such as `ABN.AS`), with an FMP / Yahoo switch for US tickers, and let the Companies page link non-US companies to it.

**Architecture:** A pure `source.ts` decides the effective source per ticker (non-US forces Yahoo) and whether a period is available (TTM is not available from FMP). Pure parsers in `yahoo-parse.ts` turn `yahoo-finance2` results into the existing shapes (`PricePoint`, `Profile`, `NewsItem`, `Statement`). A thin `yahoo.ts` client wraps the library behind an injectable interface and maps errors to `FmpError`. `loadFinancials` picks one fetcher set per request, so a view never mixes sources. The page gets a source switch and a grayed-out TTM option under FMP.

**Tech Stack:** SvelteKit 3 / Svelte 5, TypeScript (strict), Vitest, `yahoo-finance2` 4.0.5, FMP stable API.

**Spec:** `docs/superpowers/specs/2026-10-27-yahoo-source-design.md`

## Global Constraints

- TypeScript only: no `.js`/`.mjs`/`.cjs` files in the repo (`npm run check:ts-only`). `erasableSyntaxOnly`: no constructor parameter properties.
- Import `src/lib` with `#lib/...` from routes and components; relative imports inside `src/lib`. Modules under `src/lib` must not import `$env/*` or `$app/*`.
- One source per view: every figure on a page comes from the one effective source. No fallback, no mixing; helper calls (Yahoo profile for currency and the news query) are Yahoo calls too.
- Source rules: a ticker without a dot is a US listing (FMP by default, Yahoo on request); a ticker with a dot is non-US and always Yahoo. `period=ttm` with the FMP source is treated as `annual` (`FMP_SUPPORTS_TTM = false`); the toggle shows TTM grayed out (`aria-disabled="true"`, not a link).
- Auth stays inside `loadFinancials` (locked first, before any fetch); `/financials*` stays `Cache-Control: private, no-store`. The FMP key is never logged or returned; error text shown to visitors never contains URLs.
- Links built from API data pass `safeUrl` (http/https only) and open with `target="_blank" rel="noopener noreferrer"`; no `{@html}`, no remote images.
- Caches: statements 24 h, profile 24 h, news 15 min, prices 1 h, per source; new caches pass `now: () => Date.now()` so fake timers work; failures are never cached as results (existing `createCache`).
- Tests use Vitest with no network; Yahoo is tested through a fake client and trimmed fixtures. Before the PR: `svelte-check` 0 errors, full test run with the coverage floor (`npm run test:coverage`), `npm run check:ts-only`, `vite build` all pass.
- Node 24 for all commands: `npx -y node@24 node_modules/vitest/vitest.mjs run <file>`, `npx -y node@24 node_modules/.bin/svelte-kit sync`, `npx -y node@24 node_modules/.bin/svelte-check --tsconfig ./tsconfig.json`, `npx -y node@24 node_modules/.bin/vite build`, `npx -y node@24 scripts/check-no-js.ts`. For npm: `npx -y node@24 "$(dirname $(readlink -f $(which npm)))/../bin/npm-cli.js" <args>`. Below, `vitest run <file>` stands for the first form.
- Work on branch `feat/yahoo-source` (exists; spec committed). Open a PR; do not merge without the owner's approval. Do not push unless the task says so.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (exactly this line, whatever model you are).

## File map

| File | Change |
|---|---|
| `src/lib/source.ts` (+ test) | New. `Source`, `SOURCES`, `FMP_SUPPORTS_TTM`, `parseSource`, `isUsListing`, `resolveSource`, `periodAvailable`, `effectivePeriod`, `sourceLabel` |
| `src/lib/financials-nav.ts` (+ test) | `Nav.source?`; `parseNav`/`navHref` carry it |
| `src/lib/server/fmp-info.ts` | Export `str` and `num` |
| `src/lib/server/yahoo-parse.ts` (+ test) | New. Pure parsers for prices, profile, news, statements |
| `src/lib/server/yahoo.ts` (+ test) | New. `YahooClient`, default client, `fetchYahoo*`, error mapping |
| `package.json`, `package-lock.json` | Add `yahoo-finance2` 4.0.5 |
| `src/lib/server/financials.ts` (+ tests) | Source-aware loader, Yahoo caches, `messageFor` per source |
| `src/lib/statements.ts` (+ test) | EPS keys ending in `EPS` formatted as per-share |
| `src/routes/financials/+page.svelte` | Source switch, grayed TTM, labels |
| `src/lib/yahoo.ts` (+ test), `src/lib/companies.ts` (+ test), `src/routes/companies/+page.svelte` | `yahooSymbol`, `financialsLink`, button for non-US rows |
| `README.md`, `CLAUDE.md`, spec status line | Docs |

---

### Task 1: Source rules and the `source` URL parameter

**Files:**
- Create: `src/lib/source.ts`, `src/lib/source.test.ts`
- Modify: `src/lib/financials-nav.ts`, `src/lib/financials-nav.test.ts`

**Interfaces:**
- Consumes: `Period` type from `./financials-nav` (type import only, so no runtime cycle).
- Produces: `type Source = 'fmp' | 'yahoo'`; `SOURCES` (`[{id:'fmp',label:'FMP'},{id:'yahoo',label:'Yahoo Finance'}]`); `FMP_SUPPORTS_TTM = false`; `sourceLabel(source): string`; `parseSource(raw: string | null): Source | undefined`; `isUsListing(symbol: string): boolean`; `resolveSource(requested: Source | undefined, symbol: string): Source`; `periodAvailable(source: Source, period: Period): boolean`; `effectivePeriod(source: Source, period: Period): Period`; `Nav` gains optional `source?: Source`.

- [ ] **Step 1: Write the failing tests**

`src/lib/source.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	FMP_SUPPORTS_TTM,
	effectivePeriod,
	isUsListing,
	parseSource,
	periodAvailable,
	resolveSource,
	sourceLabel
} from './source';

describe('isUsListing', () => {
	it('treats tickers without a dot as US, including dashed share classes', () => {
		expect(isUsListing('AAPL')).toBe(true);
		expect(isUsListing('BRK-B')).toBe(true);
		expect(isUsListing('')).toBe(true);
	});
	it('treats a dot suffix as an exchange suffix', () => {
		for (const s of ['ABN.AS', 'SAP.DE', '7203.T']) expect(isUsListing(s), s).toBe(false);
	});
});

describe('parseSource', () => {
	it('accepts the two sources and ignores everything else', () => {
		expect(parseSource('fmp')).toBe('fmp');
		expect(parseSource('yahoo')).toBe('yahoo');
		expect(parseSource('YAHOO')).toBeUndefined();
		expect(parseSource('bloomberg')).toBeUndefined();
		expect(parseSource(null)).toBeUndefined();
	});
});

describe('resolveSource', () => {
	it('uses FMP for US tickers unless Yahoo is requested', () => {
		expect(resolveSource(undefined, 'AAPL')).toBe('fmp');
		expect(resolveSource('fmp', 'AAPL')).toBe('fmp');
		expect(resolveSource('yahoo', 'AAPL')).toBe('yahoo');
	});
	it('forces Yahoo for non-US tickers, whatever was requested', () => {
		expect(resolveSource(undefined, 'ABN.AS')).toBe('yahoo');
		expect(resolveSource('fmp', 'ABN.AS')).toBe('yahoo');
		expect(resolveSource('yahoo', 'ABN.AS')).toBe('yahoo');
	});
});

describe('periods', () => {
	it('keeps TTM unavailable for FMP while the plan lacks it, and available for Yahoo', () => {
		expect(FMP_SUPPORTS_TTM).toBe(false);
		expect(periodAvailable('fmp', 'ttm')).toBe(false);
		expect(periodAvailable('yahoo', 'ttm')).toBe(true);
		expect(periodAvailable('fmp', 'annual')).toBe(true);
		expect(periodAvailable('yahoo', 'annual')).toBe(true);
	});
	it('turns an unavailable period into annual', () => {
		expect(effectivePeriod('fmp', 'ttm')).toBe('annual');
		expect(effectivePeriod('yahoo', 'ttm')).toBe('ttm');
		expect(effectivePeriod('fmp', 'annual')).toBe('annual');
	});
});

describe('sourceLabel', () => {
	it('names the sources for visitors', () => {
		expect(sourceLabel('fmp')).toBe('FMP');
		expect(sourceLabel('yahoo')).toBe('Yahoo Finance');
	});
});
```

In `src/lib/financials-nav.test.ts` append inside the file (the file already defines `const q = (s: string) => new URLSearchParams(s);`):

```ts
describe('source parameter', () => {
	it('is absent from the nav unless a valid source is given', () => {
		expect(parseNav(q(''))).toEqual({ tab: 'financials', statement: 'income', period: 'annual' });
		expect('source' in parseNav(q('source=bloomberg'))).toBe(false);
		expect(parseNav(q('source=yahoo')).source).toBe('yahoo');
	});
	it('is written to the href only when present, after the period', () => {
		const nav = { tab: 'price', statement: 'income', period: 'annual' } as const;
		expect(navHref(nav, 'AAPL')).toBe('/financials?symbol=AAPL&tab=price&statement=income&period=annual');
		expect(navHref({ ...nav, source: 'yahoo' }, 'AAPL')).toBe(
			'/financials?symbol=AAPL&tab=price&statement=income&period=annual&source=yahoo'
		);
	});
	it('survives the login round trip', () => {
		const nav = { tab: 'news', statement: 'income', period: 'annual', source: 'yahoo' } as const;
		expect(loginAction(nav, 'AAPL')).toBe('?/login&symbol=AAPL&tab=news&statement=income&period=annual&source=yahoo');
		expect(afterLogin(q('symbol=aapl&tab=news&source=yahoo'))).toBe(
			'/financials?symbol=AAPL&tab=news&statement=income&period=annual&source=yahoo'
		);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vitest run src/lib/source.test.ts src/lib/financials-nav.test.ts`
Expected: FAIL (`./source` missing; `source` not carried).

- [ ] **Step 3: Implement**

`src/lib/source.ts`:

```ts
import type { Period } from './financials-nav';

export const SOURCES = [
	{ id: 'fmp', label: 'FMP' },
	{ id: 'yahoo', label: 'Yahoo Finance' }
] as const;
export type Source = (typeof SOURCES)[number]['id'];

/** The owner's FMP plan has no trailing-twelve-month data; set this to true if that ever changes. */
export const FMP_SUPPORTS_TTM = false;

export const sourceLabel = (source: Source): string => SOURCES.find((s) => s.id === source)!.label;

export function parseSource(raw: string | null): Source | undefined {
	return SOURCES.find((s) => s.id === raw)?.id;
}

/** A ticker without a dot is a US listing; share classes use a dash (BRK-B), so a dot means an exchange suffix (ABN.AS). */
export function isUsListing(symbol: string): boolean {
	return !symbol.includes('.');
}

/** The one source that serves a view: non-US tickers are Yahoo only, US tickers use the request or FMP. */
export function resolveSource(requested: Source | undefined, symbol: string): Source {
	if (!isUsListing(symbol)) return 'yahoo';
	return requested ?? 'fmp';
}

export function periodAvailable(source: Source, period: Period): boolean {
	return period === 'annual' || source === 'yahoo' || FMP_SUPPORTS_TTM;
}

export function effectivePeriod(source: Source, period: Period): Period {
	return periodAvailable(source, period) ? period : 'annual';
}
```

In `src/lib/financials-nav.ts`:
1. Add near the top, below the existing imports: `import { parseSource } from './source';` and `import type { Source } from './source';`.
2. Change `Nav` to
```ts
export interface Nav {
	tab: Tab;
	statement: StatementId;
	period: Period;
	/** The source the visitor asked for; the effective one also depends on the ticker (see `resolveSource`). */
	source?: Source;
}
```
3. `parseNav` becomes
```ts
export function parseNav(params: URLSearchParams): Nav {
	const source = parseSource(params.get('source'));
	return {
		tab: pick(TABS, params.get('tab'), 'financials'),
		statement: pick(STATEMENTS, params.get('statement'), 'income'),
		period: pick(PERIODS, params.get('period'), 'annual'),
		...(source ? { source } : {})
	};
}
```
4. In `navHref`, after `sp.set('period', nav.period);` add `if (nav.source) sp.set('source', nav.source);`.

(`loginAction` and `afterLogin` already build on `navHref`/`parseNav`, so they carry the parameter.)

- [ ] **Step 4: Run to verify pass**

Run: `vitest run src/lib/source.test.ts src/lib/financials-nav.test.ts` then the full suite `vitest run`.
Expected: PASS. Then `svelte-kit sync` and `svelte-check`: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/source.ts src/lib/source.test.ts src/lib/financials-nav.ts src/lib/financials-nav.test.ts
git commit -m "feat: source rules and the source URL parameter

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Yahoo parsers

**Files:**
- Modify: `src/lib/server/fmp-info.ts` (export two helpers)
- Create: `src/lib/server/yahoo-parse.ts`, `src/lib/server/yahoo-parse.test.ts`

**Interfaces:**
- Consumes: `FmpError`, `Kind`, `Statement`, `StatementYear` (`./fmp`); `PricePoint`, `Profile`, `NewsItem` (`./fmp-info`); `safeUrl` (`../safe-url`); `Period` (`../financials-nav`).
- Produces: `str`, `num` exported from `fmp-info.ts`; from `yahoo-parse.ts`: `toDate(value: unknown): Date | null`; `parseYahooPrices(quotes: unknown, gmtoffsetSeconds = 0): PricePoint[]`; `parseYahooProfile(summary: unknown): Profile | null`; `parseYahooNews(items: unknown): NewsItem[]`; `parseYahooStatement(kind: Kind, annual: unknown, trailing: unknown, period: Period, currency: string | null): Statement`; `KEY_LINES`. All parse functions throw `FmpError('unavailable', 'Unexpected response from Yahoo Finance')` when the input is not an array (profile: not an object).

- [ ] **Step 1: Write the failing tests**

`src/lib/server/yahoo-parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FmpError } from './fmp';
import {
	parseYahooNews,
	parseYahooPrices,
	parseYahooProfile,
	parseYahooStatement,
	toDate
} from './yahoo-parse';

describe('toDate', () => {
	it('reads Dates, epoch seconds, epoch milliseconds and ISO strings', () => {
		const iso = '2025-12-31T00:00:00.000Z';
		expect(toDate(new Date(iso))?.toISOString()).toBe(iso);
		expect(toDate(1767139200)?.toISOString()).toBe(iso);
		expect(toDate(1767139200000)?.toISOString()).toBe(iso);
		expect(toDate(iso)?.toISOString()).toBe(iso);
	});
	it('returns null for anything else', () => {
		for (const v of [null, undefined, '', 'soon', NaN, {}]) expect(toDate(v), String(v)).toBeNull();
	});
});

describe('parseYahooPrices', () => {
	const q = (date: string, close: number | null, volume: number | null = 1000) => ({
		date: new Date(date),
		open: 1,
		close,
		volume
	});
	it('maps quotes to dated closes, oldest first', () => {
		expect(parseYahooPrices([q('2026-10-23T08:00:00Z', 39.5, 10), q('2026-10-22T08:00:00Z', 39.1, null)])).toEqual([
			{ date: '2026-10-22', close: 39.1, volume: null },
			{ date: '2026-10-23', close: 39.5, volume: 10 }
		]);
	});
	it('drops quotes without a close and keeps one point per date (last wins)', () => {
		const points = parseYahooPrices([
			q('2026-10-22T08:00:00Z', 1),
			q('2026-10-22T16:00:00Z', 2),
			q('2026-10-23T08:00:00Z', null),
			null,
			'x'
		]);
		expect(points).toEqual([{ date: '2026-10-22', close: 2, volume: 1000 }]);
	});
	it('dates a quote in the exchange timezone', () => {
		// Sydney opens at 10:00 local on 27 October, which is 23:00 UTC on the 26th
		const quotes = [q('2026-10-26T23:00:00Z', 5)];
		expect(parseYahooPrices(quotes)[0].date).toBe('2026-10-26');
		expect(parseYahooPrices(quotes, 39600)[0].date).toBe('2026-10-27');
	});
	it('returns [] for an empty list and rejects other shapes', () => {
		expect(parseYahooPrices([])).toEqual([]);
		expect(() => parseYahooPrices({ nope: 1 })).toThrowError(FmpError);
	});
});

describe('parseYahooProfile', () => {
	const summary = {
		assetProfile: {
			sector: 'Financial Services',
			industry: 'Banks - Diversified',
			country: 'Netherlands',
			website: 'https://www.abnamro.com',
			fullTimeEmployees: 22905,
			longBusinessSummary: 'ABN AMRO provides banking.',
			companyOfficers: [
				{ name: 'A. CFO', title: 'Chief Financial Officer' },
				{ name: 'M. Boss', title: 'Chief Executive Officer & Chairman' }
			]
		},
		price: {
			longName: 'ABN AMRO Bank N.V.',
			shortName: 'ABN AMRO',
			exchangeName: 'Amsterdam',
			currency: 'EUR',
			regularMarketPrice: 39.74,
			marketCap: 32_385_548_288
		}
	};
	it('maps the profile fields', () => {
		expect(parseYahooProfile(summary)).toEqual({
			name: 'ABN AMRO Bank N.V.',
			exchange: 'Amsterdam',
			sector: 'Financial Services',
			industry: 'Banks - Diversified',
			country: 'Netherlands',
			ceo: 'M. Boss',
			website: 'https://www.abnamro.com/',
			ipoDate: null,
			currency: 'EUR',
			description: 'ABN AMRO provides banking.',
			employees: 22905,
			price: 39.74,
			marketCap: 32_385_548_288,
			beta: null
		});
	});
	it('copes with missing modules and officers', () => {
		const p = parseYahooProfile({ price: { shortName: 'X' } })!;
		expect(p.name).toBe('X');
		expect(p.ceo).toBeNull();
		expect(p.website).toBeNull();
	});
	it('drops an unsafe website', () => {
		expect(parseYahooProfile({ assetProfile: { website: 'javascript:alert(1)', sector: 'S' } })!.website).toBeNull();
	});
	it('returns null when nothing usable is there and rejects non-objects', () => {
		expect(parseYahooProfile({})).toBeNull();
		expect(() => parseYahooProfile(null)).toThrowError(FmpError);
		expect(() => parseYahooProfile('x')).toThrowError(FmpError);
	});
});

describe('parseYahooNews', () => {
	it('maps items, formats the time and keeps safe links only', () => {
		const items = parseYahooNews([
			{ title: 'Dutch state dilutes ABN', publisher: 'RBI', link: 'https://finance.yahoo.com/news/a', providerPublishTime: new Date('2026-10-25T14:30:00Z') },
			{ title: 'Epoch time', publisher: 'X', link: 'javascript:alert(1)', providerPublishTime: 1767139200 },
			{ title: '', link: 'https://x.test' },
			{ publisher: 'no title' },
			null
		]);
		expect(items).toEqual([
			{ title: 'Dutch state dilutes ABN', publisher: 'RBI', date: '2026-10-25 14:30:00', text: null, url: 'https://finance.yahoo.com/news/a' },
			{ title: 'Epoch time', publisher: 'X', date: '2025-12-31 00:00:00', text: null, url: null }
		]);
	});
	it('returns [] for an empty list and rejects other shapes', () => {
		expect(parseYahooNews([])).toEqual([]);
		expect(() => parseYahooNews(undefined)).toThrowError(FmpError);
	});
});

describe('parseYahooStatement', () => {
	const row = (year: number, extra: Record<string, unknown>) => ({
		TYPE: 'FINANCIALS',
		date: new Date(`${year}-12-31T00:00:00Z`),
		periodType: '12M',
		operatingExpense: year,
		...extra
	});
	const annual = [
		row(2023, { totalRevenue: 100, netIncome: 10, dilutedEPS: 1.1 }),
		row(2025, { totalRevenue: 130, netIncome: 14, dilutedEPS: 1.5, interestIncome: 40 }),
		row(2024, { totalRevenue: 115, netIncome: 12, dilutedEPS: 1.3 })
	];
	const trailing = [
		{ TYPE: 'FINANCIALS', date: 1759190400, periodType: 'TTM', totalRevenue: 110, netIncome: 11 },
		{ TYPE: 'FINANCIALS', date: 1767139200, periodType: 'TTM', totalRevenue: 120, netIncome: 13 }
	];

	it('lists key lines first, then the rest in Yahoo order, newest year first', () => {
		const s = parseYahooStatement('income', annual, null, 'annual', 'EUR');
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2025', '2024', '2023']);
		expect(s.years[0].date).toBe('2025-12-31');
		expect(s.years[0].currency).toBe('EUR');
		expect(s.lines).toEqual(['totalRevenue', 'netIncome', 'dilutedEPS', 'operatingExpense', 'interestIncome']);
		expect(s.years[0].values.totalRevenue).toBe(130);
		expect(s.years[2].values.interestIncome).toBeUndefined();
	});
	it('leaves out metadata and non-numeric fields', () => {
		const s = parseYahooStatement('income', [row(2025, { totalRevenue: 1, note: 'x', junk: null })], null, 'annual', null);
		expect(s.lines).not.toContain('TYPE');
		expect(s.lines).not.toContain('periodType');
		expect(s.lines).not.toContain('date');
		expect(s.lines).not.toContain('note');
		expect(s.lines).not.toContain('junk');
		expect(s.years[0].currency).toBeNull();
	});
	it('keeps at most five years', () => {
		const rows = [2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => row(y, { totalRevenue: y }));
		const s = parseYahooStatement('income', rows, null, 'annual', null);
		expect(s.years.map((y) => y.fiscalYear)).toEqual(['2025', '2024', '2023', '2022', '2021']);
	});
	it('uses only the newest trailing point for TTM income and cash flow', () => {
		const s = parseYahooStatement('income', [], trailing, 'ttm', 'EUR');
		expect(s.years).toHaveLength(1);
		expect(s.years[0].date).toBe('2025-12-31');
		expect(s.years[0].values.totalRevenue).toBe(120);
		const cf = parseYahooStatement('cashflow', [], [{ date: 1767139200, operatingCashFlow: 5 }], 'ttm', null);
		expect(cf.lines).toEqual(['operatingCashFlow']);
	});
	it('uses the latest annual balance sheet for TTM', () => {
		const balance = [
			{ date: new Date('2024-12-31T00:00:00Z'), totalAssets: 1 },
			{ date: new Date('2025-12-31T00:00:00Z'), totalAssets: 2, totalDebt: 3 }
		];
		const s = parseYahooStatement('balance', balance, null, 'ttm', null);
		expect(s.years).toHaveLength(1);
		expect(s.years[0].values.totalAssets).toBe(2);
		expect(s.lines).toEqual(['totalAssets', 'totalDebt']);
	});
	it('returns an empty statement when there are no rows, and rejects other shapes', () => {
		expect(parseYahooStatement('income', [], null, 'annual', null)).toEqual({ lines: [], years: [] });
		expect(() => parseYahooStatement('income', { nope: 1 }, null, 'annual', null)).toThrowError(FmpError);
		expect(() => parseYahooStatement('income', [], { nope: 1 }, 'ttm', null)).toThrowError(FmpError);
	});
	it('skips rows without a usable date', () => {
		const s = parseYahooStatement('income', [{ date: 'soon', totalRevenue: 1 }, row(2025, { totalRevenue: 2 })], null, 'annual', null);
		expect(s.years).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vitest run src/lib/server/yahoo-parse.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

In `src/lib/server/fmp-info.ts` change `const str =` to `export const str =` and `const num =` to `export const num =` (no other change).

`src/lib/server/yahoo-parse.ts`:

```ts
// src/lib/server/yahoo-parse.ts
import type { Period } from '../financials-nav';
import { safeUrl } from '../safe-url';
import { FmpError } from './fmp';
import type { Kind, Statement, StatementYear } from './fmp';
import { num, str } from './fmp-info';
import type { NewsItem, PricePoint, Profile } from './fmp-info';

const unexpected = () => new FmpError('unavailable', 'Unexpected response from Yahoo Finance');

/** Yahoo gives Date objects, epoch seconds or ISO strings depending on the call. */
export function toDate(value: unknown): Date | null {
	let date: Date | null = null;
	if (value instanceof Date) date = value;
	else if (typeof value === 'number' && Number.isFinite(value)) date = new Date(value < 1e11 ? value * 1000 : value);
	else if (typeof value === 'string' && value.trim() !== '') date = new Date(value);
	return date && !Number.isNaN(date.getTime()) ? date : null;
}

const isoDate = (date: Date, offsetSeconds = 0): string =>
	new Date(date.getTime() + offsetSeconds * 1000).toISOString().slice(0, 10);

const records = (body: unknown): Record<string, unknown>[] => {
	if (!Array.isArray(body)) throw unexpected();
	return body.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object');
};

/** Daily closes from `chart().quotes`; `gmtoffsetSeconds` (from `chart().meta`) puts each quote on its exchange-local date. */
export function parseYahooPrices(quotes: unknown, gmtoffsetSeconds = 0): PricePoint[] {
	const byDate = new Map<string, PricePoint>();
	for (const rec of records(quotes)) {
		const when = toDate(rec.date);
		const close = num(rec.close);
		if (!when || close === null) continue;
		const date = isoDate(when, gmtoffsetSeconds);
		byDate.set(date, { date, close, volume: num(rec.volume) });
	}
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function parseYahooProfile(summary: unknown): Profile | null {
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw unexpected();
	const { assetProfile, price } = summary as { assetProfile?: Record<string, unknown>; price?: Record<string, unknown> };
	const a = assetProfile ?? {};
	const p = price ?? {};
	const officers = Array.isArray(a.companyOfficers) ? (a.companyOfficers as Record<string, unknown>[]) : [];
	const ceo = officers.find((o) => o && typeof o.title === 'string' && /\bceo\b|chief executive/i.test(o.title));
	const profile: Profile = {
		name: str(p.longName) ?? str(p.shortName),
		exchange: str(p.exchangeName),
		sector: str(a.sector),
		industry: str(a.industry),
		country: str(a.country),
		ceo: str(ceo?.name),
		website: safeUrl(a.website),
		ipoDate: null,
		currency: str(p.currency),
		description: str(a.longBusinessSummary),
		employees: num(a.fullTimeEmployees),
		price: num(p.regularMarketPrice),
		marketCap: num(p.marketCap),
		beta: null
	};
	return Object.values(profile).every((v) => v === null) ? null : profile;
}

/** News from `search().news`. Yahoo has no summary text, so `text` is always null. */
export function parseYahooNews(items: unknown): NewsItem[] {
	const news: NewsItem[] = [];
	for (const rec of records(items)) {
		const title = str(rec.title);
		if (!title) continue;
		const when = toDate(rec.providerPublishTime);
		news.push({
			title,
			publisher: str(rec.publisher),
			date: when ? when.toISOString().replace('T', ' ').slice(0, 19) : null,
			text: null,
			url: safeUrl(rec.link)
		});
	}
	return news;
}

/** Lines shown first, in this order, when the company reports them. */
export const KEY_LINES: Record<Kind, string[]> = {
	income: ['totalRevenue', 'grossProfit', 'operatingIncome', 'ebitda', 'netIncome', 'dilutedEPS'],
	balance: ['totalAssets', 'totalLiabilitiesNetMinorityInterest', 'stockholdersEquity', 'cashAndCashEquivalents', 'totalDebt'],
	cashflow: ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'capitalExpenditure', 'freeCashFlow']
};

const META = new Set(['TYPE', 'periodType', 'date', 'symbol', 'currencyCode']);
const MAX_YEARS = 5;

function toYear(row: Record<string, unknown>, currency: string | null): StatementYear | null {
	const when = toDate(row.date);
	if (!when) return null;
	const values: Record<string, number | null> = {};
	for (const [key, value] of Object.entries(row)) {
		if (META.has(key)) continue;
		const n = num(value);
		if (n !== null) values[key] = n;
	}
	return { fiscalYear: String(when.getUTCFullYear()), date: isoDate(when), currency, values };
}

function newestFirst(rows: Record<string, unknown>[], currency: string | null): StatementYear[] {
	const byDate = new Map<string, StatementYear>();
	for (const row of rows) {
		const year = toYear(row, currency);
		if (year) byDate.set(year.date, year);
	}
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * A Yahoo `fundamentalsTimeSeries` result as a `Statement`. TTM takes the newest trailing point
 * (income, cash flow) or the latest annual one (balance sheet, which has no trailing series).
 */
export function parseYahooStatement(
	kind: Kind,
	annual: unknown,
	trailing: unknown,
	period: Period,
	currency: string | null
): Statement {
	const years =
		period === 'ttm'
			? newestFirst(records(kind === 'balance' ? annual : trailing), currency).slice(0, 1)
			: newestFirst(records(annual), currency).slice(0, MAX_YEARS);

	const present = new Set<string>();
	for (const year of years) for (const key of Object.keys(year.values)) present.add(key);
	const key = KEY_LINES[kind].filter((k) => present.has(k));
	return { lines: [...key, ...[...present].filter((k) => !key.includes(k))], years };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `vitest run src/lib/server/yahoo-parse.test.ts` then the full suite.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/fmp-info.ts src/lib/server/yahoo-parse.ts src/lib/server/yahoo-parse.test.ts
git commit -m "feat: parse Yahoo Finance prices, profile, news and statements

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Yahoo client

**Files:**
- Modify: `package.json`, `package-lock.json` (dependency); `docs/superpowers/specs/2026-10-27-yahoo-source-design.md` (one line)
- Create: `src/lib/server/yahoo.ts`, `src/lib/server/yahoo.test.ts`

**Interfaces:**
- Consumes: parsers from Task 2; `FmpError`, `Kind`, `Statement`; `PricePoint`, `Profile`, `NewsItem`, `NEWS_LIMIT`, `str` from `./fmp-info`; `Period`.
- Produces: `interface YahooClient`; `defaultClient(): Promise<YahooClient>`; `fetchYahooPrices(symbol, from, to, client?): Promise<PricePoint[]>`; `fetchYahooProfile(symbol, client?): Promise<Profile | null>`; `fetchYahooNews(symbol, client?): Promise<NewsItem[]>`; `fetchYahooStatement(kind, symbol, period, client?): Promise<Statement>`. Not-found answers become empty results; rate limits become `FmpError('limit')`; everything else `FmpError('unavailable')` with a fixed message.

- [ ] **Step 1: Install the dependency and check two library facts**

Run: `npx -y node@24 "$(dirname $(readlink -f $(which npm)))/../bin/npm-cli.js" install --save-exact yahoo-finance2@4.0.5`
Expected: `package.json` gains `"yahoo-finance2": "4.0.5"` under `dependencies`.

Then, in a scratch directory outside the repo that has `yahoo-finance2` installed (a probe directory exists at `/private/tmp/claude-501/-Users-jrm-Projects/576e1ee9-fed8-40ee-9889-e93dc5e87bd3/scratchpad/yf-probe`; reinstall there if missing), run a one-off script that prints (a) `Object.keys((await yf.chart('ABN.AS', {period1: new Date(Date.now()-5*864e5), interval: '1d'})).meta)` and whether `gmtoffset` is among them, and (b) the keys of `(await yf.quoteSummary('ABN.AS', {modules: ['financialData']})).financialData` and whether `financialCurrency` is among them. Put the result in your report. If `gmtoffset` is missing, use `meta.exchangeTimezoneName` to compute the offset instead (note it in the report and adapt `fetchYahooPrices`); if `financialCurrency` is missing, fall back to `price.currency` only.

- [ ] **Step 2: Write the failing tests**

`src/lib/server/yahoo.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { FmpError } from './fmp';
import {
	fetchYahooNews,
	fetchYahooPrices,
	fetchYahooProfile,
	fetchYahooStatement,
	type YahooClient
} from './yahoo';

const fake = (overrides: Partial<YahooClient> = {}): YahooClient => ({
	chart: vi.fn(async () => ({ meta: { gmtoffset: 3600 }, quotes: [{ date: new Date('2026-10-23T08:00:00Z'), close: 39.5, volume: 10 }] })),
	quoteSummary: vi.fn(async (_s: string, o: { modules: string[] }) =>
		o.modules.includes('assetProfile')
			? { assetProfile: { sector: 'Financial Services' }, price: { longName: 'ABN AMRO Bank N.V.', currency: 'EUR' } }
			: { financialData: { financialCurrency: 'EUR' }, price: { longName: 'ABN AMRO Bank N.V.', currency: 'EUR' } }
	),
	search: vi.fn(async () => ({ news: [{ title: 'Headline', publisher: 'RBI', link: 'https://finance.yahoo.com/n/1', providerPublishTime: new Date('2026-10-25T14:30:00Z') }] })),
	fundamentalsTimeSeries: vi.fn(async (_s: string, o: { type: string }) =>
		o.type === 'annual'
			? [{ date: new Date('2025-12-31T00:00:00Z'), totalRevenue: 130, netIncome: 14 }]
			: [{ date: 1767139200, totalRevenue: 120, netIncome: 13 }]
	),
	...overrides
});

describe('fetchYahooPrices', () => {
	it('asks for daily quotes over the window, without strict result validation', async () => {
		const client = fake();
		const points = await fetchYahooPrices('ABN.AS', '2025-10-26', '2026-10-26', client);
		expect(points).toEqual([{ date: '2026-10-23', close: 39.5, volume: 10 }]);
		const [symbol, options, moduleOptions] = vi.mocked(client.chart).mock.calls[0];
		expect(symbol).toBe('ABN.AS');
		expect(options.interval).toBe('1d');
		expect(options.period1.toISOString().slice(0, 10)).toBe('2025-10-26');
		expect(options.period2.toISOString().slice(0, 10)).toBe('2026-10-26');
		expect(moduleOptions).toEqual({ validateResult: false });
	});
	it('puts quotes on the exchange-local date', async () => {
		const client = fake({
			chart: vi.fn(async () => ({ meta: { gmtoffset: 39600 }, quotes: [{ date: new Date('2026-10-26T23:00:00Z'), close: 5, volume: 1 }] }))
		});
		expect((await fetchYahooPrices('BHP.AX', '2026-10-01', '2026-10-27', client))[0].date).toBe('2026-10-27');
	});
});

describe('fetchYahooProfile', () => {
	it('reads the asset profile and price modules', async () => {
		const client = fake();
		const profile = await fetchYahooProfile('ABN.AS', client);
		expect(profile?.name).toBe('ABN AMRO Bank N.V.');
		expect(profile?.sector).toBe('Financial Services');
		const [, options, moduleOptions] = vi.mocked(client.quoteSummary).mock.calls[0];
		expect(options.modules).toEqual(['assetProfile', 'price']);
		expect(moduleOptions).toEqual({ validateResult: false });
	});
});

describe('fetchYahooNews', () => {
	it('searches by company name, falling back to the ticker', async () => {
		const client = fake();
		const items = await fetchYahooNews('ABN.AS', client);
		expect(items).toHaveLength(1);
		expect(vi.mocked(client.search).mock.calls[0][0]).toBe('ABN AMRO Bank N.V.');
		expect(vi.mocked(client.search).mock.calls[0][1]).toEqual({ newsCount: 20, quotesCount: 0 });

		const noName = fake({ quoteSummary: vi.fn(async () => { throw new Error('boom'); }) });
		await fetchYahooNews('ABN.AS', noName);
		expect(vi.mocked(noName.search).mock.calls[0][0]).toBe('ABN.AS');
	});
	it('returns [] when Yahoo has no news', async () => {
		expect(await fetchYahooNews('X.AS', fake({ search: vi.fn(async () => ({})) }))).toEqual([]);
	});
});

describe('fetchYahooStatement', () => {
	it('fetches the annual series and the reporting currency', async () => {
		const client = fake();
		const s = await fetchYahooStatement('income', 'ABN.AS', 'annual', client);
		expect(s.years[0].values.totalRevenue).toBe(130);
		expect(s.years[0].currency).toBe('EUR');
		expect(vi.mocked(client.fundamentalsTimeSeries)).toHaveBeenCalledTimes(1);
		const [, options, moduleOptions] = vi.mocked(client.fundamentalsTimeSeries).mock.calls[0];
		expect(options).toMatchObject({ type: 'annual', module: 'financials' });
		expect(moduleOptions).toEqual({ validateResult: false });
	});
	it('uses the trailing series, and only that, for TTM income and cash flow', async () => {
		const client = fake();
		const s = await fetchYahooStatement('cashflow', 'ABN.AS', 'ttm', client);
		expect(s.years[0].values.totalRevenue).toBe(120);
		const calls = vi.mocked(client.fundamentalsTimeSeries).mock.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0][1]).toMatchObject({ type: 'trailing', module: 'cash-flow' });
	});
	it('uses only the annual series for the TTM balance sheet', async () => {
		const client = fake();
		await fetchYahooStatement('balance', 'ABN.AS', 'ttm', client);
		const calls = vi.mocked(client.fundamentalsTimeSeries).mock.calls;
		expect(calls).toHaveLength(1);
		expect(calls[0][1]).toMatchObject({ type: 'annual', module: 'balance-sheet' });
	});
	it('carries on without a currency when the lookup fails', async () => {
		const client = fake({ quoteSummary: vi.fn(async () => { throw new Error('boom'); }) });
		expect((await fetchYahooStatement('income', 'ABN.AS', 'annual', client)).years[0].currency).toBeNull();
	});
});

describe('errors', () => {
	const failing = (error: Error) => fake({
		chart: vi.fn(async () => { throw error; }),
		quoteSummary: vi.fn(async () => { throw error; }),
		fundamentalsTimeSeries: vi.fn(async () => { throw error; })
	});
	it('turns not-found answers into empty results', async () => {
		const client = failing(new Error('Quote not found for symbol: NOPE'));
		expect(await fetchYahooPrices('NOPE', '2025-10-26', '2026-10-26', client)).toEqual([]);
		expect(await fetchYahooProfile('NOPE', client)).toBeNull();
		expect(await fetchYahooStatement('income', 'NOPE', 'annual', client)).toEqual({ lines: [], years: [] });
		const delisted = failing(new Error('No data found, symbol may be delisted'));
		expect(await fetchYahooPrices('NOPE', '2025-10-26', '2026-10-26', delisted)).toEqual([]);
	});
	it('maps rate limits and everything else to FmpError kinds', async () => {
		const limited = await fetchYahooPrices('X', '2025-10-26', '2026-10-26', failing(new Error('HTTP 429 Too Many Requests'))).catch((e: unknown) => e);
		expect(limited).toBeInstanceOf(FmpError);
		expect((limited as FmpError).kind).toBe('limit');
		const broken = await fetchYahooProfile('X', failing(new Error('fetch failed https://query1.finance.yahoo.com/v7?crumb=SECRET'))).catch((e: unknown) => e);
		expect(broken).toBeInstanceOf(FmpError);
		expect((broken as FmpError).kind).toBe('unavailable');
		expect((broken as Error).message).not.toMatch(/https?:|crumb|SECRET/);
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `vitest run src/lib/server/yahoo.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 4: Implement**

`src/lib/server/yahoo.ts`:

```ts
// src/lib/server/yahoo.ts
import type { Period } from '../financials-nav';
import { FmpError } from './fmp';
import type { Kind, Statement } from './fmp';
import { NEWS_LIMIT, str } from './fmp-info';
import type { NewsItem, PricePoint, Profile } from './fmp-info';
import { parseYahooNews, parseYahooPrices, parseYahooProfile, parseYahooStatement } from './yahoo-parse';

type ModuleOptions = { validateResult: boolean };
type StatementModule = 'financials' | 'balance-sheet' | 'cash-flow';

/** The few `yahoo-finance2` calls we use, so tests can pass a fake. Results are `unknown` on purpose: our parsers validate them. */
export interface YahooClient {
	chart(
		symbol: string,
		options: { period1: Date; period2: Date; interval: '1d' },
		moduleOptions?: ModuleOptions
	): Promise<{ meta?: { gmtoffset?: number }; quotes: unknown }>;
	quoteSummary(symbol: string, options: { modules: string[] }, moduleOptions?: ModuleOptions): Promise<unknown>;
	search(
		query: string,
		options: { newsCount: number; quotesCount: number },
		moduleOptions?: ModuleOptions
	): Promise<{ news?: unknown }>;
	fundamentalsTimeSeries(
		symbol: string,
		options: { period1: Date; type: 'annual' | 'trailing'; module: StatementModule },
		moduleOptions?: ModuleOptions
	): Promise<unknown>;
}

// Our parsers check every field, so the library's own (strict, often outdated) result validation stays off.
const OPTIONS: ModuleOptions = { validateResult: false };
const MODULES: Record<Kind, StatementModule> = { income: 'financials', balance: 'balance-sheet', cashflow: 'cash-flow' };

let shared: Promise<YahooClient> | undefined;

/** One client per server instance, created on first use so other pages never load the library. */
export function defaultClient(): Promise<YahooClient> {
	shared ??= import('yahoo-finance2').then(
		({ default: YahooFinance }) =>
			new YahooFinance({
				suppressNotices: ['yahooSurvey'],
				logger: { info() {}, warn() {}, error() {}, debug() {}, dir() {} }
			}) as unknown as YahooClient
	);
	return shared;
}

const NOT_FOUND = /not found|no data found|no fundamentals|delisted|invalid symbol/i;
const RATE_LIMITED = /429|too many requests/i;

/** Fixed messages only: library errors can carry URLs and tokens. */
function mapError(error: unknown): FmpError {
	if (error instanceof FmpError) return error;
	const text = error instanceof Error ? `${error.name} ${error.message}` : '';
	if (RATE_LIMITED.test(text)) return new FmpError('limit', 'Yahoo Finance rate limit reached');
	return new FmpError('unavailable', 'Yahoo Finance is unavailable');
}

async function tolerant<T>(run: () => Promise<T>, empty: T): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof Error && NOT_FOUND.test(error.message)) return empty;
		throw mapError(error);
	}
}

export function fetchYahooPrices(symbol: string, from: string, to: string, client?: YahooClient): Promise<PricePoint[]> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		const result = await c.chart(
			symbol,
			{ period1: new Date(`${from}T00:00:00Z`), period2: new Date(`${to}T23:59:59Z`), interval: '1d' },
			OPTIONS
		);
		return parseYahooPrices(result.quotes, result.meta?.gmtoffset ?? 0);
	}, []);
}

export function fetchYahooProfile(symbol: string, client?: YahooClient): Promise<Profile | null> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		return parseYahooProfile(await c.quoteSummary(symbol, { modules: ['assetProfile', 'price'] }, OPTIONS));
	}, null);
}

/** Yahoo's news is a text search, so search for the company name; the bare ticker finds little outside the US. */
export function fetchYahooNews(symbol: string, client?: YahooClient): Promise<NewsItem[]> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		let query = symbol;
		try {
			const summary = (await c.quoteSummary(symbol, { modules: ['price'] }, OPTIONS)) as {
				price?: { longName?: unknown; shortName?: unknown };
			};
			query = str(summary.price?.longName) ?? str(summary.price?.shortName) ?? symbol;
		} catch {
			// the ticker is a fine fallback query
		}
		const result = await c.search(query, { newsCount: NEWS_LIMIT, quotesCount: 0 }, OPTIONS);
		return parseYahooNews(result.news ?? []);
	}, []);
}

async function reportingCurrency(c: YahooClient, symbol: string): Promise<string | null> {
	try {
		const s = (await c.quoteSummary(symbol, { modules: ['financialData', 'price'] }, OPTIONS)) as {
			financialData?: { financialCurrency?: unknown };
			price?: { currency?: unknown };
		};
		return str(s.financialData?.financialCurrency) ?? str(s.price?.currency);
	} catch {
		return null;
	}
}

export function fetchYahooStatement(kind: Kind, symbol: string, period: Period, client?: YahooClient): Promise<Statement> {
	return tolerant(async () => {
		const c = client ?? (await defaultClient());
		const module = MODULES[kind];
		const year = new Date().getUTCFullYear();
		// TTM income and cash flow come from the trailing series; the balance sheet has none and uses the latest annual one
		const wantsTrailing = period === 'ttm' && kind !== 'balance';
		const annual = wantsTrailing
			? []
			: await c.fundamentalsTimeSeries(symbol, { period1: new Date(Date.UTC(year - 7, 0, 1)), type: 'annual', module }, OPTIONS);
		const trailing = wantsTrailing
			? await c.fundamentalsTimeSeries(symbol, { period1: new Date(Date.UTC(year - 2, 0, 1)), type: 'trailing', module }, OPTIONS)
			: null;
		return parseYahooStatement(kind, annual, trailing, period, await reportingCurrency(c, symbol));
	}, { lines: [], years: [] });
}
```

In `docs/superpowers/specs/2026-10-27-yahoo-source-design.md`, in the Testing list, change "`validateResult: false` only for trailing" to "`validateResult: false` on every call (our parsers do the validation)"; in the Components list change the same idea if it appears.

- [ ] **Step 5: Run to verify pass**

Run: `vitest run src/lib/server/yahoo.test.ts`, then the full suite, `svelte-kit sync && svelte-check` (0 errors) and `vite build` (the library must not break the build).
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/server/yahoo.ts src/lib/server/yahoo.test.ts docs/superpowers/specs/2026-10-27-yahoo-source-design.md
git commit -m "feat: Yahoo Finance client behind an injectable interface

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Source-aware loader

**Files:**
- Modify: `src/lib/server/financials.ts`
- Modify: `src/lib/server/financials.test.ts`
- Create: `src/lib/server/financials-yahoo-cache.test.ts`

**Interfaces:**
- Consumes: `resolveSource`, `effectivePeriod`, `sourceLabel`, `Source` (Task 1); `fetchYahoo*` (Task 3).
- Produces: `interface SourceFetchers { statement: StatementFetcher; profile: ProfileFetcher; news: NewsFetcher; prices: PricesFetcher }`; `yahooFetchers: SourceFetchers` (cached); `loadFinancials` input gains `yahoo?: Partial<SourceFetchers>` and reads `nav.source`. `FinancialsView` is unchanged. Messages name the effective source.

- [ ] **Step 1: Write the failing tests**

In `src/lib/server/financials.test.ts` append a new `describe` (the file already imports `vi`, `Nav`, `FmpError`, `loadFinancials`, `StatementFetcher`, types `NewsItem`, `PricePoint`, `Profile`, `Statement`, and defines `statement`, `nav`, `base`; add `import type { SourceFetchers } from './financials';` to the imports):

```ts
describe('sources', () => {
	const yahooStatement: Statement = {
		lines: ['totalRevenue'],
		years: [{ fiscalYear: '2025', date: '2025-12-31', currency: 'EUR', values: { totalRevenue: 9_000_000_000 } }]
	};
	const yahooPoints: PricePoint[] = [{ date: '2026-10-23', close: 39.5, volume: 10 }];
	const fakes = () => ({
		fmp: {
			fetcher: vi.fn<StatementFetcher>().mockResolvedValue(statement),
			profileFetcher: vi.fn(),
			newsFetcher: vi.fn(),
			pricesFetcher: vi.fn()
		},
		yahoo: {
			statement: vi.fn<StatementFetcher>().mockResolvedValue(yahooStatement),
			profile: vi.fn().mockResolvedValue({ name: 'ABN AMRO' } as Profile),
			news: vi.fn().mockResolvedValue([] as NewsItem[]),
			prices: vi.fn().mockResolvedValue(yahooPoints)
		} satisfies SourceFetchers
	});

	it('serves a non-US ticker from Yahoo only, without an FMP key', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, rawSymbol: 'abn.as', apiKey: undefined, nav: { ...nav, tab: 'price' }, ...fmp, yahoo });
		expect(view).toEqual({ state: 'price', symbol: 'ABN.AS', points: yahooPoints, message: null });
		expect(yahoo.prices).toHaveBeenCalledWith('ABN.AS', '');
		expect(fmp.pricesFetcher).not.toHaveBeenCalled();
	});
	it('ignores source=fmp for a non-US ticker', async () => {
		const { fmp, yahoo } = fakes();
		await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, tab: 'company', source: 'fmp' }, ...fmp, yahoo });
		expect(yahoo.profile).toHaveBeenCalled();
		expect(fmp.profileFetcher).not.toHaveBeenCalled();
	});
	it('serves a US ticker from FMP by default and from Yahoo on request', async () => {
		const { fmp, yahoo } = fakes();
		await loadFinancials({ ...base, ...fmp, yahoo });
		expect(fmp.fetcher).toHaveBeenCalledTimes(1);
		expect(yahoo.statement).not.toHaveBeenCalled();
		await loadFinancials({ ...base, nav: { ...nav, source: 'yahoo' }, ...fmp, yahoo });
		expect(yahoo.statement).toHaveBeenCalledTimes(1);
		expect(fmp.fetcher).toHaveBeenCalledTimes(1);
	});
	it('needs the FMP key only for FMP views', async () => {
		const { fmp, yahoo } = fakes();
		expect(await loadFinancials({ ...base, apiKey: undefined, ...fmp, yahoo })).toEqual({ state: 'unconfigured' });
		const view = await loadFinancials({ ...base, apiKey: undefined, nav: { ...nav, source: 'yahoo' }, ...fmp, yahoo });
		expect(view.state).toBe('ready');
	});
	it('never asks FMP for TTM: the period becomes annual', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, nav: { ...nav, period: 'ttm' }, ...fmp, yahoo });
		expect(fmp.fetcher).toHaveBeenCalledWith('income', 'AAPL', 'KEY', 'annual');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.title).toBe('Income statement');
		expect(view.table?.columns[0].year).toBe('2024');
	});
	it('asks Yahoo for TTM when it is the source', async () => {
		const { fmp, yahoo } = fakes();
		const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, period: 'ttm' }, ...fmp, yahoo });
		expect(yahoo.statement).toHaveBeenCalledWith('income', 'ABN.AS', '', 'ttm');
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.table?.columns[0].year).toBe('TTM');
		expect(view.table?.currency).toBe('EUR');
	});
	it('still requires a session first, and a valid ticker', async () => {
		const { fmp, yahoo } = fakes();
		expect(await loadFinancials({ ...base, authed: false, rawSymbol: 'ABN.AS', ...fmp, yahoo })).toEqual({ state: 'locked' });
		expect(await loadFinancials({ ...base, rawSymbol: 'A.B&C', ...fmp, yahoo })).toEqual({ state: 'invalid' });
		expect(await loadFinancials({ ...base, rawSymbol: '', nav: { ...nav, source: 'yahoo' }, apiKey: undefined, ...fmp, yahoo })).toEqual({ state: 'idle' });
		expect(yahoo.statement).not.toHaveBeenCalled();
	});
	it('names the effective source in failure messages', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { fmp, yahoo } = fakes();
		yahoo.statement.mockRejectedValue(new FmpError('limit', 'x'));
		const view = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', ...fmp, yahoo });
		if (view.state !== 'ready') throw new Error('expected ready');
		expect(view.message).toBe('Yahoo Finance rate limit reached. Try again in a minute.');
		yahoo.profile.mockRejectedValue(new FmpError('unavailable', 'x'));
		const profile = await loadFinancials({ ...base, rawSymbol: 'ABN.AS', nav: { ...nav, tab: 'company' }, ...fmp, yahoo });
		if (profile.state !== 'profile') throw new Error('expected profile');
		expect(profile.message).toBe('Yahoo Finance is unavailable right now. Try again shortly.');
	});
});
```

`src/lib/server/financials-yahoo-cache.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./yahoo', () => ({
	fetchYahooPrices: vi.fn(async () => []),
	fetchYahooProfile: vi.fn(async () => null),
	fetchYahooNews: vi.fn(async () => []),
	fetchYahooStatement: vi.fn(async () => ({ lines: [], years: [] }))
}));

import { NEWS_TTL_MS, PRICES_TTL_MS, PROFILE_TTL_MS, yahooFetchers } from './financials';
import * as yahoo from './yahoo';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
	for (const fn of Object.values(yahoo)) vi.mocked(fn as () => unknown).mockClear();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('Yahoo caches', () => {
	it('keeps prices for 1 h, news for 15 min and the profile for 24 h, per symbol', async () => {
		await yahooFetchers.prices('YA.AS', '');
		await yahooFetchers.prices('YA.AS', '');
		await yahooFetchers.prices('YB.AS', '');
		expect(yahoo.fetchYahooPrices).toHaveBeenCalledTimes(2);
		await yahooFetchers.news('YA.AS', '');
		await yahooFetchers.profile('YA.AS', '');
		vi.setSystemTime(Date.now() + NEWS_TTL_MS + 1000);
		await yahooFetchers.news('YA.AS', '');
		await yahooFetchers.profile('YA.AS', '');
		await yahooFetchers.prices('YA.AS', '');
		expect(yahoo.fetchYahooNews).toHaveBeenCalledTimes(2);
		expect(yahoo.fetchYahooProfile).toHaveBeenCalledTimes(1);
		expect(yahoo.fetchYahooPrices).toHaveBeenCalledTimes(2);
		vi.setSystemTime(Date.now() + PRICES_TTL_MS);
		await yahooFetchers.prices('YA.AS', '');
		expect(yahoo.fetchYahooPrices).toHaveBeenCalledTimes(3);
		vi.setSystemTime(Date.now() + PROFILE_TTL_MS);
		await yahooFetchers.profile('YA.AS', '');
		expect(yahoo.fetchYahooProfile).toHaveBeenCalledTimes(2);
	});
	it('keeps statements apart per kind and period', async () => {
		await yahooFetchers.statement('income', 'YC.AS', '', 'annual');
		await yahooFetchers.statement('income', 'YC.AS', '', 'annual');
		await yahooFetchers.statement('income', 'YC.AS', '', 'ttm');
		await yahooFetchers.statement('balance', 'YC.AS', '', 'annual');
		expect(yahoo.fetchYahooStatement).toHaveBeenCalledTimes(3);
	});
	it('asks for a one-year price window ending today', async () => {
		await yahooFetchers.prices('YD.AS', '');
		expect(yahoo.fetchYahooPrices).toHaveBeenLastCalledWith('YD.AS', '2025-10-27', '2026-10-27');
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vitest run src/lib/server/financials.test.ts src/lib/server/financials-yahoo-cache.test.ts`
Expected: FAIL (`SourceFetchers`, `yahooFetchers`, source handling missing).

- [ ] **Step 3: Implement**

In `src/lib/server/financials.ts`:

1. Imports: add
```ts
import { effectivePeriod, resolveSource, sourceLabel } from '../source';
import type { Source } from '../source';
import { fetchYahooNews, fetchYahooPrices, fetchYahooProfile, fetchYahooStatement } from './yahoo';
```
2. After `PricesFetcher`, add:
```ts
/** One complete set of fetchers per source; a view uses exactly one set. */
export interface SourceFetchers {
	statement: StatementFetcher;
	profile: ProfileFetcher;
	news: NewsFetcher;
	prices: PricesFetcher;
}
```
3. After `cachedPrices`, add the Yahoo caches and fetchers (same lifetimes; the unused `apiKey` parameters are simply not declared):
```ts
const yahooStatementCache = createCache<Statement>({ ttlMs: 24 * 60 * 60 * 1000, now: () => Date.now() });
const yahooProfileCache = createCache<Profile | null>({ ttlMs: PROFILE_TTL_MS, now: () => Date.now() });
const yahooNewsCache = createCache<NewsItem[]>({ ttlMs: NEWS_TTL_MS, now: () => Date.now() });
const yahooPricesCache = createCache<PricePoint[]>({ ttlMs: PRICES_TTL_MS, now: () => Date.now() });

export const yahooFetchers: SourceFetchers = {
	statement: (kind, symbol, _apiKey, period) =>
		yahooStatementCache.get(`${kind}:${symbol}:${period}`, () => fetchYahooStatement(kind, symbol, period)),
	profile: (symbol) => yahooProfileCache.get(symbol, () => fetchYahooProfile(symbol)),
	news: (symbol) => yahooNewsCache.get(symbol, () => fetchYahooNews(symbol)),
	prices: (symbol) =>
		yahooPricesCache.get(symbol, () => {
			const { from, to } = oneYearWindow(new Date());
			return fetchYahooPrices(symbol, from, to);
		})
};
```
4. `messageFor` and `failure` take the source:
```ts
function messageFor(error: unknown, symbol: string, source: Source): string {
	const label = sourceLabel(source);
	if (error instanceof FmpError) {
		switch (error.kind) {
			case 'config':
				return 'The FMP key was not accepted. Check FMP_API_KEY.';
			case 'plan':
				return `${label} does not provide this for ${symbol} on your plan (${error.message}).`;
			case 'limit':
				return `${label} rate limit reached. Try again in a minute.`;
		}
	}
	return `${label} is unavailable right now. Try again shortly.`;
}

function failure(what: string, symbol: string, error: unknown, source: Source): string {
	console.error(`${sourceLabel(source)} ${what} for ${symbol} failed (${error instanceof FmpError ? error.kind : 'error'})`);
	return messageFor(error, symbol, source);
}
```
and give `loadProfile`, `loadNews`, `loadPrices` a trailing `source: Source` parameter passed into `failure(...)`.
5. Replace the body of `loadFinancials` from the first line down with:
```ts
export async function loadFinancials(input: {
	authed: boolean;
	nav: Nav;
	rawSymbol: string | null;
	apiKey: string | undefined;
	/** FMP fetchers (tests inject these). */
	fetcher?: StatementFetcher;
	profileFetcher?: ProfileFetcher;
	newsFetcher?: NewsFetcher;
	pricesFetcher?: PricesFetcher;
	/** Yahoo fetchers (tests inject these). */
	yahoo?: Partial<SourceFetchers>;
}): Promise<FinancialsView> {
	if (!input.authed) return { state: 'locked' };
	const symbol = parseSymbol(input.rawSymbol);
	const source = resolveSource(input.nav.source, symbol ?? '');
	// only FMP needs the key; Yahoo works without one
	if (source === 'fmp' && !input.apiKey) return { state: 'unconfigured' };
	if (!input.rawSymbol?.trim()) return { state: 'idle' };
	if (!symbol) return { state: 'invalid' };

	const apiKey = source === 'fmp' ? input.apiKey! : '';
	const fetchers: SourceFetchers =
		source === 'fmp'
			? {
					statement: input.fetcher ?? cachedFetcher,
					profile: input.profileFetcher ?? cachedProfile,
					news: input.newsFetcher ?? cachedNews,
					prices: input.pricesFetcher ?? cachedPrices
				}
			: { ...yahooFetchers, ...input.yahoo };
	if (input.nav.tab === 'company') return loadProfile(symbol, apiKey, fetchers.profile, source);
	if (input.nav.tab === 'news') return loadNews(symbol, apiKey, fetchers.news, source);
	if (input.nav.tab === 'price') return loadPrices(symbol, apiKey, fetchers.prices, source);

	const { statement: kind } = input.nav;
	// a source that cannot serve the period gets the annual view instead (FMP has no TTM on this plan)
	const period = effectivePeriod(source, input.nav.period);
	const title = statementTitle(kind, period);
	try {
		const table = buildTable(await fetchers.statement(kind, symbol, apiKey, period), period);
		if (table.columns.length === 0) {
			const what = period === 'ttm' ? 'trailing-twelve-month figures' : 'annual statements';
			return { state: 'ready', symbol, title, table: null, message: `No ${what} found for ${symbol}.` };
		}
		return { state: 'ready', symbol, title, table, message: null };
	} catch (error) {
		return { state: 'ready', symbol, title, table: null, message: failure(`${kind} ${period} statement`, symbol, error, source) };
	}
}
```
(Check the existing tests that assert the console message or order still hold; the previous unconfigured-before-idle ordering is preserved for FMP.)

- [ ] **Step 4: Run to verify pass**

Run: `vitest run src/lib/server` then the full suite, `svelte-kit sync && svelte-check`.
Expected: PASS. `svelte-check` may report errors in `+page.svelte` only if it uses a removed export; it should not (the view type is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/financials.ts src/lib/server/financials.test.ts src/lib/server/financials-yahoo-cache.test.ts
git commit -m "feat: one source per view in the financials loader

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Source switch, grayed TTM and labels on the page

**Files:**
- Modify: `src/lib/statements.ts`, `src/lib/statements.test.ts`
- Modify: `src/routes/financials/+page.svelte`

**Interfaces:**
- Consumes: `SOURCES`, `resolveSource`, `effectivePeriod`, `periodAvailable`, `isUsListing`, `sourceLabel` (Task 1); `Nav.source`.
- Produces: the page UI. No new exports.

- [ ] **Step 1: Write the failing test and fix `formatValue`**

Append to `src/lib/statements.test.ts` (match the file's existing import of `formatValue` and `describe/it/expect`; add `formatValue` to the import if missing):

```ts
describe('formatValue for Yahoo per-share keys', () => {
	it('shows EPS in whole currency units, whatever the key spelling', () => {
		expect(formatValue('dilutedEPS', 2.451)).toBe('2.45');
		expect(formatValue('basicEPS', 1)).toBe('1.00');
		expect(formatValue('epsdiluted', 2.45)).toBe('2.45');
		expect(formatValue('totalRevenue', 8_732_000_000)).toBe('8,732.0');
	});
});
```

Run: `vitest run src/lib/statements.test.ts` → FAIL (`dilutedEPS` formats as millions). In `src/lib/statements.ts` change the test in `formatValue` from `/^eps/i` to `/^eps|eps$/i`. Re-run → PASS.

- [ ] **Step 2: Edit the page**

In `src/routes/financials/+page.svelte`:

1. Script: extend the imports and add two derived values:
```ts
	import { SOURCES, effectivePeriod, isUsListing, periodAvailable, resolveSource, sourceLabel } from '#lib/source';
```
and after `const nav = $derived(data.nav);` add
```ts
	const source = $derived(resolveSource(nav.source, data.symbol));
	const period = $derived(effectivePeriod(source, nav.period));
```
2. In the ticker form, replace the hidden `period` input with
```svelte
				<input type="hidden" name="period" value={period} />
				{#if nav.source}<input type="hidden" name="source" value={nav.source} />{/if}
```
3. At the top of `<div class="content">` (before `{#if nav.tab === 'financials'}`) add:
```svelte
				{#if data.symbol}
					{#if isUsListing(data.symbol)}
						<nav class="source" aria-label="Data source">
							<span>Source</span>
							{#each SOURCES as s (s.id)}
								<a href={navHref({ ...nav, source: s.id }, data.symbol)} aria-current={source === s.id ? 'page' : undefined}>{s.label}</a>
							{/each}
						</nav>
					{:else}
						<p class="source-note">Source: {sourceLabel(source)}</p>
					{/if}
					{#if source === 'yahoo'}<p class="meta">Yahoo Finance data is unofficial and may be delayed.</p>{/if}
				{/if}
```
4. Replace the period toggle `{#each PERIODS ...}` block with:
```svelte
						{#each PERIODS as p (p.id)}
							{#if periodAvailable(source, p.id)}
								<a href={navHref({ ...nav, period: p.id }, data.symbol)} aria-current={period === p.id ? 'page' : undefined}>{p.label}</a>
							{:else}
								<span class="disabled" aria-disabled="true" title="Trailing twelve months is not available from {sourceLabel(source)}. Choose Yahoo Finance.">{p.label}</span>
							{/if}
						{/each}
```
5. Idle text: replace `Enter an FMP ticker to see its data.` with `Enter a ticker to see its data. US tickers work with FMP or Yahoo Finance; others, such as ABN.AS, use Yahoo Finance.`
6. In the news branch, directly under `<h2 class="symbol">{view.symbol}</h2>` add `{#if source === 'yahoo'}<p class="meta">Matched by company name, so some headlines may be only loosely related.</p>{/if}`.
7. Styles, before the `@media` block:
```css
	.source { display: flex; gap: 0.4rem; align-items: center; margin: 0 0 0.6rem; }
	.source a { padding: 0.25rem 0.7rem; border: 1px solid #ddd; border-radius: 0.3rem; text-decoration: none; color: inherit; }
	.source a[aria-current='page'] { background: #3730a3; border-color: #3730a3; color: #fff; }
	.source-note { margin: 0 0 0.6rem; font-weight: 600; }
	.period .disabled { padding: 0.45rem 0.8rem; color: #8a8a8a; background: #f3f3f3; cursor: not-allowed; }
```

- [ ] **Step 3: Verify on a production build**

Run `svelte-kit sync`, `svelte-check` (0 errors, 0 warnings), the full test run with coverage, `check-no-js`, `vite build`.

Then smoke-test with throwaway local credentials (never real ones): start `vite preview --port 4182` with `SITE_PASSWORD=localtestpw SESSION_SECRET=localtestsecretlocaltestsecret1234` in the environment, log in with `curl -c jar -X POST -H "origin: http://localhost:4182" -H "accept: text/html" -d password=localtestpw "localhost:4182/financials?/login"`, and fetch with `curl -b jar`:
- `/financials?symbol=AAPL&source=fmp&period=ttm` → the HTML contains `class="disabled"` and `aria-disabled="true"` for TTM, the source switch with FMP `aria-current`, and no `href` containing `period=ttm`.
- `/financials?symbol=AAPL&source=yahoo&period=ttm` → TTM is a link with `aria-current="page"`.
- `/financials?symbol=ABN.AS&tab=price` → contains `Source: Yahoo Finance` and no switch; with network access it also shows `Last close`. If Yahoo is unreachable from your machine, say so in the report (an error message is acceptable there).
Stop the preview server afterwards.

- [ ] **Step 4: Commit**

```bash
git add src/lib/statements.ts src/lib/statements.test.ts src/routes/financials/+page.svelte
git commit -m "feat: source switch and grayed-out TTM on the financials page

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Companies button for non-US rows, and docs

**Files:**
- Modify: `src/lib/yahoo.ts`, `src/lib/yahoo.test.ts`, `src/lib/companies.ts`, `src/lib/companies.test.ts`, `src/routes/companies/+page.svelte`
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-27-yahoo-source-design.md` (status line)

**Interfaces:**
- Consumes: `fmpSymbol` (existing, `companies.ts`), `parseSymbol`.
- Produces: `yahooSymbol(ticker: string): string | null` (in `src/lib/yahoo.ts`; `yahooQuote` keeps its behaviour and builds on it); `financialsLink(company: Pick<Company,'ticker'|'country'>): string | null` in `companies.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/yahoo.test.ts` (use its existing import style; add `yahooSymbol` to the import from `./yahoo`):

```ts
describe('yahooSymbol', () => {
	it('adds the Yahoo suffix for the exchange', () => {
		expect(yahooSymbol('ENXTAM:ABN')).toBe('ABN.AS');
		expect(yahooSymbol('XTRA:SAP')).toBe('SAP.DE');
		expect(yahooSymbol('TSE:7203')).toBe('7203.T');
	});
	it('writes US share classes with a dash and adds no suffix', () => {
		expect(yahooSymbol('NYSE:BRK.B')).toBe('BRK-B');
		expect(yahooSymbol('NasdaqGS:AAPL')).toBe('AAPL');
	});
	it('applies the Korean and Hong Kong fixes', () => {
		expect(yahooSymbol('KOSE:A005930')).toBe('005930.KS');
		expect(yahooSymbol('SEHK:5')).toBe('0005.HK');
	});
	it('returns null for unknown exchanges and malformed tickers', () => {
		expect(yahooSymbol('MARS:XYZ')).toBeNull();
		expect(yahooSymbol('NYSE')).toBeNull();
		expect(yahooSymbol('NYSE:A B')).toBeNull();
	});
	it('agrees with yahooQuote', () => {
		expect(yahooQuote('ENXTAM:ABN')).toBe('https://finance.yahoo.com/quote/ABN.AS');
	});
});
```

Append to `src/lib/companies.test.ts` (add `financialsLink` to the import from `./companies`):

```ts
describe('financialsLink', () => {
	const row = (ticker: string, country: string) => ({ ticker, country });
	it('links US exchange listings to FMP', () => {
		expect(financialsLink(row('NasdaqGS:AAPL', 'United States'))).toBe('/financials?symbol=AAPL');
		expect(financialsLink(row('NYSE:BRK.B', 'United States'))).toBe('/financials?symbol=BRK-B');
	});
	it('links mappable non-US rows to Yahoo', () => {
		expect(financialsLink(row('ENXTAM:ABN', 'Netherlands'))).toBe('/financials?symbol=ABN.AS&source=yahoo');
		expect(financialsLink(row('TSE:7203', 'Japan'))).toBe('/financials?symbol=7203.T&source=yahoo');
	});
	it('gives US OTC and other unmappable rows no link', () => {
		expect(financialsLink(row('OTCPK:CBDW', 'United States'))).toBeNull();
		expect(financialsLink(row('MARS:XYZ', 'Netherlands'))).toBeNull();
		expect(financialsLink(row('', 'Netherlands'))).toBeNull();
	});
	it('gives no link when the symbol would not pass the financials page (for example an ampersand)', () => {
		expect(financialsLink(row('NSEI:M&M', 'India'))).toBeNull();
	});
	it('keeps a US-style symbol with a request for Yahoo for foreign companies listed on a US exchange', () => {
		expect(financialsLink(row('NYSE:TM', 'Japan'))).toBe('/financials?symbol=TM&source=yahoo');
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `vitest run src/lib/yahoo.test.ts src/lib/companies.test.ts`
Expected: FAIL (`yahooSymbol`, `financialsLink` missing).

- [ ] **Step 3: Implement**

`src/lib/yahoo.ts`: split `yahooQuote` so the symbol logic is reusable:

```ts
/** Yahoo Finance symbol for a Capital IQ style ticker such as `ENXTAM:ABN` (`ABN.AS`); null when Yahoo has no such listing. */
export function yahooSymbol(ticker: string): string | null {
	const [exchange, symbol] = ticker.split(':', 2);
	if (!symbol) return null;
	const suffix = SUFFIX[exchange];
	let s = symbol;
	// Korean codes carry a leading A (A005930); Mexican ones a share class (AMX B, ALSEA *)
	if (exchange === 'KOSDAQ' || exchange === 'KOSE') s = s.replace(/^A(?=\d{6}$)/, '');
	if (exchange === 'BMV') s = s.replace(/[ *]/g, '');
	if (suffix === undefined || !SYMBOL.test(s)) return null;
	if (exchange === 'SEHK' && /^\d+$/.test(s)) s = s.padStart(4, '0');
	if (suffix === '') s = s.replace('.', '-');
	return s + suffix;
}

/** Yahoo Finance quote page for a Capital IQ style ticker such as `ENXTAM:ABN`; null when Yahoo has no such listing. */
export function yahooQuote(ticker: string): string | null {
	const symbol = yahooSymbol(ticker);
	return symbol ? `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}` : null;
}
```
(The body of `yahooSymbol` is the existing body of `yahooQuote` with the final line changed; do not change `yahooSearch` or the `SUFFIX` table, and confirm the existing `yahoo.test.ts` cases still pass.)

`src/lib/companies.ts`: add `import { yahooSymbol } from './yahoo';` and

```ts
/** Where the Financials button leads: FMP for US exchange listings, Yahoo Finance for other mappable rows, nothing otherwise. */
export function financialsLink(company: Pick<Company, 'ticker' | 'country'>): string | null {
	const fmp = fmpSymbol(company);
	if (fmp) return `/financials?symbol=${encodeURIComponent(fmp)}`;
	// US rows without an FMP symbol are OTC and the like: no button
	if (company.country === 'United States') return null;
	const yahoo = parseSymbol(yahooSymbol(company.ticker) ?? '');
	return yahoo ? `/financials?symbol=${encodeURIComponent(yahoo)}&source=yahoo` : null;
}
```

`src/routes/companies/+page.svelte`: change the import to `import { financialsLink } from '#lib/companies';` and replace the button cell with
```svelte
							<td>
								{#if financialsLink(c)}
									<a class="button" href={financialsLink(c)} aria-label={`Financials for ${c.name}`}>Financials</a>
								{/if}
							</td>
```
(remove the old `fmpSymbol` import from the page if it is now unused).

Docs:
- `README.md`: in the `/financials` paragraph add: `Each view uses one data source: FMP for US tickers (the default) or Yahoo Finance (a switch on the page, and the only source for tickers with an exchange suffix such as ABN.AS). Yahoo data comes from the unofficial yahoo-finance2 package, may be delayed and can break without notice. TTM is not available with FMP on the current plan and is grayed out there; it works with Yahoo.` Adjust the sentence about the Companies button: `US companies on NASDAQ, NYSE or NYSE American link to FMP; other companies whose ticker maps to a Yahoo symbol link to Yahoo Finance.`
- `CLAUDE.md`: in the `/financials` bullet add: `A view never mixes data sources: \`src/lib/source.ts\` decides the source per ticker (a dot suffix means Yahoo only) and whether a period exists for it (\`FMP_SUPPORTS_TTM\`). Yahoo goes through \`src/lib/server/yahoo.ts\` (injectable client) and \`yahoo-parse.ts\`; never log Yahoo error text to visitors.`
- Spec status line: replace `design approved in conversation, pending written-spec review.` with `design and spec approved by the owner.`

- [ ] **Step 4: Verify**

Run: full test run with coverage (`npm run test:coverage` equivalent: `vitest run --coverage`; thresholds must hold), `svelte-kit sync` + `svelte-check` (0 errors, 0 warnings), `check-no-js`, `vite build`. Smoke test on a production build: `curl "localhost:PORT/companies?country=Netherlands"` contains `href="/financials?symbol=` links ending in `&source=yahoo`, `?country=United%20States` still has FMP links without `source=`, and `?country=Japan` has Yahoo links. Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
git add src/lib/yahoo.ts src/lib/yahoo.test.ts src/lib/companies.ts src/lib/companies.test.ts src/routes/companies/+page.svelte README.md CLAUDE.md docs/superpowers/specs/2026-10-27-yahoo-source-design.md
git commit -m "feat: Financials button for non-US companies via Yahoo Finance

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** library and dependency (Task 3); `source` URL parameter, switch for US only, non-US forced to Yahoo, default FMP (Tasks 1, 4, 5); one source per view and no mixing (Task 4 fetcher sets, tests assert FMP fetchers untouched for Yahoo and vice versa); TTM grayed under FMP and `period=ttm` falling back to annual (Tasks 1, 4, 5, constant `FMP_SUPPORTS_TTM`); all four tabs on Yahoo (Tasks 2 to 4); native lines with key lines first, TTM from the trailing series, balance-sheet TTM = latest annual, currency from the profile call (Tasks 2, 3); EPS formatting (Task 5); source kept through login (Task 1); caches per source with the spec's lifetimes (Task 4); Companies button for non-US rows via the existing mapping (Task 6); error mapping and no URL leaks (Task 3); docs (Task 6). The owner-side preview check (Vercel IPs, `ABN.AS`) is an open item in the spec, not a task.
- **Placeholders:** none; each code step has its code. Task 3 step 1 asks the implementer to confirm two library facts live and says how to adapt.
- **Type consistency:** `Source`, `SourceFetchers`, `yahooFetchers`, `fetchYahoo*`, `parseYahoo*`, `YahooClient`, `financialsLink`, `yahooSymbol` are named the same in every task. `Nav.source` is optional so existing `Nav` literals keep compiling.
