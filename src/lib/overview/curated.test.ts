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
