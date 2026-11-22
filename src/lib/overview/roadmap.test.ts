import { describe, expect, it } from 'vitest';
import {
	LANDED_CAP,
	closingNumbers,
	laneOf,
	parseIssues,
	parsePullRequest,
	roadmapView,
	type Issue,
	type PullRequest
} from './roadmap.ts';

const issue = (number: number, labels: readonly string[] = []): Issue => ({ number, title: `Issue ${number}`, labels });
const pr = (number: number, labels: readonly string[] = [], closes: readonly Issue[] = []): PullRequest => ({
	...issue(number, labels),
	title: `PR ${number}`,
	closes
});
const later = { Valuation: 'DCF', Financials: '', 'Reference pages': '', 'Design system': '', Releases: '' };

describe('the gh JSON guards', () => {
	it('read issues, closing references and a pull request', () => {
		const json = [{ number: 135, title: 'Side menu', labels: [{ name: 'lane:financials' }, { name: 'enhancement' }] }];
		expect(parseIssues(json)).toEqual([
			{ number: 135, title: 'Side menu', labels: ['lane:financials', 'enhancement'] }
		]);
		expect(closingNumbers({ closingIssuesReferences: [{ number: 135 }, { number: 7 }] })).toEqual([135, 7]);
		expect(parsePullRequest({ number: 160, title: 'x', labels: [] }, [])).toEqual({
			number: 160,
			title: 'x',
			labels: [],
			closes: []
		});
	});
	it('refuse anything else', () => {
		expect(() => parseIssues({})).toThrow(/a list of issues/);
		expect(() => parseIssues([{ number: '1', title: 't', labels: [] }])).toThrow(/not a GitHub issue/);
		expect(() => parseIssues([{ number: 1, title: 't', labels: [{}] }])).toThrow(/not a GitHub issue/);
		expect(closingNumbers({})).toEqual([]);
	});
});

describe('laneOf', () => {
	it('is the first lane label in LANES order, or Unsorted', () => {
		expect(laneOf(['enhancement'])).toEqual({ lane: 'Unsorted', ambiguous: false });
		expect(laneOf(['lane:releases', 'lane:valuation'])).toEqual({ lane: 'Valuation', ambiguous: true });
	});
});

describe('roadmapView', () => {
	it('places issues and PRs by lane; a PR without a label takes the lane of an issue it closes', () => {
		const view = roadmapView({
			issues: [issue(135, ['lane:financials']), issue(132, ['lane:reference'])],
			prs: [pr(160, ['lane:valuation']), pr(161, [], [issue(134, ['lane:financials'])]), pr(162, ['dependencies'])],
			later
		});
		const row = (name: string) => view.rows.find((r) => r.name === name);
		expect(row('Valuation')).toMatchObject({ landed: [{ number: 160, title: 'PR 160' }], next: [], later: 'DCF' });
		expect(row('Financials')).toMatchObject({ landed: [{ number: 161 }], next: [{ number: 135 }] });
		expect(row('Reference pages')?.next).toEqual([{ number: 132, title: 'Issue 132' }]);
		expect(view.dependencyUpdates).toBe(1);
		expect(view.rows.map((r) => r.name)).not.toContain('Unsorted');
		expect(view.warnings).toEqual([]);
	});
	it('adds an Unsorted row with a warning, and warns about two lane labels', () => {
		const view = roadmapView({
			issues: [issue(108), issue(110, ['lane:releases', 'lane:design-system'])],
			prs: [pr(170)],
			later
		});
		expect(view.rows.at(-1)).toMatchObject({ name: 'Unsorted', landed: [{ number: 170 }], next: [{ number: 108 }] });
		expect(view.warnings).toEqual([
			'#108 has no lane:* label',
			'#110 has more than one lane:* label; shown under Design system',
			'#170 (PR) has no lane: label it, or the issue it closes, with lane:*'
		]);
	});
	it('caps Landed and counts the rest', () => {
		const prs = Array.from({ length: LANDED_CAP + 3 }, (_, i) => pr(200 + i, ['lane:valuation']));
		const valuation = roadmapView({ issues: [], prs, later }).rows[0];
		expect(valuation?.landed).toHaveLength(LANDED_CAP);
		expect(valuation?.landedMore).toBe(3);
	});
	it('refuses a Later row for a lane that does not exist', () => {
		expect(() => roadmapView({ issues: [], prs: [], later: { Pricing: 'x' } })).toThrow(
			/lanes that do not exist: Pricing/
		);
	});
});
