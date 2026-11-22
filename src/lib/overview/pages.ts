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

/** The design page. */
export function designPage(curated: Curated): string {
	return page('The design at a glance', 'drawn from docs/overview.md §1', md(curated.design));
}

/** The decisions page. */
export function decisionsPage(intro: string, view: DecisionsView): string {
	const counts = `${view.total} ADRs: ${view.accepted} accepted, ${view.proposed.length} proposed, ${view.superseded.length} superseded`;
	const groups = view.groups
		.map(
			(g) =>
				`<div class="group"><h2>${esc(g.theme)}</h2><dl>${g.adrs.map((a) => `<dt>${a.id}</dt><dd>${esc(a.title)}</dd>`).join('')}</dl></div>`
		)
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

/** The release history page. */
export function historyPage(curated: Curated, rows: readonly HistoryRow[]): string {
	const early = curated.earlyHistory.map((r) => `<tr><td>${esc(r.when)}</td><td>${md(r.theme)}</td></tr>`).join('');
	const releases = rows
		.map((r) => `<tr><td><b>${esc(r.version)}</b><br>${esc(r.date)}</td><td>${md(r.lead)}</td></tr>`)
		.join('');
	return page(
		'Release history',
		`${rows.length} releases · condensed from CHANGELOG.md`,
		`<div class="intro">${md(curated.intros.history)}</div><h2>Before the first release</h2><table>${early}</table><h2>Releases</h2><table>${releases}</table>`
	);
}

const mark = (ok: boolean | undefined): string => (ok === undefined ? '○' : ok ? '●' : '✕');

/** The quality page. */
export function qualityPage(intro: string, view: QualityView, health: string): string {
	const rows = view.rows
		.map(
			(r) =>
				`<tr><td class="mark ${r.ok === false ? 'bad' : ''}">${mark(r.ok)}</td><td>${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`
		)
		.join('');
	const measured = view.measuredAt ? `measured at the tag on ${esc(view.measuredAt)}` : 'not measured: a preview';
	return page(
		'Quality',
		`${measured}${view.runUrl ? ` · ${esc(view.runUrl)}` : ''}`,
		`<div class="intro">${md(intro)}</div><table class="figures">${rows}</table><h2>Health at a glance</h2>${md(health)}`
	);
}

const items = (list: readonly Item[], more = 0): string =>
	list.map((i) => `<li>#${i.number} ${esc(i.title)}</li>`).join('') +
	(more > 0 ? `<li class="more">+${more} more</li>` : '');

const cell = (list: readonly Item[], more = 0): string => (list.length === 0 ? '—' : `<ul>${items(list, more)}</ul>`);

const laneRow = (r: LaneRow): string =>
	`<tr><th>${esc(r.name)}</th><td>${cell(r.landed, r.landedMore)}</td><td>${cell(r.next)}</td><td>${r.later ? md(r.later) : '—'}</td></tr>`;

/** The roadmap page. */
export function roadmapPage(intro: string, view: RoadmapView, release: string): string {
	const deps =
		view.dependencyUpdates > 0
			? `<p class="note">Also landed: ${view.dependencyUpdates} dependency ${view.dependencyUpdates === 1 ? 'update' : 'updates'}.</p>`
			: '';
	return page(
		'Roadmap',
		'Landed: PRs merged since the previous release · Next: open issues · Later: curated',
		`<div class="intro">${md(intro)}</div><table class="roadmap"><tr><th></th><th>Landed · in ${esc(release)}</th><th>Next</th><th>Later</th></tr>${view.rows.map(laneRow).join('')}</table>${deps}`
	);
}
