// src/lib/valuation-data.ts
// The shapes the valuation page works with. A listed company (FMP or Yahoo) and a private company (an uploaded
// template) both become `CompanyFigures`, so the calculation in `valuation.ts` does not care where figures came from.

/** A company figure a multiple can be applied to. */
export type Metric = 'revenue' | 'ebitda' | 'ebit' | 'netIncome' | 'bookEquity' | 'investedCapital';

/** One fiscal year of figures, in the company's own currency. */
export interface FigureYear {
	readonly fiscalYear: string;
	readonly kind: 'actual' | 'forecast';
	readonly values: Readonly<Partial<Record<Metric, number | null>>>;
}

export interface CompanyFigures {
	readonly name: string;
	readonly currency: string;
	readonly origin: 'fmp' | 'yahoo' | 'manual';
	/** Debt minus cash, used to go from enterprise value to equity value. */
	readonly netDebt: number | null;
	/** Oldest first. */
	readonly years: readonly FigureYear[];
}

/** One peer's multiples, keyed by the multiple ids in `catalog.ts`. */
export interface PeerMultiples {
	readonly symbol: string;
	readonly name: string;
	readonly multiples: Readonly<Record<string, number | null>>;
}

/** A peer as the valuation page shows it: its multiples, or why there are none. */
export interface PeerRow extends PeerMultiples {
	readonly message: string | null;
}

/** A multiple band typed in by hand, replacing the peer percentiles (for example 3x to 5x). */
export interface Band {
	readonly low: number;
	readonly high: number;
}

/** Peer statistics for one multiple, plus the Damodaran sector value. */
export interface Benchmark {
	readonly multiple: string;
	/** How many peers had a usable (positive) value. */
	readonly count: number;
	readonly p25: number | null;
	readonly median: number | null;
	readonly p75: number | null;
	readonly sector: number | null;
}

/** Why a method has no range. */
export type MissingReason = 'unknown-multiple' | 'no-metric' | 'non-positive-metric' | 'no-net-debt' | 'no-band';

/** The equity value range one method gives, in the company's currency. */
export interface ValuationRange {
	readonly multiple: string;
	readonly label: string;
	readonly metric: Metric;
	/** The fiscal year whose figure was used. */
	readonly fiscalYear: string;
	readonly band: Band;
	readonly bandSource: 'peers' | 'manual';
	readonly low: number;
	readonly mid: number;
	readonly high: number;
	/** The equity value at the Damodaran sector multiple. */
	readonly sector: number | null;
}

export type MethodResult =
	| ({ readonly ok: true } & ValuationRange)
	| { readonly ok: false; readonly multiple: string; readonly label: string; readonly reason: MissingReason };

export interface ValuationView {
	readonly currency: string;
	readonly benchmarks: readonly Benchmark[];
	readonly methods: readonly MethodResult[];
	/** Mean of the midpoints of the methods that have a range, like "Gemiddeld" in the samples. */
	readonly average: number | null;
}
