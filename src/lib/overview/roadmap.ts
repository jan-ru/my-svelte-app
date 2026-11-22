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
	if (
		typeof number !== 'number' ||
		typeof title !== 'string' ||
		!isList(labels) ||
		!names.every((n) => typeof n === 'string')
	) {
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
		throw new Error(
			`docs/overview.md: the roadmap names lanes that do not exist: ${unknown.join(', ')} (LANES in src/lib/overview/roadmap.ts)`
		);
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
				.map((i) => `#${i.number} has more than one lane:* label; shown under ${laneOf(i.labels).lane}`),
			...work
				.filter((pr) => prLane(pr) === UNSORTED)
				.map((pr) => `#${pr.number} (PR) has no lane: label it, or the issue it closes, with lane:*`)
		]
	};
}
