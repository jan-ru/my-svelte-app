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
