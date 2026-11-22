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
	roadmap: roadmapView({
		issues: [{ number: 135, title: 'Side <menu>', labels: ['lane:financials'] }],
		prs: [],
		later: { Valuation: 'DCF' }
	}),
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
