# Release overview PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pushing a release tag creates the GitHub pre-release and attaches `my-svelte-app-overview-<tag>.pdf` and `metrics.json`. The PDF has a cover, the design at a glance, decisions, release history, quality and roadmap, like the finance-tools overview.

**Architecture:**
- Pure parsers and view builders in `src/lib/overview/` (data in, HTML string out, Vitest-tested, no network).
- One I/O script, `scripts/build-overview.ts`, gathers the inputs from files, `git` and `gh`, and prints the HTML with Playwright's Chromium.
- A new workflow, `release-assets.yml`, creates the release, measures at the tag, builds the assets and attaches them.

**Tech Stack:** TypeScript on Node 24 (type stripping), Vitest, `marked` (Markdown → HTML), `mermaid` (diagrams, rendered in the page), `@playwright/test`'s `chromium` (`page.pdf`), GitHub Actions, the `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-11-22-release-overview-pdf-design.md` (Task 1 records the refinements below in it).

## Global Constraints

- TypeScript only: no `.js`/`.mjs`/`.cjs`/`.jsx` files. Scripts run with `node scripts/<name>.ts`. Use Node 24: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH` on this machine, where the default `node` is 26.
- Run `npm run check`, `npm run lint` and `npm run format:check` before every commit, and `npm test` too. All must report 0 errors. `max-statements` is 40 per function.
- Data shapes are `readonly`, and constant tables are `as const`. Prefer `map`, `filter` and `find` to loops. Read guaranteed elements with `at()` from `src/lib/at.ts`, never with `!`.
- **Imports inside `src/lib/overview/` are relative with a `.ts` extension** (`'../at.ts'`, `'./adr.ts'`), not `#lib/...`. `#lib/*` resolves to an extensionless path that Node cannot load when `scripts/build-overview.ts` runs directly. `scripts/build-gdp.ts` → `src/lib/gdp-match.ts` follows the same rule. Tests may use `#lib/...` but stay relative for consistency.
- Every type that an exported signature names is exported (TypeDoc's `treatWarningsAsErrors`).
- Coverage of `src/lib` stays above the floor: 95 statements, lines and functions, 85 branches.
- Lane labels, in this order: `lane:valuation` → "Valuation", `lane:financials` → "Financials", `lane:reference` → "Reference pages", `lane:design-system` → "Design system", `lane:releases` → "Releases". The fallback row is "Unsorted".
- *Landed* is capped at 8 items per lane, with "+n more".
- Action pins (copy them exactly):
  - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`
  - `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`
  - `actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2`
  - `actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2`
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on the branch `feat/release-overview-pdf` and never merge.

## Refinements to the spec (recorded in Task 1)

1. `build-overview.ts` takes `--metrics <metrics.json>` (written by `build-metrics.ts`), not `--reports`, because `buildMetrics` needs `GITHUB_*` values the workflow sets.
2. **Preview mode:**
   - Without `--release`, the script builds a *preview* from `HEAD`: *Landed* covers everything since the newest release tag, and the quality page shows "not measured".
   - `release-assets.yml` builds this preview on a PR that touches the PDF's inputs, as an artifact, so a release PR shows its PDF before the tag.
3. The page footer comes from `page.pdf`'s `footerTemplate`, not from CSS `@page`.
4. A tag cut before this workflow existed (`2026.11.12`, `2026.11.20`) cannot be rebuilt, because its checkout has no script and its `overview.md` has the old shape. The first PDF comes with the next release.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/overview/adr.ts` | `parseAdr`, `ADR_THEMES`, `THEME_ORDER`, `themeOf` and `decisionsView` |
| `src/lib/overview/changelog.ts` | `parseChangelog`, `releaseNotes`, `prNumbers` and `historyRows` |
| `src/lib/overview/curated.ts` | `parseOverview` and `sectionBody` (the curated parts of `docs/overview.md` and `docs/quality/README.md`) |
| `src/lib/overview/roadmap.ts` | `LANES`, `laneOf`, the `gh` JSON guards and `roadmapView` |
| `src/lib/overview/quality.ts` | `isMetrics`, `qualityView` and `COVERAGE_FLOOR_LINES` |
| `src/lib/overview/pages.ts` | `esc`, `md` and one HTML renderer per page |
| `src/lib/overview/document.ts` | `renderOverview`: the HTML document and stylesheet |
| `src/lib/overview/*.test.ts` | Unit tests, plus tests over the real repo files |
| `scripts/release-notes.ts` | Prints a release's changelog section |
| `scripts/build-overview.ts` | Reads files, `git` and `gh`, and prints the PDF |
| `.github/workflows/release-assets.yml` | Release, measure, build and attach |
| `docs/overview.md` | Reshaped to the curated parts |
| `RELEASING.md`, `docs/workflows.md`, `docs/quality/README.md` | Updated for the new process |

---

### Task 1: ADRs → decisions view

**Files:**
- Modify: `docs/superpowers/specs/2026-11-22-release-overview-pdf-design.md` (append the "Refinements" list above as a section `## Refinements during planning`)
- Create: `src/lib/overview/adr.ts`
- Test: `src/lib/overview/adr.test.ts`

**Interfaces:**
- Produces:
  - `type AdrStatus = 'Accepted' | 'Proposed' | 'Superseded'`
  - `interface Adr { number; id; title; status; supersededBy?; date }`
  - `ADR_THEMES`, `THEME_ORDER` and `type Theme`
  - `themeOf(adr: Adr): Theme`
  - `parseAdr(fileName: string, text: string): Adr`
  - `interface DecisionGroup { theme; adrs }`
  - `interface DecisionsView { total; accepted; proposed: readonly Adr[]; superseded: readonly Adr[]; groups }`
  - `decisionsView(adrs: readonly Adr[]): DecisionsView`

- [ ] **Step 1: Record the refinements in the spec.** Append to the spec:

```markdown
## Refinements during planning

1. `build-overview.ts` takes `--metrics <metrics.json>` (written by `build-metrics.ts`), not `--reports`: `buildMetrics` needs the `GITHUB_*` values the workflow sets.
2. Without `--release` the script builds a *preview* from `HEAD`: Landed since the newest release tag, quality "not measured". `release-assets.yml` builds it on a PR that touches the PDF's inputs, as an artifact, so a release PR shows its PDF before the tag.
3. The page footer comes from `page.pdf`'s `footerTemplate`, not CSS `@page`.
4. A tag cut before this workflow existed (`2026.11.12`, `2026.11.20`) cannot be rebuilt: its checkout has no script and its `overview.md` the old shape. The first PDF comes with the next release.
5. Modules in `src/lib/overview/` import each other relatively with `.ts`, because Node runs `scripts/build-overview.ts` directly and `#lib/*` resolves without an extension.
```

- [ ] **Step 2: Write the failing test** `src/lib/overview/adr.test.ts`:

```ts
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADR_THEMES, decisionsView, parseAdr, themeOf, type Adr } from './adr.ts';

const adrFile = (status: string, heading = '# ADR-003: Public pages are cached'): string =>
	`---\nstatus: ${status}\ndate: 2026-10-27\ndecision-makers: someone\n---\n${heading}\n\nBody.\n`;

const adr = (number: number, status: Adr['status'] = 'Accepted'): Adr => ({
	number,
	id: `ADR-${String(number).padStart(3, '0')}`,
	title: `Title ${number}`,
	status,
	date: '2026-10-27'
});

describe('parseAdr', () => {
	it('reads the number, title, status and date', () => {
		expect(parseAdr('0003-public.md', adrFile('Accepted'))).toEqual({
			number: 3,
			id: 'ADR-003',
			title: 'Public pages are cached',
			status: 'Accepted',
			date: '2026-10-27'
		});
	});
	it('reads which ADR supersedes it', () => {
		expect(parseAdr('0003-x.md', adrFile('Superseded by ADR-011'))).toMatchObject({
			status: 'Superseded',
			supersededBy: 'ADR-011'
		});
	});
	it('refuses an unknown status, a missing heading or frontmatter, and a number that differs from the file', () => {
		expect(() => parseAdr('0003-x.md', adrFile('Maybe'))).toThrow(/0003-x.md: unknown status "Maybe"/);
		expect(() => parseAdr('0003-x.md', adrFile('Accepted', '# Something'))).toThrow(/heading/);
		expect(() => parseAdr('0003-x.md', '# ADR-003: T\n')).toThrow(/frontmatter/);
		expect(() => parseAdr('0004-x.md', adrFile('Accepted'))).toThrow(/0004-x.md: the heading says ADR-003/);
	});
});

describe('decisionsView', () => {
	it('counts by status and groups the accepted ones by theme in THEME_ORDER', () => {
		const view = decisionsView([adr(5), adr(2), adr(1), adr(10, 'Superseded'), adr(12, 'Proposed')]);
		expect(view).toMatchObject({ total: 5, accepted: 3 });
		expect(view.superseded.map((a) => a.id)).toEqual(['ADR-010']);
		expect(view.proposed.map((a) => a.id)).toEqual(['ADR-012']);
		expect(view.groups.map((g) => [g.theme, g.adrs.map((a) => a.id)])).toEqual([
			['Data', ['ADR-001', 'ADR-005']],
			['Pages', ['ADR-002']]
		]);
	});
	it('refuses an accepted ADR without a theme', () => {
		expect(() => themeOf(adr(99))).toThrow(/ADR-099 is accepted but has no theme/);
	});
});

