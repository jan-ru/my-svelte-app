import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LAYOUT,
	DEFAULT_SELECTION,
	applyRole,
	parseParams,
	toSearchParams
} from './params';

const parse = (q: string) => parseParams(new URLSearchParams(q));

describe('parseParams', () => {
	it('uses the defaults when there are no params', () => {
		expect(parse('')).toEqual({ selection: DEFAULT_SELECTION, layout: DEFAULT_LAYOUT });
	});

	it('keeps valid ids and drops unknown ones', () => {
		const { selection } = parse('m=pe_trailing&m=nope&r=europe');
		expect(selection.multiples).toEqual(['pe_trailing']);
		expect(selection.regions).toEqual(['europe']);
		expect(selection.industries).toEqual(DEFAULT_SELECTION.industries);
	});

	it('removes duplicates and keeps at most 4', () => {
		const { selection } = parse(
			'm=ev_ebitda&m=ev_ebitda&m=ev_ebit&m=pe_trailing&m=pe_forward&m=pbv'
		);
		expect(selection.multiples).toEqual(['ev_ebitda', 'ev_ebit', 'pe_trailing', 'pe_forward']);
	});

	it('treats an empty param as a cleared list', () => {
		const { selection } = parse('m=&r=us&i=Steel');
		expect(selection.multiples).toEqual([]);
		expect(selection.regions).toEqual(['us']);
		expect(selection.industries).toEqual(['Steel']);
	});

	it('treats a param with only unknown values as absent', () => {
		expect(parse('m=nope').selection.multiples).toEqual(DEFAULT_SELECTION.multiples);
	});

	it('accepts free-text industry names and removes duplicates', () => {
		const { selection } = parse('i=Steel&i=Steel&i=Software+(Internet)');
		expect(selection.industries).toEqual(['Steel', 'Software (Internet)']);
	});

	it('reads a valid layout', () => {
		expect(parse('p=regions&x=multiples&c=industries').layout).toEqual({
			panels: 'regions',
			x: 'multiples',
			color: 'industries'
		});
	});

	it('falls back to the default layout when roles repeat or are unknown', () => {
		expect(parse('p=regions&x=regions&c=industries').layout).toEqual(DEFAULT_LAYOUT);
		expect(parse('p=foo&x=regions&c=industries').layout).toEqual(DEFAULT_LAYOUT);
	});
});

describe('toSearchParams', () => {
	it('round-trips a view', () => {
		const view = {
			selection: { multiples: ['pbv'], regions: ['us', 'japan'], industries: ['Steel', 'Banks (Regional)'] },
			layout: { panels: 'regions', x: 'multiples', color: 'industries' } as const
		};
		expect(parseParams(toSearchParams(view))).toEqual(view);
	});

	it('writes an empty list as an empty param so it stays cleared', () => {
		const view = {
			selection: { multiples: [], regions: ['us'], industries: ['Steel'] },
			layout: DEFAULT_LAYOUT
		};
		expect(toSearchParams(view).getAll('m')).toEqual(['']);
		expect(parseParams(toSearchParams(view)).selection.multiples).toEqual([]);
	});
});

describe('applyRole', () => {
	it('swaps with the role that already uses the chosen dimension', () => {
		expect(applyRole(DEFAULT_LAYOUT, 'panels', 'regions')).toEqual({
			panels: 'regions',
			x: 'industries',
			color: 'multiples'
		});
	});

	it('changes nothing when the dimension is already assigned to that role', () => {
		expect(applyRole(DEFAULT_LAYOUT, 'x', 'industries')).toEqual(DEFAULT_LAYOUT);
	});
});
