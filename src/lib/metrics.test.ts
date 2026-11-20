import { describe, expect, it } from 'vitest';
import {
	buildMetrics,
	errorsFromOutcome,
	lighthouseScores,
	linePct,
	npmAuditCounts,
	playwrightTests,
	sumTests,
	vitestTests,
	type MetricsInput
} from './metrics.ts';

const ENV = {
	GITHUB_REPOSITORY: 'jan-ru/my-svelte-app',
	GITHUB_SHA: '28cf251f7b5df16e78fc82067a93d0ffd5914c2c',
	GITHUB_REF: 'refs/heads/main',
	GITHUB_SERVER_URL: 'https://github.com',
	GITHUB_RUN_ID: '42'
};
const NOW = new Date('2026-11-20T10:00:00.123Z');

const vitest = { numTotalTests: 12, numPassedTests: 10, numFailedTests: 0, numPendingTests: 1, numTodoTests: 1 };
const playwright = { stats: { expected: 20, unexpected: 0, flaky: 1, skipped: 2 } };
const coverageSummary = { total: { lines: { total: 100, covered: 98, pct: 98.74 } } };
const npmAudit = { metadata: { vulnerabilities: { info: 0, low: 2, moderate: 1, high: 0, critical: 0, total: 3 } } };
const lhr = (url: string, perf: number | null) => ({
	requestedUrl: url,
	categories: {
		performance: { score: perf },
		accessibility: { score: 1 },
		'best-practices': { score: 0.96 },
		seo: { score: 0.92 }
	}
});

describe('vitestTests', () => {
	it('counts pending and todo tests as skipped', () => {
		expect(vitestTests(vitest)).toEqual({ passed: 10, failed: 0, skipped: 2 });
	});
	it('treats missing pending and todo counts as none', () => {
		expect(vitestTests({ numPassedTests: 3, numFailedTests: 1 })).toEqual({ passed: 3, failed: 1, skipped: 0 });
	});
	it('rejects a report without counts', () => {
		expect(vitestTests(undefined)).toBeUndefined();
		expect(vitestTests({ numPassedTests: '3', numFailedTests: 0 })).toBeUndefined();
		expect(vitestTests({ numPassedTests: 3, numFailedTests: -1 })).toBeUndefined();
	});
});

describe('playwrightTests', () => {
	it('counts flaky tests as passed', () => {
		expect(playwrightTests(playwright)).toEqual({ passed: 21, failed: 0, skipped: 2 });
	});
	it('rejects a report without stats', () => {
		expect(playwrightTests({})).toBeUndefined();
		expect(playwrightTests({ stats: { expected: 1, unexpected: 0, flaky: 0 } })).toBeUndefined();
	});
});

describe('sumTests', () => {
	it('adds the suites that reported', () => {
		expect(sumTests([{ passed: 1, failed: 2, skipped: 3 }, undefined, { passed: 10, failed: 0, skipped: 1 }])).toEqual({
			passed: 11,
			failed: 2,
			skipped: 4
		});
	});
	it('is undefined when no suite reported', () => {
		expect(sumTests([undefined, undefined])).toBeUndefined();
	});
});

describe('linePct', () => {
	it('reads line coverage to one decimal', () => {
		expect(linePct(coverageSummary)).toBe(98.7);
	});
	it('rejects a missing or impossible percentage', () => {
		expect(linePct({ total: {} })).toBeUndefined();
		expect(linePct({ total: { lines: { pct: 101 } } })).toBeUndefined();
		expect(linePct({ total: { lines: { pct: 'Unknown' } } })).toBeUndefined();
	});
});

describe('npmAuditCounts', () => {
	it('maps moderate to medium and names the scanner', () => {
		expect(npmAuditCounts(npmAudit)).toEqual({ scanner: 'npm-audit', critical: 0, high: 0, medium: 1, low: 2 });
	});
	it('rejects an audit that failed (an error object, no counts)', () => {
		expect(npmAuditCounts({ error: { code: 'ENOLOCK' } })).toBeUndefined();
		expect(npmAuditCounts([])).toBeUndefined();
	});
});