describe('the ADRs in docs/adr/', () => {
	const dir = new URL('../../../docs/adr/', import.meta.url);
	const files = fs.readdirSync(dir).filter((name) => /^\d{4}-.*\.md$/.test(name));
	const adrs = files.map((name) => parseAdr(name, fs.readFileSync(new URL(name, dir), 'utf8')));

	it('all parse, and every accepted one has a theme', () => {
		expect(adrs.length).toBeGreaterThan(10);
		expect(decisionsView(adrs).total).toBe(files.length);
	});
	it('ADR_THEMES names only ADRs that exist and are accepted', () => {
		const accepted = adrs.filter((a) => a.status === 'Accepted').map((a) => a.id);
		expect(Object.keys(ADR_THEMES).sort()).toEqual([...accepted].sort());
	});
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/lib/overview/adr.test.ts`
Expected: FAIL with "Failed to load url ./adr.ts" (or similar).

- [ ] **Step 4: Implement** `src/lib/overview/adr.ts`:

```ts
// src/lib/overview/adr.ts
// The decisions page of the release overview, from the ADRs in docs/adr/. Pure: scripts/build-overview.ts reads the
// files. Imports are relative with .ts because Node runs that script directly (see the plan's Global Constraints).
import { at } from '../at.ts';

/** Where an ADR stands, from the `status:` line of its frontmatter. */
export type AdrStatus = 'Accepted' | 'Proposed' | 'Superseded';

/** One ADR file, as the overview needs it. */
export interface Adr {
	readonly number: number;
	/** `ADR-003` */
	readonly id: string;
	readonly title: string;
	readonly status: AdrStatus;
	/** For a superseded ADR, the one that replaced it. */
	readonly supersededBy?: string;
	readonly date: string;
}

/** The themes of the decisions page, in the order it shows them. */
export const THEME_ORDER = ['Data', 'Pages', 'Access', 'Valuation', 'Code', 'Delivery'] as const;
export type Theme = (typeof THEME_ORDER)[number];

/** The theme of every accepted ADR. A new accepted ADR needs a row here; adr.test.ts fails until it has one. */
export const ADR_THEMES = {
	'ADR-001': 'Data',
	'ADR-002': 'Pages',
	'ADR-003': 'Access',
	'ADR-004': 'Access',
	'ADR-005': 'Data',
	'ADR-006': 'Data',
	'ADR-007': 'Code',
	'ADR-008': 'Valuation',
	'ADR-009': 'Code',
	'ADR-011': 'Delivery'
} as const satisfies Readonly<Record<string, Theme>>;

const THEMES: Readonly<Record<string, Theme>> = ADR_THEMES;

/** The theme of an accepted ADR; throws when ADR_THEMES has none. */
export function themeOf(adr: Adr): Theme {
	const theme = THEMES[adr.id];
	if (theme === undefined) {
		throw new Error(`${adr.id} is accepted but has no theme in ADR_THEMES (src/lib/overview/adr.ts)`);
	}
	return theme;
}

function parseStatus(fileName: string, text: string): Pick<Adr, 'status' | 'supersededBy'> {
	if (text === 'Accepted' || text === 'Proposed') return { status: text };
	const by = /^Superseded by (ADR-\d{3})$/.exec(text);
	if (by) return { status: 'Superseded', supersededBy: at(by, 1) };
	throw new Error(`${fileName}: unknown status "${text}"`);
}

/** Reads an ADR file: its frontmatter (`status`, `date`) and its `# ADR-NNN: Title` heading. */
export function parseAdr(fileName: string, text: string): Adr {
	const fail = (what: string): never => {
		throw new Error(`${fileName}: ${what}`);
	};
	const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? fail('no frontmatter');
	const line = (key: string): string =>
		new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(front)?.[1]?.trim() ?? fail(`no ${key}: in the frontmatter`);
	const heading = /^# ADR-(\d{3}): (.+)$/m.exec(text) ?? fail('no "# ADR-NNN: Title" heading');
	const number = Number(at(heading, 1));
	if (Number(fileName.slice(0, 4)) !== number) fail(`the heading says ADR-${at(heading, 1)}`);
	return {
		number,
		id: `ADR-${at(heading, 1)}`,
		title: at(heading, 2).trim(),
		...parseStatus(fileName, line('status')),
		date: line('date')
	};
}

/** The accepted ADRs of one theme. */
export interface DecisionGroup {
	readonly theme: Theme;
	readonly adrs: readonly Adr[];
}

/** What the decisions page shows. */
export interface DecisionsView {
	readonly total: number;
	readonly accepted: number;
	readonly proposed: readonly Adr[];
	readonly superseded: readonly Adr[];
	readonly groups: readonly DecisionGroup[];
}

/** Counts the ADRs by status and groups the accepted ones by theme, each in number order. */
export function decisionsView(adrs: readonly Adr[]): DecisionsView {
	const sorted = [...adrs].sort((a, b) => a.number - b.number);
	const by = (status: AdrStatus): readonly Adr[] => sorted.filter((a) => a.status === status);
	const accepted = by('Accepted');
	const groups = THEME_ORDER.map((theme) => ({ theme, adrs: accepted.filter((a) => themeOf(a) === theme) })).filter(
		(group) => group.adrs.length > 0
	);
	return { total: sorted.length, accepted: accepted.length, proposed: by('Proposed'), superseded: by('Superseded'), groups };
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run src/lib/overview/adr.test.ts`
Expected: PASS. If the real-files test fails on a status, look at that ADR's frontmatter: the parser follows the files, not the other way round, unless a file is plainly malformed.

- [ ] **Step 6: Check and commit**

```bash
npm run check && npm run lint && npx prettier --write src/lib/overview
git add src/lib/overview docs/superpowers/specs/2026-11-22-release-overview-pdf-design.md
git commit -m "feat(overview): the decisions page from docs/adr/

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: CHANGELOG → release notes and history

**Files:**
- Create: `src/lib/overview/changelog.ts`, `scripts/release-notes.ts`
- Test: `src/lib/overview/changelog.test.ts`

**Interfaces:**
- Produces:
  - `interface ReleaseSection { version; date; lead; body }`
  - `parseChangelog(text: string): readonly ReleaseSection[]`, newest first, as in the file
  - `releaseNotes(text: string, version: string): string`
  - `prNumbers(subjects: readonly string[]): readonly number[]`
  - `interface HistoryRow { version; date; prs: number | undefined; lead }`
  - `historyRows(sections: readonly ReleaseSection[], prCounts: Readonly<Record<string, number>>): readonly HistoryRow[]`, oldest first

- [ ] **Step 1: Write the failing test** `src/lib/overview/changelog.test.ts`:

```ts
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { historyRows, parseChangelog, prNumbers, releaseNotes } from './changelog.ts';

const CHANGELOG = `# Changelog

Intro.

## [Unreleased]

## [2026.11.20] — 2026-11-20

14 merged PRs. The through-line is **one repository**.

### Countries

- Zoom (#154).

## [2026.11.12] — 2026-11-12

The first release.
`;

describe('parseChangelog', () => {
	it('reads the release sections, newest first, without Unreleased', () => {
		const sections = parseChangelog(CHANGELOG);
		expect(sections.map((s) => [s.version, s.date, s.lead])).toEqual([
			['2026.11.20', '2026-11-20', '14 merged PRs. The through-line is **one repository**.'],
			['2026.11.12', '2026-11-12', 'The first release.']
		]);
		expect(sections[0]?.body).toContain('### Countries\n\n- Zoom (#154).');
	});
	it('refuses a release heading in another shape', () => {
		expect(() => parseChangelog('## [2026.11.20] - 2026-11-20\n')).toThrow(/YYYY.0M.0D/);
	});
});

describe('releaseNotes', () => {
	it('is the section body, word for word', () => {
		expect(releaseNotes(CHANGELOG, '2026.11.12')).toBe('The first release.\n');
	});
	it('refuses a version without a section', () => {
		expect(() => releaseNotes(CHANGELOG, '2026.01.01')).toThrow(/no section for 2026.01.01/);
	});
});

describe('prNumbers', () => {
	it('takes the (#NNN) at the end of each subject, once each', () => {
		expect(prNumbers(['feat: zoom (#154)', 'Merge branch main', 'fix: x (#12) ', 'again (#154)'])).toEqual([154, 12]);
	});
});

describe('historyRows', () => {
	it('lists the releases oldest first with their PR counts', () => {
		expect(historyRows(parseChangelog(CHANGELOG), { '2026.11.20': 14 })).toEqual([
			{ version: '2026.11.12', date: '2026-11-12', prs: undefined, lead: 'The first release.' },
			{
				version: '2026.11.20',
				date: '2026-11-20',
				prs: 14,
				lead: '14 merged PRs. The through-line is **one repository**.'
			}
		]);
	});
});

describe('CHANGELOG.md', () => {
	const text = fs.readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
	it('parses, and every release has notes', () => {
		const sections = parseChangelog(text);
		expect(sections.map((s) => s.version)).toContain('2026.11.12');
		for (const s of sections) expect(releaseNotes(text, s.version).trim()).not.toBe('');
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/overview/changelog.test.ts`
Expected: FAIL, because `./changelog.ts` is missing.

- [ ] **Step 3: Implement** `src/lib/overview/changelog.ts`:

```ts
// src/lib/overview/changelog.ts
// The release sections of CHANGELOG.md: the GitHub release notes and the overview's release history. Pure.
import { at } from '../at.ts';

/** One `## [YYYY.0M.0D] — YYYY-MM-DD` section. */
export interface ReleaseSection {
	readonly version: string;
	readonly date: string;
	/** The opening paragraph: the PR count and the through-line. */
	readonly lead: string;
	/** Everything under the heading, trimmed. */
	readonly body: string;
}

const HEADING = /^## \[(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)\] — (\d{4}-\d{2}-\d{2})$/;

/** The release sections, in file order (newest first). `## [Unreleased]` is left out. */
export function parseChangelog(text: string): readonly ReleaseSection[] {
	return text.split(/^(?=## )/m).flatMap((chunk) => {
		const [first = '', ...rest] = chunk.split('\n');
		if (!first.startsWith('## [') || first.startsWith('## [Unreleased]')) return [];
		const match = HEADING.exec(first);
		if (!match) throw new Error(`CHANGELOG.md: a release heading reads "## [YYYY.0M.0D] — YYYY-MM-DD", not "${first}"`);
		const body = rest.join('\n').trim();
		return [{ version: at(match, 1), date: at(match, 2), lead: body.split(/\n\s*\n/)[0] ?? '', body }];
	});
}

/** The notes of one release: its section body, word for word. */
export function releaseNotes(text: string, version: string): string {
	const section = parseChangelog(text).find((s) => s.version === version);
	if (!section) throw new Error(`CHANGELOG.md has no section for ${version}`);
	return `${section.body}\n`;
}

/** The PR numbers of squash-merge subjects (`feat: x (#154)`), each once, in order. */
export function prNumbers(subjects: readonly string[]): readonly number[] {
	const numbers = subjects.flatMap((subject) => {
		const match = /\(#(\d+)\)$/.exec(subject.trim());
		return match ? [Number(at(match, 1))] : [];
	});
	return [...new Set(numbers)];
}

/** One row of the release history. */
export interface HistoryRow {
	readonly version: string;
	readonly date: string;
	/** Merged PRs between the previous release and this one, from git; undefined when not counted. */
	readonly prs: number | undefined;
	readonly lead: string;
}

/** The release history, oldest first. */
export function historyRows(
	sections: readonly ReleaseSection[],
	prCounts: Readonly<Record<string, number>>
): readonly HistoryRow[] {
	return [...sections]
		.reverse()
		.map((s) => ({ version: s.version, date: s.date, prs: prCounts[s.version], lead: s.lead }));
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/overview/changelog.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/release-notes.ts`**

```ts
// Prints the CHANGELOG.md section of a release: its GitHub release notes, word for word (RELEASING.md).
//
//   node scripts/release-notes.ts 2026.11.29 > notes.md
import fs from 'node:fs';
import { releaseNotes } from '../src/lib/overview/changelog.ts';

const version = process.argv[2];
if (!version) {
	console.error('usage: node scripts/release-notes.ts <YYYY.0M.0D>');
	process.exit(2);
}
process.stdout.write(releaseNotes(fs.readFileSync('CHANGELOG.md', 'utf8'), version));
```

Run: `node scripts/release-notes.ts 2026.11.20 | head -3`
Expected: the line starting "14 merged PRs here (#140 to #154".

- [ ] **Step 6: Check and commit**

```bash
npm run check && npm run lint && npx prettier --write src/lib/overview scripts/release-notes.ts
git add src/lib/overview scripts/release-notes.ts
git commit -m "feat(overview): release notes and history from CHANGELOG.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The curated parts of `docs/overview.md`, and its new shape

**Files:**
- Create: `src/lib/overview/curated.ts`
- Modify: `docs/overview.md` (reshape, keeping §1 unchanged)
- Test: `src/lib/overview/curated.test.ts`

**Interfaces:**
- Produces:
  - `sectionBody(markdown: string, heading: string, file: string): string`
  - `interface EarlyRelease { when; theme }`
  - `interface Curated { design; intros: { decisions; history; quality; roadmap }; earlyHistory: readonly EarlyRelease[]; later: Readonly<Record<string, string>> }`
  - `parseOverview(markdown: string): Curated`

- [ ] **Step 1: Write the failing test** `src/lib/overview/curated.test.ts`:

```ts
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOverview, sectionBody } from './curated.ts';

const OVERVIEW = `# my-svelte-app overview

> Note.

## 1. The design at a glance

**In one sentence:** an app.

\`\`\`mermaid
flowchart TB
  A --> B
\`\`\`

## 2. Design decisions

Decisions intro.

## 3. Release history

History intro.

| When | Theme |
|---|---|
| 2024-11 | Starter app |
| 2026-10-24 | Rebuilt |

## 4. Quality review

Quality intro.

## 5. Roadmap

Roadmap intro.

| Lane | Later |
|---|---|
| Valuation | DCF |
| Releases | |
`;

describe('parseOverview', () => {
	it('reads the design section, the intros and the two curated tables', () => {
		const curated = parseOverview(OVERVIEW);
		expect(curated.design).toContain('**In one sentence:** an app.');
		expect(curated.design).toContain('```mermaid');
		expect(curated.intros).toEqual({
			decisions: 'Decisions intro.',
			history: 'History intro.',
			quality: 'Quality intro.',
			roadmap: 'Roadmap intro.'
		});
		expect(curated.earlyHistory).toEqual([
			{ when: '2024-11', theme: 'Starter app' },
			{ when: '2026-10-24', theme: 'Rebuilt' }
		]);
		expect(curated.later).toEqual({ Valuation: 'DCF', Releases: '' });
	});
	it('refuses a missing section or table', () => {
		expect(() => parseOverview(OVERVIEW.replace('## 4. Quality review', '## 4. Quality'))).toThrow(
			/docs\/overview.md has no "## 4. Quality review"/
		);
		expect(() => parseOverview(OVERVIEW.replace('| Lane | Later |', '| Lane | Next |'))).toThrow(
			/no table "\| Lane \| Later \|"/
		);
	});
});

describe('sectionBody', () => {
	it('is the text under a heading up to the next one of its level', () => {
		expect(sectionBody('# T\n\n## A\n\nOne.\n\n### Sub\n\nTwo.\n\n## B\n\nThree.\n', 'A', 'x.md')).toBe(
			'One.\n\n### Sub\n\nTwo.'
		);
	});
});

describe('the real files', () => {
	const read = (file: string): string => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
	it('docs/overview.md has every curated part', () => {
		const curated = parseOverview(read('docs/overview.md'));
		expect(curated.design).toContain('```mermaid');
		expect(curated.earlyHistory.length).toBeGreaterThan(5);
	});
	it('docs/quality/README.md has the health table', () => {
		expect(sectionBody(read('docs/quality/README.md'), 'Health at a glance', 'docs/quality/README.md')).toMatch(
			/^\| Area \|/m
		);
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/overview/curated.test.ts`
Expected: FAIL, because `./curated.ts` is missing.

- [ ] **Step 3: Implement** `src/lib/overview/curated.ts`:

```ts
// src/lib/overview/curated.ts
// The hand-written parts of the release overview: docs/overview.md (and the health table of docs/quality/README.md).
// Found by heading and by table header, and refused when missing, so an edit that breaks the PDF fails npm test. Pure.

/** The text under `## <heading>`, up to the next `## `, trimmed; throws when the heading is missing. */
export function sectionBody(markdown: string, heading: string, file: string): string {
	const chunk = markdown.split(/^(?=## )/m).find((c) => c.split('\n')[0]?.trim() === `## ${heading}`);
	if (chunk === undefined) throw new Error(`${file} has no "## ${heading}"`);
	return chunk.split('\n').slice(1).join('\n').trim();
}

const firstParagraph = (body: string): string =>
	body.split(/\n\s*\n/).find((block) => !/^(\||```|#|>)/.test(block.trim()))?.trim() ?? '';

const cells = (line: string): readonly string[] =>
	line
		.trim()
		.replace(/^\||\|$/g, '')
		.split('|')
		.map((cell) => cell.trim());

/** The rows of the table whose header row is `header`, without the header and separator. */
function table(body: string, header: readonly string[], file: string): readonly (readonly string[])[] {
	const lines = body.split('\n');
	const start = lines.findIndex((line) => line.trim().startsWith('|') && cells(line).join('|') === header.join('|'));
	if (start < 0) throw new Error(`${file} has no table "| ${header.join(' | ')} |"`);
	const rest = lines.slice(start + 2);
	const end = rest.findIndex((line) => !line.trim().startsWith('|'));
	return (end < 0 ? rest : rest.slice(0, end)).map(cells);
}

/** A release-history row from before the first release. */
export interface EarlyRelease {
	readonly when: string;
	readonly theme: string;
}

/** The curated parts of docs/overview.md. Markdown strings are rendered as they are. */
export interface Curated {
	/** §1, whole: the sentence, the mermaid diagrams, the layers and the principles. */
	readonly design: string;
	readonly intros: {
		readonly decisions: string;
		readonly history: string;
		readonly quality: string;
		readonly roadmap: string;
	};
	readonly earlyHistory: readonly EarlyRelease[];
	/** The roadmap's Later column, by lane name. */
	readonly later: Readonly<Record<string, string>>;
}

const FILE = 'docs/overview.md';

/** Reads the curated parts; throws naming the first that is missing. */
export function parseOverview(markdown: string): Curated {
	const section = (heading: string): string => sectionBody(markdown, heading, FILE);
	const history = section('3. Release history');
	const roadmap = section('5. Roadmap');
	return {
		design: section('1. The design at a glance'),
		intros: {
			decisions: firstParagraph(section('2. Design decisions')),
			history: firstParagraph(history),
			quality: firstParagraph(section('4. Quality review')),
			roadmap: firstParagraph(roadmap)
		},
		earlyHistory: table(history, ['When', 'Theme'], FILE).map(([when = '', theme = '']) => ({ when, theme })),
		later: Object.fromEntries(table(roadmap, ['Lane', 'Later'], FILE).map(([lane = '', later = '']) => [lane, later]))
	};
}
```

- [ ] **Step 4: Reshape `docs/overview.md`**

Keep the title and §1 (`## 1. The design at a glance` through the end of `### Principles`) byte for byte. Replace the blockquote under the title and §2 to §5 with the following:

```markdown
> **The release PDF.** Every release carries `my-svelte-app-overview-<tag>.pdf` among its [assets](https://github.com/jan-ru/my-svelte-app/releases), built at the tag by `release-assets.yml` (`scripts/build-overview.ts`). This file holds its curated parts: §1 whole, an opening paragraph for each other page, the history from before the first release and the roadmap's *Later* column. The rest is generated at the tag: the decisions from `docs/adr/`, the releases from `CHANGELOG.md`, the quality figures from a run of the tests, and the roadmap's *Landed* and *Next* from merged PRs and open issues by their `lane:*` label. Each release PR reads this file against what changed ([RELEASING.md](../RELEASING.md), step 2).
```

```markdown
## 2. Design decisions

Four ideas recur: effects at the edge, the URL as the state, cheap in public and private where it costs, and refuse rather than mix. The full log is in [docs/adr/](adr/README.md); the PDF groups the accepted decisions by theme and lists the superseded ones.

## 3. Release history

In under three weeks a starter app became a comparison tool with a private valuation page, on a design system; the releases since are weekly at most and curated in [CHANGELOG.md](../CHANGELOG.md). Before the first release, `2026.11.12`, the work went:

| When | Theme |
|---|---|
| 2024-11 to 2026-07 | Starter SvelteKit app; dependency updates only |
| 2026-10-24 | Rebuilt on SvelteKit 3: the multiples home page, NYU workbooks read live, CI |
| 2026-10-25 | Find industry and Companies pages; TypeScript only; security headers; the password-protected Financials page |
| 2026-10-26 to 27 | Financials tabs, TTM, profile, news, prices; Yahoo as a second source; the design system; the public static site |
| 2026-10-28 | Countries and Industries pages; Node LTS pin; the Explore menu and footer |
| 2026-10-30 | Ratios, Estimates, Earnings and Peers tabs; one loader registry and one component per view; TypeDoc |
| 2026-10-31 | The valuation page, its football-field chart and the private company template |
| 2026-11-01 | The six-point TypeScript review; lint and Prettier in CI; the second review round; one login page; inflation and real growth on Countries |
| 2026-11-02 to 04 | The design at a glance as diagrams; one shared source-failure message; Dependabot updates |
| 2026-11-08 | Eulerpool as a third source, with its fair value and quality score and the Supply chain tab |
| 2026-11-11 | The Horizon design system: tokens, grid, focus and shell, and shared components; the About and Company side menus; the condensed balance sheet; refactors; AGENTS.md |

## 4. Quality review

Types, lint, formatting, the TypeScript-only rule, the coverage floor and the dependency audit all fail CI; Lighthouse and the live NYU check run but do not block a merge. The weakest parts are the external sources: SheetJS outside Dependabot's reach and the unofficial Yahoo package. The PDF measures the figures at the tag; the health table, the six-point review and the watch list are in [docs/quality/](quality/README.md), and what runs at each stage in [docs/workflows.md](workflows.md).

## 5. Roadmap

What landed comes from the PRs merged since the previous release, what is next from the open issues, each placed in a lane by its `lane:*` label; an issue without one shows under *Unsorted*. *Later* is curated here, and its items are ideas, not commitments.

| Lane | Later |
|---|---|
| Valuation | DCF valuation as its own page |
| Financials | |
| Reference pages | |
| Design system | |
| Releases | |
```

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run src/lib/overview/curated.test.ts`
Expected: PASS.

- [ ] **Step 6: Check and commit**

```bash
npm run check && npm run lint && npx prettier --write src/lib/overview
git add src/lib/overview docs/overview.md
git commit -m "feat(overview): the curated parts of docs/overview.md; the overview keeps only those

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Roadmap lanes from labels

**Files:**
- Create: `src/lib/overview/roadmap.ts`
- Test: `src/lib/overview/roadmap.test.ts`

**Interfaces:**
- Consumes: `Curated['later']` from Task 3 (a `Record<laneName, markdown>`).
- Produces:
  - `LANES`, `UNSORTED`, `LANDED_CAP`
  - `interface Issue { number; title; labels: readonly string[] }`
  - `interface PullRequest extends Issue { closes: readonly Issue[] }`
  - `interface Item { number; title }`
  - `interface LaneRow { name; landed; landedMore; next; later }`
  - `interface RoadmapView { rows; dependencyUpdates; warnings }`
  - `interface RoadmapInput { issues; prs; later }`
  - `parseIssues(json: unknown): readonly Issue[]`
  - `closingNumbers(json: unknown): readonly number[]`
  - `parsePullRequest(json: unknown, closes: readonly Issue[]): PullRequest`
  - `laneOf(labels): { lane: string; ambiguous: boolean }`
  - `roadmapView(input: RoadmapInput): RoadmapView`

- [ ] **Step 1: Write the failing test** `src/lib/overview/roadmap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	LANDED_CAP,
	closingNumbers,
	laneOf,
	parseIssues,
	parsePullRequest,
	roadmapView,
	type Issue,
	type PullRequest
} from './roadmap.ts';

const issue = (number: number, labels: readonly string[] = []): Issue => ({ number, title: `Issue ${number}`, labels });
const pr = (number: number, labels: readonly string[] = [], closes: readonly Issue[] = []): PullRequest => ({
	...issue(number, labels),
	title: `PR ${number}`,
	closes
});
const later = { Valuation: 'DCF', Financials: '', 'Reference pages': '', 'Design system': '', Releases: '' };

describe('the gh JSON guards', () => {
	it('read issues, closing references and a pull request', () => {
		const json = [{ number: 135, title: 'Side menu', labels: [{ name: 'lane:financials' }, { name: 'enhancement' }] }];
		expect(parseIssues(json)).toEqual([{ number: 135, title: 'Side menu', labels: ['lane:financials', 'enhancement'] }]);
		expect(closingNumbers({ closingIssuesReferences: [{ number: 135 }, { number: 7 }] })).toEqual([135, 7]);
		expect(parsePullRequest({ number: 160, title: 'x', labels: [] }, [])).toEqual({
			number: 160,
			title: 'x',
			labels: [],
			closes: []
		});
	});
	it('refuse anything else', () => {
		expect(() => parseIssues({})).toThrow(/a list of issues/);
		expect(() => parseIssues([{ number: '1', title: 't', labels: [] }])).toThrow(/not a GitHub issue/);
		expect(() => parseIssues([{ number: 1, title: 't', labels: [{}] }])).toThrow(/not a GitHub issue/);
		expect(closingNumbers({})).toEqual([]);
	});
});

describe('laneOf', () => {
	it('is the first lane label in LANES order, or Unsorted', () => {
		expect(laneOf(['enhancement'])).toEqual({ lane: 'Unsorted', ambiguous: false });
		expect(laneOf(['lane:releases', 'lane:valuation'])).toEqual({ lane: 'Valuation', ambiguous: true });
	});
});

describe('roadmapView', () => {
	it('places issues and PRs by lane; a PR without a label takes the lane of an issue it closes', () => {
		const view = roadmapView({
			issues: [issue(135, ['lane:financials']), issue(132, ['lane:reference'])],
			prs: [pr(160, ['lane:valuation']), pr(161, [], [issue(134, ['lane:financials'])]), pr(162, ['dependencies'])],
			later
		});
		const row = (name: string) => view.rows.find((r) => r.name === name);
		expect(row('Valuation')).toMatchObject({ landed: [{ number: 160, title: 'PR 160' }], next: [], later: 'DCF' });
		expect(row('Financials')).toMatchObject({ landed: [{ number: 161 }], next: [{ number: 135 }] });
		expect(row('Reference pages')?.next).toEqual([{ number: 132, title: 'Issue 132' }]);
		expect(view.dependencyUpdates).toBe(1);
		expect(view.rows.map((r) => r.name)).not.toContain('Unsorted');
		expect(view.warnings).toEqual([]);
	});
	it('adds an Unsorted row with a warning, and warns about two lane labels', () => {
		const view = roadmapView({ issues: [issue(108), issue(110, ['lane:releases', 'lane:design-system'])], prs: [pr(170)], later });
		expect(view.rows.at(-1)).toMatchObject({ name: 'Unsorted', landed: [{ number: 170 }], next: [{ number: 108 }] });
		expect(view.warnings).toEqual([
			'#108 has no lane:* label',
			'#110 has more than one lane:* label; shown under Design system'
		]);
	});
	it('caps Landed and counts the rest', () => {
		const prs = Array.from({ length: LANDED_CAP + 3 }, (_, i) => pr(200 + i, ['lane:valuation']));
		const valuation = roadmapView({ issues: [], prs, later }).rows[0];
		expect(valuation?.landed).toHaveLength(LANDED_CAP);
		expect(valuation?.landedMore).toBe(3);
	});
	it('refuses a Later row for a lane that does not exist', () => {
		expect(() => roadmapView({ issues: [], prs: [], later: { Pricing: 'x' } })).toThrow(/lanes that do not exist: Pricing/);
	});
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/overview/roadmap.test.ts`
Expected: FAIL, because `./roadmap.ts` is missing.

- [ ] **Step 3: Implement** `src/lib/overview/roadmap.ts`:

```ts
// src/lib/overview/roadmap.ts
// The roadmap page of the release overview: Landed (PRs merged since the previous release), Next (open issues) and
// Later (curated in docs/overview.md), per lane. An issue's lane is its `lane:*` GitHub label. Pure: the gh JSON comes in.

/** The lanes, in the order the page shows them; the first matching label wins. */
export const LANES = [
	{ label: 'lane:valuation', name: 'Valuation' },
	{ label: 'lane:financials', name: 'Financials' },
	{ label: 'lane:reference', name: 'Reference pages' },
	{ label: 'lane:design-system', name: 'Design system' },
	{ label: 'lane:releases', name: 'Releases' }
] as const;

/** The row of everything without a lane label. */
export const UNSORTED = 'Unsorted';
/** How many landed PRs a lane lists before "+n more". */
export const LANDED_CAP = 8;
const DEPENDENCIES = 'dependencies';

/** An issue, as `gh issue list --json number,title,labels` gives it, labels by name. */
export interface Issue {
	readonly number: number;
	readonly title: string;
	readonly labels: readonly string[];
}

/** A merged PR and the issues it closes. */
export interface PullRequest extends Issue {
	readonly closes: readonly Issue[];
}

/** One line of a lane. */
export interface Item {
	readonly number: number;
	readonly title: string;
}

/** One lane of the roadmap. */
export interface LaneRow {
	readonly name: string;
	readonly landed: readonly Item[];
	readonly landedMore: number;
	readonly next: readonly Item[];
	/** Markdown from docs/overview.md; empty when the lane has nothing later. */
	readonly later: string;
}

/** What the roadmap page shows. */
export interface RoadmapView {
	readonly rows: readonly LaneRow[];
	/** Dependabot PRs since the previous release, counted, not listed. */
	readonly dependencyUpdates: number;
	readonly warnings: readonly string[];
}

/** Everything the roadmap is built from. */
export interface RoadmapInput {
	readonly issues: readonly Issue[];
	readonly prs: readonly PullRequest[];
	readonly later: Readonly<Record<string, string>>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value);
const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

function parseIssue(value: unknown): Issue {
	const number = field(value, 'number');
	const title = field(value, 'title');
	const labels = field(value, 'labels');
	const names = isList(labels) ? labels.map((label) => field(label, 'name')) : [];
	if (typeof number !== 'number' || typeof title !== 'string' || !isList(labels) || !names.every((n) => typeof n === 'string')) {
		throw new Error(`not a GitHub issue: ${JSON.stringify(value)}`);
	}
	return { number, title, labels: names.filter((n): n is string => typeof n === 'string') };
}

/** Issues from `gh issue list --json number,title,labels`. */
export function parseIssues(json: unknown): readonly Issue[] {
	if (!isList(json)) throw new Error('gh issue list did not return a list of issues');
	return json.map(parseIssue);
}

/** The numbers in a PR's `closingIssuesReferences`; none when the field is missing. */
export function closingNumbers(json: unknown): readonly number[] {
	const refs = field(json, 'closingIssuesReferences');
	return isList(refs) ? refs.map((ref) => field(ref, 'number')).filter((n): n is number => typeof n === 'number') : [];
}

/** A PR from `gh pr view --json number,title,labels`, with the issues it closes. */
export function parsePullRequest(json: unknown, closes: readonly Issue[]): PullRequest {
	return { ...parseIssue(json), closes };
}

/** The lane of a set of labels: the first lane label in LANES order, or Unsorted. */
export function laneOf(labels: readonly string[]): { readonly lane: string; readonly ambiguous: boolean } {
	const lanes = LANES.filter((l) => labels.includes(l.label));
	return { lane: lanes[0]?.name ?? UNSORTED, ambiguous: lanes.length > 1 };
}

const prLane = (pr: PullRequest): string => {
	const own = laneOf(pr.labels).lane;
	if (own !== UNSORTED) return own;
	return pr.closes.map((i) => laneOf(i.labels).lane).find((lane) => lane !== UNSORTED) ?? UNSORTED;
};

const item = ({ number, title }: Issue): Item => ({ number, title });

/** The roadmap: one row per lane, plus Unsorted when anything has no lane. */
export function roadmapView(input: RoadmapInput): RoadmapView {
	const names: readonly string[] = LANES.map((l) => l.name);
	const unknown = Object.keys(input.later).filter((name) => !names.includes(name));
	if (unknown.length > 0) {
		throw new Error(`docs/overview.md: the roadmap names lanes that do not exist: ${unknown.join(', ')} (LANES in src/lib/overview/roadmap.ts)`);
	}
	const work = input.prs.filter((pr) => !pr.labels.includes(DEPENDENCIES));
	const row = (name: string): LaneRow => {
		const landed = work.filter((pr) => prLane(pr) === name).map(item);
		return {
			name,
			landed: landed.slice(0, LANDED_CAP),
			landedMore: Math.max(0, landed.length - LANDED_CAP),
			next: input.issues.filter((i) => laneOf(i.labels).lane === name).map(item),
			later: input.later[name] ?? ''
		};
	};
	const unsorted = row(UNSORTED);
	const hasUnsorted = unsorted.landed.length + unsorted.next.length > 0;
	return {
		rows: [...names.map(row), ...(hasUnsorted ? [unsorted] : [])],
		dependencyUpdates: input.prs.length - work.length,
		warnings: [
			...input.issues.filter((i) => laneOf(i.labels).lane === UNSORTED).map((i) => `#${i.number} has no lane:* label`),
			...input.issues
				.filter((i) => laneOf(i.labels).ambiguous)
				.map((i) => `#${i.number} has more than one lane:* label; shown under ${laneOf(i.labels).lane}`)
		]
	};
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/overview/roadmap.test.ts`
Expected: PASS.

- [ ] **Step 5: Check and commit**

```bash
npm run check && npm run lint && npx prettier --write src/lib/overview
git add src/lib/overview
git commit -m "feat(overview): roadmap lanes from lane:* labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Quality figures from `metrics.json`

**Files:**
- Create: `src/lib/overview/quality.ts`
- Test: `src/lib/overview/quality.test.ts`

**Interfaces:**
- Consumes: `Metrics` from `src/lib/metrics.ts` (existing).
- Produces:
  - `COVERAGE_FLOOR_LINES = 95`
  - `isMetrics(value: unknown): value is Metrics`
  - `interface QualityRow { label; value; ok: boolean | undefined }`
  - `interface QualityView { measuredAt: string | undefined; runUrl: string | undefined; rows }`
  - `qualityView(metrics: Metrics | undefined): QualityView`

- [ ] **Step 1: Write the failing test** `src/lib/overview/quality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import config from '../../../vitest.config.ts';
import type { Metrics } from '../metrics.ts';
import { COVERAGE_FLOOR_LINES, isMetrics, qualityView } from './quality.ts';

const METRICS: Metrics = {
	schema_version: 1,
	repo: 'jan-ru/my-svelte-app',
	commit: 'abc',
	ref: 'refs/tags/2026.11.29',
	measured_at: '2026-11-29T10:00:00Z',
	source: { run_url: 'https://github.com/jan-ru/my-svelte-app/actions/runs/1' },
	quality: { coverage_pct: 99, lint_errors: 0, type_errors: 0, tests: { passed: 1024, failed: 0, skipped: 2 } },
	security: { vulnerabilities: { scanner: 'npm audit', critical: 0, high: 0, medium: 1, low: 3 } }
};

describe('qualityView', () => {
	it('turns metrics.json into rows, each judged', () => {
		const view = qualityView(METRICS);
		expect(view.measuredAt).toBe('2026-11-29T10:00:00Z');
		expect(view.runUrl).toContain('/actions/runs/1');
		expect(view.rows.map((r) => [r.value, r.ok])).toEqual([
			['1024 passed, 0 failed, 2 skipped', true],
			['99.0% (floor 95%)', true],
			['0', true],
			['0', true],
			['0 critical, 0 high, 1 moderate, 3 low', true]
		]);
	});
	it('says "not measured" for what is missing, and judges failures', () => {
		const view = qualityView({ ...METRICS, quality: { tests: { passed: 1, failed: 2, skipped: 0 } }, security: undefined });
		expect(view.rows.map((r) => r.ok)).toEqual([false, undefined, undefined, undefined, undefined]);
		expect(qualityView(undefined).rows.every((r) => r.value === 'not measured')).toBe(true);
	});
});

describe('isMetrics', () => {
	it('accepts a metrics.json and refuses anything else', () => {
		expect(isMetrics(METRICS)).toBe(true);
		expect(isMetrics({ schema_version: 2 })).toBe(false);
	});
});

it('COVERAGE_FLOOR_LINES is the floor in vitest.config.ts', () => {
	expect(config.test?.coverage).toMatchObject({ thresholds: { lines: COVERAGE_FLOOR_LINES } });
});
```

If `security: undefined` trips `exactOptionalPropertyTypes`, build the object without `security` instead: `const { security: _, ...rest } = METRICS;`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/overview/quality.test.ts`
Expected: FAIL, because `./quality.ts` is missing.

- [ ] **Step 3: Implement** `src/lib/overview/quality.ts`:

```ts
// src/lib/overview/quality.ts
// The quality page of the release overview, from the metrics.json measured at the tag (src/lib/metrics.ts), so the
// PDF and the metrics.json attached beside it always agree. Pure.
import type { Metrics } from '../metrics.ts';

/** The line-coverage floor of src/lib, as in vitest.config.ts (quality.test.ts keeps them equal). */
export const COVERAGE_FLOOR_LINES = 95;
const NOT_MEASURED = 'not measured';

/** A metrics.json document, checked as far as the page reads it. */
export function isMetrics(value: unknown): value is Metrics {
	if (typeof value !== 'object' || value === null) return false;
	const { schema_version: version, repo } = value as { schema_version?: unknown; repo?: unknown };
	return version === 1 && typeof repo === 'string';
}

/** One figure, and whether it passes; undefined when it was not measured. */
export interface QualityRow {
	readonly label: string;
	readonly value: string;
	readonly ok: boolean | undefined;
}

/** What the quality page shows. */
export interface QualityView {
	readonly measuredAt: string | undefined;
	readonly runUrl: string | undefined;
	readonly rows: readonly QualityRow[];
}

const errors = (label: string, n: number | undefined): QualityRow => ({
	label,
	value: n === undefined ? NOT_MEASURED : String(n),
	ok: n === undefined ? undefined : n === 0
});

/** The figures of a measured run, or every row "not measured". */
export function qualityView(metrics: Metrics | undefined): QualityView {
	const q = metrics?.quality;
	const tests = q?.tests;
	const coverage = q?.coverage_pct;
	const v = metrics?.security?.vulnerabilities;
	return {
		measuredAt: metrics?.measured_at,
		runUrl: metrics?.source?.run_url,
		rows: [
			{
				label: 'Tests (Vitest and Playwright)',
				value: tests ? `${tests.passed} passed, ${tests.failed} failed, ${tests.skipped} skipped` : NOT_MEASURED,
				ok: tests ? tests.failed === 0 : undefined
			},
			{
				label: 'Line coverage of src/lib',
				value: coverage === undefined ? NOT_MEASURED : `${coverage.toFixed(1)}% (floor ${COVERAGE_FLOOR_LINES}%)`,
				ok: coverage === undefined ? undefined : coverage >= COVERAGE_FLOOR_LINES
			},
			errors('Type errors (svelte-check)', q?.type_errors),
			errors('Lint errors (ESLint)', q?.lint_errors),
			{
				label: 'Runtime advisories (npm audit)',
				value: v ? `${v.critical} critical, ${v.high} high, ${v.medium} moderate, ${v.low} low` : NOT_MEASURED,
				ok: v ? v.critical + v.high === 0 : undefined
			}
		]
	};
}
```

The `as { schema_version?: unknown; ... }` in `isMetrics` widens a checked `object` to optional `unknown` fields, which is a safe cast. If lint flags it, use `'schema_version' in value && value.schema_version === 1 && 'repo' in value && typeof value.repo === 'string'` instead.

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/overview/quality.test.ts`
Expected: PASS.

- [ ] **Step 5: Check and commit**

```bash
npm run check && npm run lint && npx prettier --write src/lib/overview
git add src/lib/overview
git commit -m "feat(overview): the quality page from metrics.json

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The HTML document

**Files:**
- Modify: `package.json` and `package-lock.json` (`npm install -D marked`)
- Create: `src/lib/overview/pages.ts`, `src/lib/overview/document.ts`
- Test: `src/lib/overview/document.test.ts`

**Interfaces:**
- Consumes: `Curated` (Task 3), `DecisionsView` (Task 1), `HistoryRow` (Task 2), `QualityView` (Task 5), `RoadmapView` (Task 4).
- Produces:
  - `esc(text: string): string`
  - `md(markdown: string): string`
  - `interface OverviewInput { release; preview: boolean; date; commit; fileName; curated; health; decisions; history; quality; roadmap }`
  - `renderOverview(input: OverviewInput): string`
  - `OVERVIEW_STYLE: string`

- [ ] **Step 1: Install marked**

```bash
npm install -D marked
```

Check that `node_modules/marked/package.json` has version ≥ 15, where renderer methods take a token object (`code({ text, lang })`). If it is older, look up the renderer API with context7 (`marked`) before Step 4.

- [ ] **Step 2: Write the failing test** `src/lib/overview/document.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Adr } from './adr.ts';
import { decisionsView } from './adr.ts';
import { renderOverview, type OverviewInput } from './document.ts';
import { esc, md } from './pages.ts';
import { qualityView } from './quality.ts';
import { roadmapView } from './roadmap.ts';

const adr = (number: number, status: Adr['status'] = 'Accepted'): Adr => ({
	number,
	id: `ADR-${String(number).padStart(3, '0')}`,
	title: `Title ${number}`,
	status,
	date: '2026-10-27',
	...(status === 'Superseded' ? { supersededBy: 'ADR-011' } : {})
});

const input = (overrides: Partial<OverviewInput> = {}): OverviewInput => ({
	release: '2026.11.29',
	preview: false,
	date: '2026-11-29',
	commit: 'abc1234',
	fileName: 'my-svelte-app-overview-2026.11.29.pdf',
	curated: {
		design: '**In one sentence:** an app.\n\n```mermaid\nflowchart TB\n  A[a<br/>b] --> B\n```',
		intros: { decisions: 'Dec intro.', history: 'Hist intro.', quality: 'Qual intro.', roadmap: 'Road intro.' },
		earlyHistory: [{ when: '2024-11', theme: 'Starter app' }],
		later: { Valuation: 'DCF' }
	},
	health: '| Area | Headline |\n|---|---|\n| Types | Strict |',
	decisions: decisionsView([adr(1), adr(2), adr(10, 'Superseded'), adr(11)]),
	history: [{ version: '2026.11.12', date: '2026-11-12', prs: 120, lead: 'The **first** release.' }],
	quality: qualityView(undefined),
	roadmap: roadmapView({ issues: [{ number: 135, title: 'Side <menu>', labels: ['lane:financials'] }], prs: [], later: { Valuation: 'DCF' } }),
	...overrides
});

describe('esc and md', () => {
	it('escape text and render Markdown, with mermaid blocks left for the browser', () => {
		expect(esc('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;');
		expect(md('**x**')).toContain('<strong>x</strong>');
		expect(md('```mermaid\nA[a<br/>b] --> B\n```')).toBe('<pre class="mermaid">A[a&lt;br/&gt;b] --&gt; B</pre>\n');
		expect(md('```sh\nls\n```')).toContain('<code class="language-sh">');
	});
});

describe('renderOverview', () => {
	const html = renderOverview(input());

	it('is one HTML document with every page in order', () => {
		expect(html.startsWith('<!doctype html>')).toBe(true);
		const order = ['The design at a glance', 'Design decisions', 'Release history', 'Quality', 'Roadmap'].map((h) =>
			html.indexOf(`<h1>my-svelte-app: ${h.toLowerCase()}`)
		);
		expect(order.every((i, n) => i > 0 && (n === 0 || i > (order[n - 1] ?? 0)))).toBe(true);
	});
	it('puts the release, date and commit on the cover', () => {
		expect(html).toContain('state at release 2026.11.29');
		expect(html).toContain('abc1234');
		expect(renderOverview(input({ preview: true, release: 'preview' }))).toContain('Preview of the next release');
	});
	it('counts and groups the decisions', () => {
		expect(html).toContain('4 ADRs: 3 accepted, 0 proposed, 1 superseded');
		expect(html).toContain('ADR-010 → ADR-011');
		expect(html).toMatch(/<h2>Data<\/h2>[\s\S]*ADR-001/);
	});
	it('lists the early history, then the releases with their PR counts', () => {
		expect(html).toContain('Starter app');
		expect(html).toMatch(/2026\.11\.12[\s\S]*120 PRs[\s\S]*The <strong>first<\/strong> release\./);
	});
	it('shows the quality figures, or that they were not measured', () => {
		expect(html).toContain('not measured');
		expect(html).toContain('<td>Types</td>');
	});
	it('escapes issue titles and shows the curated Later', () => {
		expect(html).toContain('#135 Side &lt;menu&gt;');
		expect(html).toMatch(/Valuation[\s\S]*DCF/);
	});
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/lib/overview/document.test.ts`
Expected: FAIL, because `./document.ts` and `./pages.ts` are missing.

- [ ] **Step 4: Implement** `src/lib/overview/pages.ts`:

```ts
// src/lib/overview/pages.ts
// One HTML renderer per page of the release overview. Text from GitHub (issue and PR titles) is escaped; Markdown
// from this repository is rendered as written. Mermaid blocks become <pre class="mermaid"> for the browser to draw.
import { Marked } from 'marked';
import type { Curated } from './curated.ts';
import type { DecisionsView } from './adr.ts';
import type { HistoryRow } from './changelog.ts';
import type { QualityView } from './quality.ts';
import type { Item, LaneRow, RoadmapView } from './roadmap.ts';

/** Escapes text for HTML. */
export function esc(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const markdown = new Marked({
	renderer: {
		code({ text, lang }) {
			return lang === 'mermaid' ? `<pre class="mermaid">${esc(text)}</pre>\n` : false;
		}
	}
});

/** Markdown to HTML. */
export function md(text: string): string {
	return markdown.parse(text, { async: false });
}

const page = (title: string, subtitle: string, body: string): string =>
	`<section class="page"><h1>my-svelte-app: ${esc(title.toLowerCase())}</h1><p class="subtitle">${subtitle}</p>${body}</section>\n`;

export function designPage(curated: Curated): string {
	return page('The design at a glance', 'drawn from docs/overview.md §1', md(curated.design));
}

export function decisionsPage(intro: string, view: DecisionsView): string {
	const counts = `${view.total} ADRs: ${view.accepted} accepted, ${view.proposed.length} proposed, ${view.superseded.length} superseded`;
	const groups = view.groups
		.map((g) => `<div class="group"><h2>${esc(g.theme)}</h2><dl>${g.adrs.map((a) => `<dt>${a.id}</dt><dd>${esc(a.title)}</dd>`).join('')}</dl></div>`)
		.join('');
	const superseded = view.superseded.map((a) => `${a.id} → ${a.supersededBy ?? '?'}`).join(', ');
	const proposed = view.proposed.map((a) => a.id).join(', ');
	return page(
		'Design decisions',
		`${counts}, in docs/adr/. Only accepted decisions in force are grouped`,
		`<div class="intro">${md(intro)}</div><div class="columns">${groups}</div>` +
			(superseded ? `<p class="note">Superseded: ${superseded}.</p>` : '') +
			(proposed ? `<p class="note">Still proposed: ${proposed}.</p>` : '')
	);
}

export function historyPage(curated: Curated, rows: readonly HistoryRow[]): string {
	const early = curated.earlyHistory.map((r) => `<tr><td>${esc(r.when)}</td><td>${md(r.theme)}</td></tr>`).join('');
	const releases = rows
		.map((r) => `<tr><td><b>${esc(r.version)}</b><br>${esc(r.date)}${r.prs === undefined ? '' : `<br>${r.prs} PRs`}</td><td>${md(r.lead)}</td></tr>`)
		.join('');
	return page(
		'Release history',
		`${rows.length} releases · condensed from CHANGELOG.md, PR counts from git between the tags`,
		`<div class="intro">${md(curated.intros.history)}</div><h2>Before the first release</h2><table>${early}</table><h2>Releases</h2><table>${releases}</table>`
	);
}

const mark = (ok: boolean | undefined): string => (ok === undefined ? '○' : ok ? '●' : '✕');

export function qualityPage(intro: string, view: QualityView, health: string): string {
	const rows = view.rows
		.map((r) => `<tr><td class="mark ${r.ok === false ? 'bad' : ''}">${mark(r.ok)}</td><td>${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`)
		.join('');
	const measured = view.measuredAt ? `measured at the tag on ${esc(view.measuredAt)}` : 'not measured: a preview';
	return page(
		'Quality',
		`${measured}${view.runUrl ? ` · ${esc(view.runUrl)}` : ''}`,
		`<div class="intro">${md(intro)}</div><table class="figures">${rows}</table><h2>Health at a glance</h2>${md(health)}`
	);
}

const items = (list: readonly Item[], more = 0): string =>
	list.map((i) => `<li>#${i.number} ${esc(i.title)}</li>`).join('') + (more > 0 ? `<li class="more">+${more} more</li>` : '');

const laneRow = (r: LaneRow): string =>
	`<tr><th>${esc(r.name)}</th><td><ul>${items(r.landed, r.landedMore)}</ul></td><td><ul>${items(r.next)}</ul></td><td>${r.later ? md(r.later) : '—'}</td></tr>`;

export function roadmapPage(intro: string, view: RoadmapView, release: string): string {
	const deps = view.dependencyUpdates > 0 ? `<p class="note">Also landed: ${view.dependencyUpdates} dependency updates.</p>` : '';
	return page(
		'Roadmap',
		'Landed: PRs merged since the previous release · Next: open issues · Later: curated',
		`<div class="intro">${md(intro)}</div><table class="roadmap"><tr><th></th><th>Landed · in ${esc(release)}</th><th>Next</th><th>Later</th></tr>${view.rows.map(laneRow).join('')}</table>${deps}`
	);
}
```

If one of these functions passes 40 statements or lint flags a nested template, split it up. They are expressions, so this is unlikely.

- [ ] **Step 5: Implement** `src/lib/overview/document.ts`:

```ts
// src/lib/overview/document.ts
// The release overview as one HTML document; scripts/build-overview.ts prints it to PDF in Chromium.
import type { DecisionsView } from './adr.ts';
import type { HistoryRow } from './changelog.ts';
import type { Curated } from './curated.ts';
import { decisionsPage, designPage, esc, historyPage, qualityPage, roadmapPage } from './pages.ts';
import type { QualityView } from './quality.ts';
import type { RoadmapView } from './roadmap.ts';

/** Everything the overview is built from. */
export interface OverviewInput {
	/** The tag, or "preview" for a build from a branch. */
	readonly release: string;
	readonly preview: boolean;
	readonly date: string;
	readonly commit: string;
	readonly fileName: string;
	readonly curated: Curated;
	/** The "Health at a glance" section of docs/quality/README.md, as Markdown. */
	readonly health: string;
	readonly decisions: DecisionsView;
	readonly history: readonly HistoryRow[];
	readonly quality: QualityView;
	readonly roadmap: RoadmapView;
}

/** The print stylesheet: A4, the colours of the overview's diagrams. */
export const OVERVIEW_STYLE = `
@page { size: A4; }
body { font: 10pt/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #222; margin: 0; }
.page { break-before: page; }
.cover { padding-top: 30mm; }
.cover h1 { font-size: 26pt; border: 0; }
h1 { font-size: 15pt; color: #2c5a85; border-bottom: 2px solid #4a7bab; padding-bottom: 2mm; margin: 0 0 1mm; }
h2 { font-size: 11pt; color: #2c5a85; margin: 4mm 0 1mm; }
.subtitle { color: #666; font-size: 8.5pt; margin: 0 0 4mm; }
.intro { background: #f7fafd; border-left: 3px solid #4a7bab; padding: 1mm 3mm; margin-bottom: 3mm; }
.columns { columns: 2; column-gap: 8mm; }
.group { break-inside: avoid; }
dl { display: grid; grid-template-columns: 16mm 1fr; gap: 1mm 2mm; margin: 0; }
dt { font-weight: 600; color: #2c5a85; }
dd { margin: 0; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; }
th, td { border-bottom: 1px solid #ddd; padding: 1.2mm 2mm; text-align: left; vertical-align: top; }
td p { margin: 0; }
.figures .mark { width: 5mm; color: #5f9b72; }
.figures .mark.bad { color: #c0392b; }
.roadmap th:first-child { width: 24mm; }
.roadmap td, .roadmap th { width: 25%; }
ul { margin: 0; padding-left: 4mm; }
.more, .note { color: #666; }
pre.mermaid { text-align: center; background: none; }
.contents li { margin: 1mm 0; }
`;

const SOURCES = 'docs/overview.md, docs/adr/, CHANGELOG.md, docs/quality/, git and the GitHub issues';
const CONTENTS = ['The design at a glance', 'Design decisions', 'Release history', 'Quality', 'Roadmap'] as const;

function cover(input: OverviewInput): string {
	const state = input.preview
		? `Preview of the next release, built from ${esc(input.commit)} on ${esc(input.date)}`
		: `${esc(input.date)} · state at release ${esc(input.release)} (${esc(input.commit)})`;
	return `<section class="cover"><h1>my-svelte-app</h1><p>Overview: the public multiples site and the private valuation tool</p><p class="subtitle">${state} · condensed from ${SOURCES}</p><h2>Contents</h2><ol class="contents">${CONTENTS.map((c) => `<li>${c}</li>`).join('')}</ol></section>\n`;
}

/** The whole overview as one HTML document. */
export function renderOverview(input: OverviewInput): string {
	const { curated } = input;
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(input.fileName)}</title><style>${OVERVIEW_STYLE}</style></head><body>
${cover(input)}${designPage(curated)}${decisionsPage(curated.intros.decisions, input.decisions)}${historyPage(curated, input.history)}${qualityPage(curated.intros.quality, input.quality, input.health)}${roadmapPage(curated.intros.roadmap, input.roadmap, input.release)}</body></html>
`;
}
```

- [ ] **Step 6: Run it to see it pass**

Run: `npx vitest run src/lib/overview/document.test.ts`
Expected: PASS. If the mermaid assertion fails only on whitespace (marked keeps or drops a trailing newline in `text`), adjust the expected string to marked's actual output. Do not change `esc`.

- [ ] **Step 7: Check and commit**

```bash
npm run check && npm run lint && npx prettier --write src/lib/overview && npm run docs
git add package.json package-lock.json src/lib/overview
git commit -m "feat(overview): the overview as one HTML document

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`npm run docs` must pass with no warnings, because every type an export names is exported.

---

### Task 7: `scripts/build-overview.ts`, the PDF

**Files:**
- Modify: `package.json` and `package-lock.json` (`npm install -D mermaid`; script `"overview": "node scripts/build-overview.ts"`), `.gitignore` (add `/my-svelte-app-overview-*.pdf`)
- Create: `scripts/build-overview.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 to 6.
- Produces the CLI `node scripts/build-overview.ts --out <file.pdf> [--release <tag>] [--metrics <metrics.json>]`. Without `--release` it builds a preview from `HEAD`. It prints the warnings to stderr, and as `::warning::` when `GITHUB_ACTIONS` is set.

- [ ] **Step 1: Install mermaid** and confirm the browser bundle exists:

```bash
npm install -D mermaid
ls node_modules/mermaid/dist/mermaid.min.js
```

Expected: the file exists. If it is missing, use whichever IIFE bundle `node_modules/mermaid/dist/` provides, the one that defines `globalThis.mermaid`.

- [ ] **Step 2: Write** `scripts/build-overview.ts`:

```ts
// Builds the release overview PDF (docs/superpowers/specs/2026-11-22-release-overview-pdf-design.md).
//
//   node scripts/build-overview.ts --out <file.pdf> [--release <tag>] [--metrics <metrics.json>]
//
// With --release it describes that tag (check it out first); without, it builds a preview of HEAD with what landed
// since the newest release tag. It reads the repository's files, git, and GitHub through `gh` (GH_TOKEN in CI), then
// prints the HTML with Playwright's Chromium, drawing the mermaid diagrams from node_modules (no CDN).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { decisionsView, parseAdr } from '../src/lib/overview/adr.ts';
import { historyRows, parseChangelog, prNumbers } from '../src/lib/overview/changelog.ts';
import { parseOverview, sectionBody } from '../src/lib/overview/curated.ts';
import { renderOverview, type OverviewInput } from '../src/lib/overview/document.ts';
import { isMetrics, qualityView } from '../src/lib/overview/quality.ts';
import { closingNumbers, parseIssues, parsePullRequest, roadmapView, type Issue, type PullRequest } from '../src/lib/overview/roadmap.ts';

const run = (command: string, args: readonly string[]): string =>
	execFileSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const lines = (text: string): readonly string[] => text.split('\n').filter((line) => line !== '');
const ghJson = (args: readonly string[]): unknown => JSON.parse(run('gh', args)) as unknown;
const read = (file: string): string => fs.readFileSync(file, 'utf8');

/** Release tags reachable from ref, oldest first. */
const releaseTags = (ref: string): readonly string[] =>
	lines(run('git', ['tag', '--list', '20[0-9][0-9].[0-9][0-9].[0-9][0-9]*', '--sort=creatordate', '--merged', ref]));

/** The merged PR numbers in a git range (`a..b`, or one ref for all history up to it). */
const prsIn = (range: string): readonly number[] => prNumbers(lines(run('git', ['log', '--format=%s', range])));

/** PR counts per released version: from the previous tag to this one (or to ref for an untagged version). */
function prCounts(versions: readonly string[], tags: readonly string[], ref: string): Readonly<Record<string, number>> {
	const ordered = [...versions].reverse();
	return Object.fromEntries(
		ordered.map((version, i) => {
			const end = tags.includes(version) ? version : ref;
			const previous = i > 0 ? ordered[i - 1] : undefined;
			return [version, prsIn(previous ? `${previous}..${end}` : end).length];
		})
	);
}

const issue = (n: number): Issue | undefined => {
	try {
		return parseIssues([ghJson(['issue', 'view', String(n), '--json', 'number,title,labels'])])[0];
	} catch {
		return undefined; // a PR number, or an issue of another repository: no lane from it
	}
};

/** The PRs merged in a range, with the issues each closes; a number gh does not know is skipped. */
function landed(range: string): readonly PullRequest[] {
	return prsIn(range).flatMap((n) => {
		try {
			const json = ghJson(['pr', 'view', String(n), '--json', 'number,title,labels,closingIssuesReferences']);
			const closes = closingNumbers(json).flatMap((c) => issue(c) ?? []);
			return [parsePullRequest(json, closes)];
		} catch {
			console.error(`#${n} is not a pull request gh can read: left out of Landed`);
			return [];
		}
	});
}

function readMetrics(file: string | undefined): ReturnType<typeof qualityView> {
	if (!file) return qualityView(undefined);
	const json = JSON.parse(read(file)) as unknown;
	if (!isMetrics(json)) throw new Error(`${file} is not a metrics.json`);
	return qualityView(json);
}

function gather(release: string | undefined, metrics: string | undefined): OverviewInput {
	const ref = release ?? 'HEAD';
	const tags = releaseTags(ref);
	const previous = tags.filter((t) => t !== release).at(-1);
	const sections = parseChangelog(read('CHANGELOG.md'));
	const curated = parseOverview(read('docs/overview.md'));
	const adrs = fs
		.readdirSync('docs/adr')
		.filter((name) => /^\d{4}-.*\.md$/.test(name))
		.map((name) => parseAdr(name, read(`docs/adr/${name}`)));
	const issues = parseIssues(ghJson(['issue', 'list', '--state', 'open', '--limit', '500', '--json', 'number,title,labels']));
	const name = release ?? 'preview';
	return {
		release: name,
		preview: release === undefined,
		date: release ? run('git', ['log', '-1', '--format=%cs', release]) : new Date().toISOString().slice(0, 10),
		commit: run('git', ['rev-parse', '--short', ref]),
		fileName: `my-svelte-app-overview-${name}.pdf`,
		curated,
		health: sectionBody(read('docs/quality/README.md'), 'Health at a glance', 'docs/quality/README.md'),
		decisions: decisionsView(adrs),
		history: historyRows(sections, prCounts(sections.map((s) => s.version), tags, ref)),
		quality: readMetrics(metrics),
		roadmap: roadmapView({ issues, prs: landed(previous ? `${previous}..${ref}` : ref), later: curated.later })
	};
}

const footer = (left: string): string =>
	`<div style="font-size:7.5px;width:100%;margin:0 14mm;display:flex;justify-content:space-between;color:#666"><span>${left}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`;

async function printPdf(html: string, out: string, footerLeft: string): Promise<void> {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: 'load' });
		await page.addScriptTag({ path: 'node_modules/mermaid/dist/mermaid.min.js' });
		await page.evaluate(async () => {
			const { mermaid } = globalThis as unknown as {
				mermaid: { initialize: (config: object) => void; run: () => Promise<void> };
			};
			mermaid.initialize({ startOnLoad: false, theme: 'neutral', flowchart: { htmlLabels: true } });
			await mermaid.run();
		});
		await page.waitForFunction(() => [...document.querySelectorAll('pre.mermaid')].every((el) => el.querySelector('svg')));
		await page.pdf({
			path: out,
			format: 'A4',
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: '<span></span>',
			footerTemplate: footer(footerLeft),
			margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' }
		});
	} finally {
		await browser.close();
	}
}

const { values } = parseArgs({
	options: { out: { type: 'string' }, release: { type: 'string' }, metrics: { type: 'string' } }
});
if (!values.out) {
	console.error('usage: node scripts/build-overview.ts --out <file.pdf> [--release <tag>] [--metrics <metrics.json>]');
	process.exit(2);
}
const input = gather(values.release, values.metrics);
for (const warning of input.roadmap.warnings) {
	console.error(process.env.GITHUB_ACTIONS ? `::warning::${warning}` : `warning: ${warning}`);
}
await printPdf(renderOverview(input), values.out, `${input.date} · ${input.fileName}`);
console.error(`wrote ${values.out}`);
```

Notes for the implementer:
- `releaseTags`' glob is a `git tag --list` pattern, not a regex. That is intended.
- `gather` must stay under 40 statements. If lint objects, move the `adrs` read into a `readAdrs()` helper.
- `const { values } = parseArgs` sits at the top level, which is fine in an ES module script. Top-level `await` works because `package.json` has `"type": "module"`.
- The cast `JSON.parse(...) as unknown` matches `scripts/build-metrics.ts`.

- [ ] **Step 3: Add the npm script and ignore local PDFs**

In `package.json` `scripts`, add `"overview": "node scripts/build-overview.ts"` after `"docs"`. Append `/my-svelte-app-overview-*.pdf` to `.gitignore`.

- [ ] **Step 4: Build a preview locally and look at it**

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
npx playwright install chromium
npm run overview -- --out my-svelte-app-overview-preview.pdf
pdfinfo my-svelte-app-overview-preview.pdf | grep Pages
pdftoppm -r 60 -png my-svelte-app-overview-preview.pdf "$SCRATCH/ov"
```

Here `$SCRATCH` is the session scratchpad. Expected: about 6 to 8 pages, with warnings for the six open issues that have no lane label yet (Task 9 labels them). Read each PNG and check:
- both mermaid diagrams are drawn, not shown as source text;
- no page clips a table;
- the footer shows "date · file · n/N".

Fix the CSS in `OVERVIEW_STYLE` or the markup until the pages read well, and re-run `npm test` after each change.

- [ ] **Step 5: Check and commit**

```bash
npm run check && npm run lint && npm run format:check && npm test && npm run check:ts-only
git add package.json package-lock.json .gitignore scripts/build-overview.ts src/lib/overview
git commit -m "feat(overview): scripts/build-overview.ts prints the overview PDF

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The `release-assets.yml` workflow

**Files:**
- Create: `.github/workflows/release-assets.yml`

**Interfaces:**
- Consumes: `scripts/release-notes.ts` (Task 2), `scripts/build-metrics.ts` (existing), `scripts/build-overview.ts` (Task 7).
- Produces: the release, the `release-assets` artifact (`*.pdf`, `metrics.json`), and the release assets.

- [ ] **Step 1: Write the workflow**

```yaml
name: Release assets (release)

# Stage: deployment. See docs/workflows.md and RELEASING.md. The same shape as finance-tools' release-assets.yml.
#
# Pushing a release tag creates the GitHub pre-release from the tag's CHANGELOG.md section, only when it does not
# exist yet, so a re-run never rewrites notes someone edited. Then it attaches the overview PDF and metrics.json, both
# built from a checkout of the tag after a run of the checks and tests there (`--clobber`, so a re-run replaces them).
# A red check or test does not stop the PDF: it shows on the quality page.
#
# A pull request that touches what the PDF is built from builds a preview (no tests, quality "not measured") as a
# workflow artifact, so a release PR shows its PDF before the tag. A manual run names an existing tag: dry_run true
# (the default) builds and publishes nothing, false creates what is missing and attaches the assets again. A tag cut
# before this workflow existed cannot be rebuilt: its checkout has no build-overview.ts.
#
# Building and writing are separate jobs: `build` holds a read-only token, `release` and `attach` hold the write token
# and run no npm code beyond release-notes.ts, which reads CHANGELOG.md.
on:
  push:
    tags:
      - "20[0-9][0-9].[0-9][0-9].[0-9][0-9]*"
  pull_request:
    paths:
      - CHANGELOG.md
      - docs/overview.md
      - docs/adr/**
      - docs/quality/README.md
      - src/lib/overview/**
      - scripts/build-overview.ts
      - .github/workflows/release-assets.yml
  workflow_dispatch:
    inputs:
      tag:
        description: An existing release tag (YYYY.0M.0D)
        required: true
        type: string
      dry_run:
        description: Build only; publish nothing
        type: boolean
        default: true

permissions:
  contents: read

concurrency:
  group: release-assets-${{ inputs.tag || github.ref }}
  cancel-in-progress: false

jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.plan.outputs.tag }}
      publish: ${{ steps.plan.outputs.publish }}
    steps:
      - id: plan
        env:
          EVENT: ${{ github.event_name }}
          REF_NAME: ${{ github.ref_name }}
          INPUT_TAG: ${{ inputs.tag }}
          INPUT_DRY_RUN: ${{ inputs.dry_run }}
        run: |
          case "$EVENT" in
            push) tag="$REF_NAME"; publish=true ;;
            workflow_dispatch) tag="$INPUT_TAG"; if [ "$INPUT_DRY_RUN" = false ]; then publish=true; else publish=false; fi ;;
            *) tag=""; publish=false ;;
          esac
          if [ -n "$tag" ] && ! [[ "$tag" =~ ^20[0-9]{2}\.[0-9]{2}\.[0-9]{2}(\.[0-9]+)?$ ]]; then
            echo "::error::$tag is not a release tag (YYYY.0M.0D)"; exit 1
          fi
          echo "tag=$tag" >> "$GITHUB_OUTPUT"
          echo "publish=$publish" >> "$GITHUB_OUTPUT"

  release:
    needs: plan
    if: needs.plan.outputs.publish == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: refs/tags/${{ needs.plan.outputs.tag }}
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - name: Create the pre-release from the changelog, unless it exists
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ needs.plan.outputs.tag }}
        run: |
          if gh release view "$TAG" > /dev/null 2>&1; then
            echo "The release $TAG exists: its notes are left as they are"
            exit 0
          fi
          node scripts/release-notes.ts "$TAG" > "$RUNNER_TEMP/notes.md"
          gh release create "$TAG" --verify-tag --prerelease --title "$TAG" --notes-file "$RUNNER_TEMP/notes.md"

  build:
    needs: plan
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      issues: read
      pull-requests: read
    env:
      TAG: ${{ needs.plan.outputs.tag }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ needs.plan.outputs.tag && format('refs/tags/{0}', needs.plan.outputs.tag) || '' }}
          # every tag and commit: Landed and the PR counts are git ranges between tags
          fetch-depth: 0
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      # Measured at the tag only. Each step may fail: its outcome feeds metrics.json and the quality page.
      - id: check
        if: env.TAG != ''
        continue-on-error: true
        run: npm run check
      - id: lint
        if: env.TAG != ''
        continue-on-error: true
        run: npm run lint
      - id: unit
        if: env.TAG != ''
        continue-on-error: true
        run: npm run test:coverage -- --reporter=default --reporter=json --outputFile.json=reports/test/vitest.json
      - id: e2e
        if: env.TAG != ''
        continue-on-error: true
        run: npm run build && npm run test:e2e -- --reporter=list,json
        env:
          PLAYWRIGHT_JSON_OUTPUT_FILE: reports/test/playwright.json
      - name: metrics.json
        if: env.TAG != ''
        env:
          CHECK_OUTCOME: ${{ steps.check.outcome }}
          LINT_OUTCOME: ${{ steps.lint.outcome }}
          TEST_RESULT: ${{ (steps.check.outcome == 'success' && steps.lint.outcome == 'success' && steps.unit.outcome == 'success' && steps.e2e.outcome == 'success') && 'success' || 'failure' }}
        run: |
          mkdir -p reports/test assets
          cp coverage/coverage-summary.json reports/test/ || true
          npm audit --omit=dev --json > reports/npm-audit.json || true
          GITHUB_SHA="$(git rev-parse HEAD)" GITHUB_REF="refs/tags/$TAG" node scripts/build-metrics.ts reports > assets/metrics.json
      - name: The overview PDF
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          mkdir -p assets
          if [ -n "$TAG" ]; then
            node scripts/build-overview.ts --release "$TAG" --metrics assets/metrics.json --out "assets/my-svelte-app-overview-$TAG.pdf"
          else
            node scripts/build-overview.ts --out assets/my-svelte-app-overview-preview.pdf
          fi
      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: release-assets
          path: assets/
          retention-days: 14
          if-no-files-found: error

  attach:
    needs: [plan, release, build]
    if: needs.plan.outputs.publish == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with:
          name: release-assets
          path: assets
      - name: Attach the PDF and metrics.json
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ needs.plan.outputs.tag }}
        run: gh release upload "$TAG" assets/* --clobber --repo "$GITHUB_REPOSITORY"
```

Two things to check against the current files:
- If `ci.yml` calls `npm run test:coverage` differently, copy its form, without `--reporter=github-actions`, which is only for annotations.
- If `build-metrics.ts` expects `reports/test/coverage-summary.json` under a different name, follow the comment at the top of `build-metrics.ts`.

- [ ] **Step 2: Lint the workflow**

Run: `npx --yes actionlint@latest .github/workflows/release-assets.yml 2>/dev/null || docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest .github/workflows/release-assets.yml`
Expected: no errors. If neither tool is available, say so in the PR. Do not skip this silently.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-assets.yml
git commit -m "ci: release-assets.yml creates the pre-release and attaches the overview PDF and metrics.json

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Lane labels, docs, and the PR

**Files:**
- Modify: `RELEASING.md`, `docs/workflows.md`, `docs/quality/README.md`, `CLAUDE.md` (one line)
- GitHub: create 5 labels and label the 6 open issues

- [ ] **Step 1: Create the labels and label the open issues.** This is outward-facing; the user approved it in the spec.

```bash
gh label create lane:valuation --color 4a7bab --description "Roadmap lane: Valuation"
gh label create lane:financials --color 4a7bab --description "Roadmap lane: Financials"
gh label create lane:reference --color 4a7bab --description "Roadmap lane: Reference pages"
gh label create lane:design-system --color 4a7bab --description "Roadmap lane: Design system"
gh label create lane:releases --color 4a7bab --description "Roadmap lane: Releases"
gh issue edit 135 --add-label lane:financials
gh issue edit 134 --add-label lane:financials
gh issue edit 133 --add-label lane:financials
gh issue edit 132 --add-label lane:reference
gh issue edit 110 --add-label lane:design-system
gh issue edit 108 --add-label lane:design-system
```

Then re-run `npm run overview -- --out my-svelte-app-overview-preview.pdf`. Expected: no lane warnings.

- [ ] **Step 2: Rewrite the steps of `RELEASING.md`**

Replace the opening paragraph's "a refreshed quality snapshot and an overview that matches the code at that tag" with "an overview PDF built at the tag (with the quality figures measured there) and `metrics.json`". Then replace `## Steps` up to `## Conventions` with:

````markdown
## Steps

### 1. Curate the changelog

In [CHANGELOG.md](CHANGELOG.md), rename `## [Unreleased]` to `## [YYYY.0M.0D] — YYYY-MM-DD` and add a fresh, empty `## [Unreleased]` above it. The section is curated highlights grouped by area, with PR numbers, not a commit list. Open it with one line: the number of PRs and the through-line of the release. That line is also the release's row on the PDF's history page.

```sh
prev=$(git describe --tags --abbrev=0)      # the previous release
git log "$prev"..HEAD --oneline
```

### 2. Curate the overview

Read [docs/overview.md](docs/overview.md) against what changed. It holds only the curated parts of the PDF: §1, the opening paragraph of each page, the history from before the first release and the roadmap's *Later*. When a new ADR is accepted, give it a theme in `ADR_THEMES` (`src/lib/overview/adr.ts`); `npm test` fails until it has one. Give every open issue a `lane:*` label; one without shows under *Unsorted* and the build warns.

### 3. PR it

Commit on a branch named `release/YYYY.0M.0D`, open a PR and merge it once CI is green. The PR runs `release-assets.yml`, which builds a preview of the PDF (quality "not measured") as the `release-assets` artifact: read it before merging. `main` requires a PR and a passing `test` check on a branch that is up to date with `main`.

### 4. Tag it

Tag the merge commit on `main` and push the tag. This is the one outward step:

```sh
git switch main && git pull --ff-only
git tag -a YYYY.0M.0D -m "YYYY.0M.0D"
git push origin YYYY.0M.0D
```

The tag runs `release-assets.yml`. It creates the GitHub **pre-release** with the changelog section as its notes (`node scripts/release-notes.ts YYYY.0M.0D` prints them), runs the checks and tests at the tag, and attaches `my-svelte-app-overview-YYYY.0M.0D.pdf` and `metrics.json`. If the build fails, the release still stands: fix the cause and run the workflow by hand for the tag with `dry_run` off. It also runs `docs.yml` (step 5).

### 5. The API reference

Pushing the tag runs `docs.yml`, which builds the API reference and deploys it to Cloudflare Pages at
<https://my-svelte-app-docs.pages.dev/>. It needs the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, as in finance-tools.
````

- [ ] **Step 3: Update `docs/workflows.md`**

Replace the row `| | Release: tag and GitHub pre-release | By hand, [RELEASING.md](../RELEASING.md) | You | n/a |` with:

```markdown
| | Release: the tag, by hand ([RELEASING.md](../RELEASING.md)); then the pre-release, overview PDF and `metrics.json` | `release-assets.yml` | A release tag, or by hand for a tag (`dry_run` on by default) | n/a |
| | Overview PDF preview | `release-assets.yml`, `build` job | PR that touches the overview's inputs | No |
```

Add **Release assets (release)** to the list of workflow names in the opening paragraph. Change the bullet "**A tag deploys only the API reference.**" to: "**A tag deploys the API reference and builds the release assets.** The app itself is not rebuilt for a release ([RELEASING.md](../RELEASING.md))." If the mermaid diagram has a `TAG` node, add an edge `TAG --> RA[Release PDF and metrics.json]`.

- [ ] **Step 4: Update `docs/quality/README.md`**

Change the first paragraph's "The block marked *Measured* is a dated snapshot, refreshed in each release PR" to "The block marked *Measured* keeps the hand-taken snapshots up to `2026.11.20`; from the next release on, the figures are measured at each tag and printed on the quality page of the release PDF (`release-assets.yml`)". Leave the rest unchanged.

- [ ] **Step 5: One line in `CLAUDE.md`**, after the **Generated data** bullet:

```markdown
- **Release overview PDF:** `release-assets.yml` builds it at each tag from `docs/overview.md` (curated parts only), `docs/adr/`, `CHANGELOG.md`, `docs/quality/README.md`, git and the open issues (`scripts/build-overview.ts`, pure code in `src/lib/overview/`, which imports relatively with `.ts` because Node runs the script directly). A new accepted ADR needs a theme in `ADR_THEMES`; an open issue needs a `lane:*` label.
```

- [ ] **Step 6: Verify everything**

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
npm run check && npm run lint && npm run format:check && npm run check:ts-only && npm run test:coverage && npm run docs
```

Expected: 0 errors, coverage above the floor, and TypeDoc with no warnings. Paste the coverage summary lines into the PR description.

- [ ] **Step 7: Commit, push, and open the PR**

```bash
git add RELEASING.md docs/workflows.md docs/quality/README.md CLAUDE.md
git commit -m "docs: releases attach an overview PDF built at the tag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feat/release-overview-pdf
gh pr create --title "feat: a release overview PDF at each tag" --body-file <(cat <<'EOF'
Every release now carries `my-svelte-app-overview-<tag>.pdf` and `metrics.json`, like the finance-tools releases. Pushing the tag creates the pre-release too.

- `src/lib/overview/`: pure parsers and the HTML document. The decisions come from `docs/adr/`, the history from `CHANGELOG.md`, the quality figures from `metrics.json` measured at the tag, and the roadmap from `lane:*` labels, merged PRs and open issues. The curated parts come from `docs/overview.md`.
- `scripts/build-overview.ts` prints the PDF with Playwright's Chromium; mermaid is loaded from node_modules. `scripts/release-notes.ts` replaces the awk in RELEASING.md.
- `release-assets.yml`: tag → release (if missing) → measure and build → attach. PRs that touch the inputs get a preview artifact, and manual runs dry-run by default.
- `docs/overview.md` keeps only the curated parts. RELEASING.md drops the hand-copied quality snapshot, and step 5 becomes pushing the tag.
- Labels `lane:*` created, and the six open issues labelled.

Spec: `docs/superpowers/specs/2026-11-22-release-overview-pdf-design.md`. Plan: `docs/superpowers/plans/2026-11-22-release-overview-pdf.md`.

The existing tags cannot be rebuilt (no script in their checkout), so the first PDF comes with the next release. This PR's own preview artifact is the check before then.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

Do not merge. When the PR's `release-assets.yml` run finishes, download the preview (`gh run download <run-id> -n release-assets`), look at its pages, and report to the owner.
