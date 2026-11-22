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
dl { display: grid; grid-template-columns: 20mm 1fr; gap: 1mm 2mm; margin: 0; }
dt { font-weight: 600; color: #2c5a85; white-space: nowrap; }
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
pre.mermaid { text-align: center; background: none; break-inside: avoid; }
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
