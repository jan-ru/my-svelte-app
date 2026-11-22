import { describe, expect, it } from 'vitest';
import config from '../../../vitest.config.ts';
import type { Metrics } from '../metrics.ts';
import { COVERAGE_FLOOR_LINES, isMetrics, qualityView } from './quality.ts';

const METRICS: Metrics = {
	schema_version: 1,
	repo: 'jan-ru/my-svelte-app',
	commit: 'abc',
	ref: 'refs/tags/2026.11.29',
	measured_at: '2026-11-29T10:00:00Z',
	source: { run_url: 'https://github.com/jan-ru/my-svelte-app/actions/runs/1' },
	quality: { coverage_pct: 99, lint_errors: 0, type_errors: 0, tests: { passed: 1024, failed: 0, skipped: 2 } },
	security: { vulnerabilities: { scanner: 'npm audit', critical: 0, high: 0, medium: 1, low: 3 } }
};

describe('qualityView', () => {
	it('turns metrics.json into rows, each judged', () => {
		const view = qualityView(METRICS);
		expect(view.measuredAt).toBe('2026-11-29T10:00:00Z');
		expect(view.runUrl).toContain('/actions/runs/1');
		expect(view.rows.map((r) => [r.value, r.ok])).toEqual([
			['1024 passed, 0 failed, 2 skipped', true],
			['99.0% (floor 95%)', true],
			['0', true],
			['0', true],
			['0 critical, 0 high, 1 moderate, 3 low', true]
		]);
	});
	it('says "not measured" for what is missing, and judges failures', () => {
		const view = qualityView({
			...METRICS,
			quality: { tests: { passed: 1, failed: 2, skipped: 0 } },
			security: undefined
		});
		expect(view.rows.map((r) => r.ok)).toEqual([false, undefined, false, false, undefined]);
		expect(qualityView(undefined).rows.every((r) => r.value === 'not measured')).toBe(true);
	});
	it('says "failed" when metrics exist but a step left its count out, and "not measured" without metrics', () => {
		const failed = qualityView({ ...METRICS, quality: { coverage_pct: 99 } }).rows;
		expect(failed.slice(2, 4).map((r) => [r.value, r.ok])).toEqual([
			['failed', false],
			['failed', false]
		]);
		expect(
			qualityView(undefined)
				.rows.slice(2, 4)
				.map((r) => [r.value, r.ok])
		).toEqual([
			['not measured', undefined],
			['not measured', undefined]
		]);
	});
	it('labels the advisories row as all dependencies', () => {
		expect(qualityView(METRICS).rows.at(-1)?.label).toBe('Advisories, all dependencies (npm audit)');
	});
});

describe('isMetrics', () => {
	it('accepts a metrics.json and refuses anything else', () => {
		expect(isMetrics(METRICS)).toBe(true);
		expect(isMetrics({ schema_version: 2 })).toBe(false);
	});
});

it('COVERAGE_FLOOR_LINES is the floor in vitest.config.ts', () => {
	expect(config.test?.coverage).toMatchObject({ thresholds: { lines: COVERAGE_FLOOR_LINES } });
});
