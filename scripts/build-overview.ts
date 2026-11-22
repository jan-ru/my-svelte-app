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
import {
	closingNumbers,
	parseIssues,
	parsePullRequest,
	roadmapView,
	type Issue,
	type PullRequest
} from '../src/lib/overview/roadmap.ts';

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

/** True when gh says the number does not resolve (a PR or issue of another repository, or none); any other failure is real. */
const notFound = (error: unknown): boolean =>
	typeof error === 'object' && error !== null && 'stderr' in error && /Could not resolve to/.test(String(error.stderr));

const issue = (n: number): Issue | undefined => {
	try {
		return parseIssues([ghJson(['issue', 'view', String(n), '--json', 'number,title,labels'])])[0];
	} catch (error) {
		if (notFound(error)) return undefined; // no lane from it
		throw error;
	}
};

interface Landed {
	readonly prs: readonly PullRequest[];
	readonly warnings: readonly string[];
}

const pullRequest = (n: number): PullRequest | undefined => {
	try {
		const json = ghJson(['pr', 'view', String(n), '--json', 'number,title,labels,closingIssuesReferences']);
		const closes = closingNumbers(json).flatMap((c) => issue(c) ?? []);
		return parsePullRequest(json, closes);
	} catch (error) {
		if (notFound(error)) return undefined;
		throw error;
	}
};

/** The PRs merged in a range, with the issues each closes; a number that is not a pull request here is skipped with a warning. */
function landed(range: string): Landed {
	const found = prsIn(range).map((n) => ({ n, pr: pullRequest(n) }));
	return {
		prs: found.flatMap(({ pr }) => pr ?? []),
		warnings: found
			.filter(({ pr }) => pr === undefined)
			.map(({ n }) => `#${n} is not a pull request here: left out of Landed`)
	};
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
	const issues = parseIssues(
		ghJson(['issue', 'list', '--state', 'open', '--limit', '500', '--json', 'number,title,labels'])
	);
	const name = release ?? 'preview';
	const { prs, warnings } = landed(previous ? `${previous}..${ref}` : ref);
	const roadmap = roadmapView({ issues, prs, later: curated.later });
	return {
		release: name,
		preview: release === undefined,
		date: release ? run('git', ['log', '-1', '--format=%cs', release]) : new Date().toISOString().slice(0, 10),
		commit: run('git', ['rev-parse', '--short', `${ref}^{commit}`]),
		fileName: `my-svelte-app-overview-${name}.pdf`,
		curated,
		health: sectionBody(read('docs/quality/README.md'), 'Health at a glance', 'docs/quality/README.md'),
		decisions: decisionsView(adrs),
		history: historyRows(sections),
		quality: readMetrics(metrics),
		roadmap: { ...roadmap, warnings: [...roadmap.warnings, ...warnings] }
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
		await page.waitForFunction(() =>
			[...document.querySelectorAll('pre.mermaid')].every((el) => el.querySelector('svg'))
		);
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
