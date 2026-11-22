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
