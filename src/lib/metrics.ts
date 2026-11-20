// src/lib/metrics.ts
// Builds the metrics.json that jan-ru/system-health collects (its schema/metrics.v1.schema.json, ADR-0003 there). Pure:
// it translates reports the tools already wrote and measures nothing itself. scripts/build-metrics.ts does the I/O.
//
// The rules are system-health's: a field left out was not measured, 0 means measured and zero, and nothing is ever
// filled in with 0 or null to stand for "unknown".

/** Test counts, as the schema's `quality.tests`. */
export interface TestCounts {
	readonly passed: number;
	readonly failed: number;
	readonly skipped: number;
}

/** Advisory counts by severity, with the scanner that counted them. */
export interface Vulnerabilities {
	readonly scanner: string;
	readonly critical: number;
	readonly high: number;
	readonly medium: number;
	readonly low: number;
}

/** Lighthouse category scores, 0 to 1. A category Lighthouse could not score is left out. */
export interface LighthouseScores {
	readonly performance?: number;
	readonly accessibility?: number;
	readonly best_practices?: number;
	readonly seo?: number;
}

/** One gate of this repository and whether it passed on the measured commit. */
export interface Gate {
	readonly name: string;
	readonly passed: boolean;
}

/** A metrics.json document, version 1. Only the parts this repository measures. */
export interface Metrics {
	readonly schema_version: 1;
	readonly repo: string;
	readonly commit: string;
	readonly ref: string;
	readonly measured_at: string;
	readonly source?: { readonly run_url: string };
	readonly quality?: {
		readonly coverage_pct?: number;
		readonly lint_errors?: number;
		readonly type_errors?: number;
		readonly tests?: TestCounts;
	};
	readonly security?: { readonly vulnerabilities: Vulnerabilities };
	readonly performance?: { readonly lighthouse: LighthouseScores };
	readonly gates?: readonly Gate[];
}

/** Everything the measurement is built from. Each report is the parsed file, or undefined when it was not written. */
export interface MetricsInput {
	/** `GITHUB_REPOSITORY`, `GITHUB_SHA`, `GITHUB_REF`, and for the run link `GITHUB_SERVER_URL` and `GITHUB_RUN_ID`. */
	readonly env: Readonly<Record<string, string | undefined>>;
	readonly now: Date;
	/** Vitest's `--reporter=json` output. */
	readonly vitest?: unknown;
	/** Playwright's `json` reporter output. */
	readonly playwright?: unknown;
	/** The `json-summary` coverage report (`coverage/coverage-summary.json`). */
	readonly coverageSummary?: unknown;
	/** `npm audit --json`. */
	readonly npmAudit?: unknown;
	/** Every Lighthouse result (`.lighthouseci/lhr-*.json`) of the run. */
	readonly lighthouse?: readonly unknown[];
	/** The outcome (`success`, `failure`, ...) of the `npm run check` (svelte-check) and `npm run lint` steps. */
	readonly checkOutcome?: string;
	readonly lintOutcome?: string;
	/** The `test` job's result: the merge gate. */
	readonly testResult?: string;
}

/** The page whose Lighthouse scores stand for the app: the home page. */
export const LIGHTHOUSE_PATH = '/';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Test counts from a Vitest JSON report. Pending and todo tests count as skipped. */
export function vitestTests(report: unknown): TestCounts | undefined {
	const passed = field(report, 'numPassedTests');
	const failed = field(report, 'numFailedTests');
	const pending = field(report, 'numPendingTests') ?? 0;
	const todo = field(report, 'numTodoTests') ?? 0;
	if (!isCount(passed) || !isCount(failed) || !isCount(pending) || !isCount(todo)) return undefined;
	return { passed, failed, skipped: pending + todo };
}

/** Test counts from a Playwright JSON report. A flaky test passed on a retry, so it counts as passed. */
export function playwrightTests(report: unknown): TestCounts | undefined {
	const stats = field(report, 'stats');
	const expected = field(stats, 'expected');
	const flaky = field(stats, 'flaky');
	const unexpected = field(stats, 'unexpected');
	const skipped = field(stats, 'skipped');
	if (!isCount(expected) || !isCount(flaky) || !isCount(unexpected) || !isCount(skipped)) return undefined;
	return { passed: expected + flaky, failed: unexpected, skipped };
}

/** The sum of the suites that reported; undefined when none did. */
export function sumTests(suites: readonly (TestCounts | undefined)[]): TestCounts | undefined {
	const measured = suites.filter((s): s is TestCounts => s !== undefined);
	if (measured.length === 0) return undefined;
	const sum = (key: keyof TestCounts): number => measured.reduce((total, s) => total + s[key], 0);
	return { passed: sum('passed'), failed: sum('failed'), skipped: sum('skipped') };
}

