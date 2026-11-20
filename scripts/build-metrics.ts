// Writes the metrics.json that jan-ru/system-health collects, from the reports CI kept (see src/lib/metrics.ts).
//
//   node scripts/build-metrics.ts <reports-dir> > metrics.json
//
// Every report is optional; a missing one shows up as "not measured". <reports-dir> holds:
//   test/vitest.json              Vitest --reporter=json
//   test/playwright.json          Playwright's json reporter
//   test/coverage-summary.json    Vitest coverage, json-summary
//   lighthouse/lhr-*.json         the Lighthouse results of `lhci collect`
//   npm-audit.json                npm audit --json
// The step and job results come from the environment: CHECK_OUTCOME, LINT_OUTCOME and TEST_RESULT.
import fs from 'node:fs';
import path from 'node:path';
import { buildMetrics } from '../src/lib/metrics.ts';

function readJson(file: string): unknown {
	if (!fs.existsSync(file)) return undefined;
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
	} catch {
		console.error(`${file} is not valid JSON: left out, so it shows as not measured`);
		return undefined;
	}
}

const dir = process.argv[2];
if (!dir) {
	console.error('usage: node scripts/build-metrics.ts <reports-dir> > metrics.json');
	process.exit(2);
}

const lighthouseDir = path.join(dir, 'lighthouse');
const lighthouse = fs.existsSync(lighthouseDir)
	? fs
			.readdirSync(lighthouseDir)
			.filter((name) => /^lhr-.*\.json$/.test(name))
			.map((name) => readJson(path.join(lighthouseDir, name)))
	: [];

const metrics = buildMetrics({
	env: process.env,
	now: new Date(),
	vitest: readJson(path.join(dir, 'test', 'vitest.json')),
	playwright: readJson(path.join(dir, 'test', 'playwright.json')),
	coverageSummary: readJson(path.join(dir, 'test', 'coverage-summary.json')),
	npmAudit: readJson(path.join(dir, 'npm-audit.json')),
	lighthouse,
	checkOutcome: process.env.CHECK_OUTCOME,
	lintOutcome: process.env.LINT_OUTCOME,
	testResult: process.env.TEST_RESULT
});
console.log(JSON.stringify(metrics, null, 2));
