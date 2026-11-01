import { describe, expect, it } from 'vitest';
import { MULTIPLES } from './catalog';
import { BASIS, benchmark, percentile, pickYear, valuationView, valueMethod } from './valuation';
import type { Benchmark, CompanyFigures, PeerMultiples } from './valuation-data';

const figures: CompanyFigures = {
	name: 'Example BV',
	currency: 'EUR',
	origin: 'manual',
	netDebt: 100,
	years: [
		{ fiscalYear: '2024', kind: 'actual', values: { revenue: 800, ebitda: -10, netIncome: 20 } },
		{ fiscalYear: '2025', kind: 'actual', values: { revenue: 1000, ebitda: 200, ebit: 0, netIncome: 50 } },
		{ fiscalYear: '2026', kind: 'forecast', values: { revenue: 1200, ebitda: 250, netIncome: 80 } }
	]
};

const peer = (symbol: string, multiples: Record<string, number | null>): PeerMultiples => ({
	symbol,
	name: symbol,
	multiples
});

const bench = (
	multiple: string,
	p25: number | null,
	median: number | null,
	p75: number | null,
	sector: number | null = null
): Benchmark => ({
	multiple,
	count: 4,
	p25,
	median,
	p75,
	sector
});

describe('BASIS', () => {
	it('has an entry for every multiple in the catalog and nothing else', () => {
		expect(Object.keys(BASIS).toSorted()).toEqual(MULTIPLES.map((m) => m.id).toSorted());
	});
});

describe('percentile', () => {
	it('is null for no values', () => {
		expect(percentile([], 0.5)).toBeNull();
	});
	it('interpolates like PERCENTILE.INC', () => {
		const v = [1, 2, 3, 4];
		expect(percentile(v, 0)).toBe(1);
		expect(percentile(v, 0.25)).toBeCloseTo(1.75, 10);
		expect(percentile(v, 0.5)).toBe(2.5);
		expect(percentile(v, 0.75)).toBeCloseTo(3.25, 10);
		expect(percentile(v, 1)).toBe(4);
	});
	it('returns the one value of a single-value list', () => {
		expect(percentile([7], 0.25)).toBe(7);
	});
});

describe('benchmark', () => {
	it('drops missing, zero, negative and non-finite multiples before taking quartiles', () => {
		const peers = [
			peer('A', { ev_ebitda: 8 }),
			peer('B', { ev_ebitda: 12 }),
			peer('C', { ev_ebitda: 10 }),
			peer('D', { ev_ebitda: 6 }),
			peer('E', { ev_ebitda: -4 }),
			peer('F', { ev_ebitda: 0 }),
			peer('G', { ev_ebitda: null }),
			peer('H', { ev_ebitda: Number.POSITIVE_INFINITY }),
			peer('I', {})
		];
		expect(benchmark('ev_ebitda', peers, 9.5)).toEqual({
			multiple: 'ev_ebitda',
			count: 4,
			p25: 7.5,
			median: 9,
			p75: 10.5,
			sector: 9.5
		});
	});
	it('has no quartiles without peers and ignores an unusable sector value', () => {
		expect(benchmark('ps', [], -1)).toEqual({
			multiple: 'ps',
			count: 0,
			p25: null,
			median: null,
			p75: null,
			sector: null
		});
	});
});

describe('pickYear', () => {
	it('takes the latest actual year for trailing and the first forecast year for forward', () => {
		expect(pickYear(figures, 'trailing')?.fiscalYear).toBe('2025');
		expect(pickYear(figures, 'forward')?.fiscalYear).toBe('2026');
	});
	it('is undefined when there is no such year', () => {
		expect(pickYear({ ...figures, years: [] }, 'trailing')).toBeUndefined();
	});
});

describe('valueMethod', () => {
	it('turns an EV multiple band into equity values by subtracting net debt', () => {
		expect(valueMethod(figures, bench('ev_ebitda', 6, 8, 10, 7))).toEqual({
			ok: true,
			multiple: 'ev_ebitda',
			label: 'EV/EBITDA',
			metric: 'ebitda',
			fiscalYear: '2025',
			band: { low: 6, high: 10 },
			bandSource: 'peers',
			low: 1100,
			mid: 1500,
			high: 1900,
			sector: 1300
		});
	});
	it('applies an equity multiple to the forward year without the net debt bridge', () => {
		const r = valueMethod(figures, bench('pe_forward', 10, 12, 15));
		expect(r).toMatchObject({ ok: true, fiscalYear: '2026', low: 800, mid: 960, high: 1200, sector: null });
	});
	it('uses a manual band, in either order, with its midpoint', () => {
		const r = valueMethod(figures, bench('ev_sales', 1, 2, 3), { low: 5, high: 3 });
		expect(r).toMatchObject({
			ok: true,
			band: { low: 3, high: 5 },
			bandSource: 'manual',
			low: 2900,
			mid: 3900,
			high: 4900
		});
	});
	it('accepts a manual band when there are no peers', () => {
		expect(valueMethod(figures, bench('ps', null, null, null), { low: 1, high: 2 })).toMatchObject({
			ok: true,
			mid: 1500
		});
	});
	it('falls back to the band midpoint when the median is missing', () => {
		expect(valueMethod(figures, bench('ps', 1, null, 3))).toMatchObject({ ok: true, mid: 2000 });
	});
	it.each([
		['unknown-multiple', 'nope', figures],
		['no-metric', 'pbv', figures],
		['no-metric', 'ev_ebitda', { ...figures, years: [] }],
		['non-positive-metric', 'ev_ebit', figures],
		['no-net-debt', 'ev_ebitda', { ...figures, netDebt: null }]
	] as const)('reports %s for %s', (reason, multiple, f) => {
		expect(valueMethod(f, bench(multiple, 1, 2, 3))).toMatchObject({ ok: false, multiple, reason });
	});
	it('reports no-band without peers or an override, and labels by catalog id', () => {
		expect(valueMethod(figures, bench('ps', null, null, null))).toEqual({
			ok: false,
			multiple: 'ps',
			label: 'P/S',
			reason: 'no-band'
		});
	});
	it('labels an unknown multiple by its id', () => {
		expect(valueMethod(figures, bench('nope', 1, 2, 3))).toMatchObject({ label: 'nope' });
	});
});

describe('valuationView', () => {
	const peers = [peer('A', { ev_ebitda: 6, ps: 1 }), peer('B', { ev_ebitda: 10, ps: 3 })];

	it('values each selected multiple in order and averages the midpoints that exist', () => {
		const view = valuationView({ figures, multiples: ['ev_ebitda', 'ps', 'pbv'], peers, sectors: { ev_ebitda: 7 } });
		expect(view.currency).toBe('EUR');
		expect(view.benchmarks.map((b) => [b.multiple, b.median, b.sector])).toEqual([
			['ev_ebitda', 8, 7],
			['ps', 2, null],
			['pbv', null, null]
		]);
		expect(view.methods.map((m) => (m.ok ? m.mid : m.reason))).toEqual([1500, 2000, 'no-metric']);
		expect(view.average).toBe(1750);
	});
	it('applies overrides per multiple', () => {
		const view = valuationView({
			figures,
			multiples: ['ps'],
			peers,
			sectors: {},
			overrides: { ps: { low: 3, high: 5 } }
		});
		expect(view.methods[0]).toMatchObject({ ok: true, bandSource: 'manual', mid: 4000 });
	});
	it('has no average when no method has a range', () => {
		expect(valuationView({ figures, multiples: ['pbv'], peers, sectors: {} }).average).toBeNull();
	});
});
