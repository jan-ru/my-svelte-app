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

/** A count of errors. With metrics but no count the step failed, and build-metrics left the count out. */
const errors = (label: string, n: number | undefined, measured: boolean): QualityRow => ({
	label,
	value: n !== undefined ? String(n) : measured ? 'failed' : NOT_MEASURED,
	ok: n !== undefined ? n === 0 : measured ? false : undefined
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
			errors('Type errors (svelte-check)', q?.type_errors, metrics !== undefined),
			errors('Lint errors (ESLint)', q?.lint_errors, metrics !== undefined),
			{
				label: 'Advisories, all dependencies (npm audit)',
				value: v ? `${v.critical} critical, ${v.high} high, ${v.medium} moderate, ${v.low} low` : NOT_MEASURED,
				ok: v ? v.critical + v.high === 0 : undefined
			}
		]
	};
}