/** Line coverage in percent from a json-summary report, to one decimal. */
export function linePct(summary: unknown): number | undefined {
	const pct = field(field(field(summary, 'total'), 'lines'), 'pct');
	return typeof pct === 'number' && pct >= 0 && pct <= 100 ? round1(pct) : undefined;
}

/** npm audit's counts. npm calls medium `moderate`. */
export function npmAuditCounts(report: unknown): Vulnerabilities | undefined {
	const v = field(field(report, 'metadata'), 'vulnerabilities');
	const [critical, high, medium, low] = ['critical', 'high', 'moderate', 'low'].map((key) => field(v, key));
	if (!isCount(critical) || !isCount(high) || !isCount(medium) || !isCount(low)) return undefined;
	return { scanner: 'npm-audit', critical, high, medium, low };
}

const pathOf = (url: unknown): string | undefined => {
	if (typeof url !== 'string') return undefined;
	try {
		return new URL(url).pathname;
	} catch {
		return undefined;
	}
};

const score = (categories: unknown, key: string): number | undefined => {
	const value = field(field(categories, key), 'score');
	return typeof value === 'number' && value >= 0 && value <= 1 ? value : undefined;
};

/** The category scores of the Lighthouse result for `path`; undefined when there is none or it scored nothing. */
export function lighthouseScores(results: readonly unknown[], path = LIGHTHOUSE_PATH): LighthouseScores | undefined {
	const result = results.find((r) => pathOf(field(r, 'requestedUrl')) === path);
	const categories = field(result, 'categories');
	const entries = [
		['performance', score(categories, 'performance')],
		['accessibility', score(categories, 'accessibility')],
		['best_practices', score(categories, 'best-practices')],
		['seo', score(categories, 'seo')]
	] as const;
	const scored = entries.filter(([, value]) => value !== undefined);
	return scored.length > 0 ? Object.fromEntries(scored) : undefined;
}

/**
 * Errors counted by a gate step that fails on any error (svelte-check, ESLint): a passing step measured 0. A failed
 * step's count is not known, so it is left out, and the failure shows in the `test` gate instead.
 */
export function errorsFromOutcome(outcome: string | undefined): number | undefined {
	return outcome === 'success' ? 0 : undefined;
}

/** Drops the keys whose value is undefined, so an unmeasured field is left out rather than written as null. */
function defined<T extends object>(value: T): Partial<T> | undefined {
	const entries = Object.entries(value).filter(([, v]) => v !== undefined);
	return entries.length > 0 ? (Object.fromEntries(entries) as Partial<T>) : undefined;
}

/** The metrics document. Throws when the environment does not name the repository, commit and ref measured. */
export function buildMetrics(input: MetricsInput): Metrics {
	const { env } = input;
	const repo = env.GITHUB_REPOSITORY;
	const commit = env.GITHUB_SHA;
	const ref = env.GITHUB_REF;
	if (!repo || !commit || !ref) {
		throw new Error('GITHUB_REPOSITORY, GITHUB_SHA and GITHUB_REF must be set: metrics.json names what it measured');
	}

	const unit = vitestTests(input.vitest);
	const tests = sumTests([unit, playwrightTests(input.playwright)]);
	// a run with failing unit tests does not measure the code, so its coverage is left out
	const coverage = unit?.failed === 0 ? linePct(input.coverageSummary) : undefined;
	const quality = defined({
		coverage_pct: coverage,
		lint_errors: errorsFromOutcome(input.lintOutcome),
		type_errors: errorsFromOutcome(input.checkOutcome),
		tests
	});
	const vulnerabilities = npmAuditCounts(input.npmAudit);
	const lighthouse = lighthouseScores(input.lighthouse ?? []);
	const runUrl =
		env.GITHUB_SERVER_URL && env.GITHUB_RUN_ID
			? `${env.GITHUB_SERVER_URL}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`
			: undefined;

	return {
		schema_version: 1,
		repo,
		commit,
		ref,
		measured_at: input.now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
		...(runUrl ? { source: { run_url: runUrl } } : {}),
		...(quality ? { quality } : {}),
		...(vulnerabilities ? { security: { vulnerabilities } } : {}),
		...(lighthouse ? { performance: { lighthouse } } : {}),
		...(input.testResult ? { gates: [{ name: 'test', passed: input.testResult === 'success' }] } : {})
	};
}
