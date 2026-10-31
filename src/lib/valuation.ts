// src/lib/valuation.ts
// Values a company with multiples from its peers and its Damodaran sector. Pure: data in, data out.
import { multipleById } from './catalog';
import type {
	Band,
	Benchmark,
	CompanyFigures,
	FigureYear,
	MethodResult,
	Metric,
	PeerMultiples,
	ValuationView
} from './valuation-data';

/** What a multiple is applied to, whether it gives enterprise or equity value, and which year it uses. */
export interface MultipleBasis {
	readonly metric: Metric;
	readonly target: 'ev' | 'equity';
	readonly year: 'trailing' | 'forward';
}

/** One entry per multiple in `MULTIPLES` (`catalog.ts`); a test checks they stay in step. */
export const BASIS: Readonly<Record<string, MultipleBasis>> = {
	ev_ebitda: { metric: 'ebitda', target: 'ev', year: 'trailing' },
	ev_ebit: { metric: 'ebit', target: 'ev', year: 'trailing' },
	pe_trailing: { metric: 'netIncome', target: 'equity', year: 'trailing' },
	pe_forward: { metric: 'netIncome', target: 'equity', year: 'forward' },
	pe_current: { metric: 'netIncome', target: 'equity', year: 'trailing' },
	pbv: { metric: 'bookEquity', target: 'equity', year: 'trailing' },
	ev_ic: { metric: 'investedCapital', target: 'ev', year: 'trailing' },
	ps: { metric: 'revenue', target: 'equity', year: 'trailing' },
	ev_sales: { metric: 'revenue', target: 'ev', year: 'trailing' }
};

/** The p-th percentile (0 to 1) of values sorted ascending, interpolated like Excel's PERCENTILE.INC. */
export function percentile(sorted: readonly number[], p: number): number | null {
	if (sorted.length === 0) return null;
	const rank = (sorted.length - 1) * p;
	const lower = Math.floor(rank);
	const upper = Math.ceil(rank);
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

const usable = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Peer quartiles for one multiple. Missing, zero and negative multiples are left out, as they carry no value. */
export function benchmark(multiple: string, peers: readonly PeerMultiples[], sector: number | null): Benchmark {
	const values = peers
		.map((p) => p.multiples[multiple])
		.filter(usable)
		.toSorted((a, b) => a - b);
	return {
		multiple,
		count: values.length,
		p25: percentile(values, 0.25),
		median: percentile(values, 0.5),
		p75: percentile(values, 0.75),
		sector: usable(sector) ? sector : null
	};
}

/** The year a multiple uses: the latest actual year (trailing) or the first forecast year (forward). */
export function pickYear(figures: CompanyFigures, year: MultipleBasis['year']): FigureYear | undefined {
	return year === 'trailing'
		? figures.years.findLast((y) => y.kind === 'actual')
		: figures.years.find((y) => y.kind === 'forecast');
}

const ordered = (band: Band): Band => ({ low: Math.min(band.low, band.high), high: Math.max(band.low, band.high) });

/**
 * The equity value range for one multiple: the company's figure times the band, minus net debt for an EV multiple.
 * The band is the manual override when given, otherwise the peers' 25th to 75th percentile with the median as midpoint.
 */
export function valueMethod(figures: CompanyFigures, bench: Benchmark, override?: Band): MethodResult {
	const { multiple } = bench;
	const label = multipleById(multiple)?.label ?? multiple;
	const fail = (reason: Extract<MethodResult, { ok: false }>['reason']): MethodResult => ({
		ok: false,
		multiple,
		label,
		reason
	});

	const basis = BASIS[multiple];
	if (!basis) return fail('unknown-multiple');
	const year = pickYear(figures, basis.year);
	const value = year?.values[basis.metric];
	if (!year || value === null || value === undefined) return fail('no-metric');
	if (value <= 0) return fail('non-positive-metric');
	const { netDebt } = figures;
	if (basis.target === 'ev' && netDebt === null) return fail('no-net-debt');

	const peerBand = bench.p25 !== null && bench.p75 !== null ? { low: bench.p25, high: bench.p75 } : null;
	const band = override ? ordered(override) : peerBand;
	if (!band) return fail('no-band');
	const midMultiple = override || bench.median === null ? (band.low + band.high) / 2 : bench.median;

	const equity = (m: number): number => m * value - (basis.target === 'ev' ? (netDebt ?? 0) : 0);
	return {
		ok: true,
		multiple,
		label,
		metric: basis.metric,
		fiscalYear: year.fiscalYear,
		band,
		bandSource: override ? 'manual' : 'peers',
		low: equity(band.low),
		mid: equity(midMultiple),
		high: equity(band.high),
		sector: bench.sector === null ? null : equity(bench.sector)
	};
}

/** Everything the valuation page shows, for the selected multiples in the order given. */
export function valuationView(input: {
	readonly figures: CompanyFigures;
	readonly multiples: readonly string[];
	readonly peers: readonly PeerMultiples[];
	readonly sectors: Readonly<Record<string, number | null>>;
	readonly overrides?: Readonly<Record<string, Band>>;
}): ValuationView {
	const { figures, multiples, peers, sectors, overrides = {} } = input;
	const benchmarks = multiples.map((m) => benchmark(m, peers, sectors[m] ?? null));
	const methods = benchmarks.map((b) => valueMethod(figures, b, overrides[b.multiple]));
	const mids = methods.flatMap((m) => (m.ok ? [m.mid] : []));
	return {
		currency: figures.currency,
		benchmarks,
		methods,
		average: mids.length ? mids.reduce((a, b) => a + b, 0) / mids.length : null
	};
}