describe('lighthouseScores', () => {
	it('takes the home page and renames best-practices', () => {
		const results = [lhr('http://localhost:4173/about', 0.5), lhr('http://localhost:4173/', 0.97)];
		expect(lighthouseScores(results)).toEqual({ performance: 0.97, accessibility: 1, best_practices: 0.96, seo: 0.92 });
	});
	it('leaves out a category Lighthouse could not score', () => {
		expect(lighthouseScores([lhr('http://localhost:4173/', null)])).toEqual({
			accessibility: 1,
			best_practices: 0.96,
			seo: 0.92
		});
	});
	it('is undefined without a result for the page', () => {
		expect(
			lighthouseScores([lhr('http://localhost:4173/about', 1), { requestedUrl: 'not a url' }, null])
		).toBeUndefined();
		expect(lighthouseScores([{ requestedUrl: 'http://localhost:4173/', categories: {} }])).toBeUndefined();
	});
});

describe('errorsFromOutcome', () => {
	it('is 0 for a passing gate step and unknown otherwise', () => {
		expect(errorsFromOutcome('success')).toBe(0);
		expect(errorsFromOutcome('failure')).toBeUndefined();
		expect(errorsFromOutcome('skipped')).toBeUndefined();
		expect(errorsFromOutcome(undefined)).toBeUndefined();
	});
});

describe('buildMetrics', () => {
	const full: MetricsInput = {
		env: ENV,
		now: NOW,
		vitest,
		playwright,
		coverageSummary,
		npmAudit,
		lighthouse: [lhr('http://localhost:4173/', 0.97)],
		checkOutcome: 'success',
		lintOutcome: 'success',
		testResult: 'success'
	};

	it('builds the whole document from every report', () => {
		expect(buildMetrics(full)).toEqual({
			schema_version: 1,
			repo: 'jan-ru/my-svelte-app',
			commit: '28cf251f7b5df16e78fc82067a93d0ffd5914c2c',
			ref: 'refs/heads/main',
			measured_at: '2026-11-20T10:00:00Z',
			source: { run_url: 'https://github.com/jan-ru/my-svelte-app/actions/runs/42' },
			quality: { coverage_pct: 98.7, lint_errors: 0, type_errors: 0, tests: { passed: 31, failed: 0, skipped: 4 } },
			security: { vulnerabilities: { scanner: 'npm-audit', critical: 0, high: 0, medium: 1, low: 2 } },
			performance: { lighthouse: { performance: 0.97, accessibility: 1, best_practices: 0.96, seo: 0.92 } },
			gates: [{ name: 'test', passed: true }]
		});
	});

	it('leaves out everything that was not measured, never writing 0 or null', () => {
		const bare = buildMetrics({ env: { ...ENV, GITHUB_RUN_ID: undefined }, now: NOW });
		expect(bare).toEqual({
			schema_version: 1,
			repo: ENV.GITHUB_REPOSITORY,
			commit: ENV.GITHUB_SHA,
			ref: ENV.GITHUB_REF,
			measured_at: '2026-11-20T10:00:00Z'
		});
		expect(JSON.stringify(bare)).not.toContain('null');
	});

	it('drops coverage when unit tests failed, and marks the gate failed', () => {
		const metrics = buildMetrics({
			...full,
			vitest: { ...vitest, numPassedTests: 9, numFailedTests: 1 },
			lintOutcome: 'failure',
			testResult: 'failure'
		});
		expect(metrics.quality).toEqual({ type_errors: 0, tests: { passed: 30, failed: 1, skipped: 4 } });
		expect(metrics.gates).toEqual([{ name: 'test', passed: false }]);
	});

	it('refuses to write a file that does not say what it measured', () => {
		expect(() => buildMetrics({ env: { ...ENV, GITHUB_SHA: undefined }, now: NOW })).toThrow(/GITHUB_SHA/);
	});
});
