import { describe, expect, it } from 'vitest';
import { buildLayout } from './layout';
import { DEFAULT_LAYOUT, type Selection } from './params';
import type { Comparison } from './server/compare';

const selection: Selection = {
	multiples: ['ev_ebitda', 'pe_trailing'],
	regions: ['us', 'europe'],
	industries: ['Software', 'Steel']
};

const comparison: Comparison = {
	updated: '2026-01-05',
	cells: {
		ev_ebitda: {
			us: { Software: { value: 18, firms: 100 }, Steel: { value: 6, firms: 20 } },
			europe: { Software: { value: 14, firms: 80 }, Steel: { value: null, firms: 3 } }
		},
		pe_trailing: {
			us: { Software: { value: 25, firms: 100 }, Steel: { value: 10, firms: 20 } },
			europe: { Software: { value: 20, firms: 80 }, Steel: { value: 9, firms: 3 } }
		}
	},
	errors: {}
};

describe('buildLayout', () => {
	it('makes a panel per multiple, industries on x, regions as colours', () => {
		const model = buildLayout(selection, DEFAULT_LAYOUT, comparison);
		expect(model.panels.map((p) => p.title)).toEqual(['EV/EBITDA', 'P/E (trailing)']);
		expect(model.series).toEqual(['US', 'Europe']);

		const first = model.panels[0];
		expect(first.categories).toEqual(['Software', 'Steel']);
		expect(first.series).toEqual(['US', 'Europe']);
		expect(first.bars[0]).toEqual([
			{ value: 18, firms: 100 },
			{ value: 14, firms: 80 }
		]);
		expect(first.bars[1][1]).toEqual({ value: null, firms: 3 });
	});

	it('follows a pivoted layout', () => {
		const model = buildLayout(
			selection,
			{ panels: 'regions', x: 'multiples', color: 'industries' },
			comparison
		);
		expect(model.panels.map((p) => p.title)).toEqual(['US', 'Europe']);
		expect(model.series).toEqual(['Software', 'Steel']);

		const us = model.panels[0];
		expect(us.categories).toEqual(['EV/EBITDA', 'P/E (trailing)']);
		expect(us.bars[0]).toEqual([
			{ value: 18, firms: 100 },
			{ value: 6, firms: 20 }
		]);
		expect(us.bars[1]).toEqual([
			{ value: 25, firms: 100 },
			{ value: 10, firms: 20 }
		]);
	});

	it('marks bars whose multiple and region failed to load', () => {
		const failed: Comparison = {
			...comparison,
			cells: { ...comparison.cells, ev_ebitda: { us: comparison.cells.ev_ebitda.us } },
			errors: { 'ev_ebitda:europe': 'Data unavailable: down' }
		};
		const model = buildLayout(selection, DEFAULT_LAYOUT, failed);
		expect(model.panels[0].bars[0][1]).toEqual({
			value: null,
			firms: null,
			error: 'Data unavailable: down'
		});
		expect(model.panels[1].bars[0][1]).toEqual({ value: 20, firms: 80 });
	});
});
