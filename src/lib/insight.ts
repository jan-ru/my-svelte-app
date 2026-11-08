// src/lib/insight.ts
// Eulerpool's own estimates for a company: a fair value per share and a quality score. They are Eulerpool's models
// (the method is not published), shown beside the valuation on its own and never used in the calculation.

/** Fair value per share in `currency`, by three methods, against the last price. `upside` is a percentage. */
export interface FairValue {
	/** The headline figure; Eulerpool sets it equal to the income-based one. */
	readonly fairValue: number;
	readonly income: number | null;
	readonly revenue: number | null;
	readonly dividend: number | null;
	readonly lastPrice: number | null;
	/** Fair value against the last price, in percent (positive means the shares trade below fair value). */
	readonly upside: number | null;
	readonly currency: string | null;
}

/** The AAQS quality score (1 to 10) and the figures behind it. Growth, returns and drawdown are fractions (0.06 is 6%). */
export interface QualityScore {
	readonly score: number;
	readonly revenueGrowth10Y: number | null;
	readonly revenueGrowth3Y: number | null;
	readonly ebitGrowth10Y: number | null;
	readonly ebitGrowth3Y: number | null;
	/** In how many of the last ten years the company made a profit. */
	readonly profitContinuity10Y: number | null;
	/** Net debt as a multiple of EBIT; negative means net cash. */
	readonly netDebtToEbit: number | null;
	readonly ebitMaxDrawdown10Y: number | null;
	readonly returnOnEquity: number | null;
	readonly roce: number | null;
	readonly expectedReturn: number | null;
}

/** What the valuation page shows for a listed company. `message` says why a part is missing. */
export interface Insight {
	readonly fairValue: FairValue | null;
	readonly quality: QualityScore | null;
	readonly message: string | null;
}

/** A price with its currency code, falling back to a plain number when the code is unknown. */
export function formatPrice(value: number | null, currency: string | null): string {
	if (value === null) return 'n/a';
	try {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency ?? undefined,
			currencyDisplay: 'code',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	} catch {
		return value.toFixed(2);
	}
}

/** The upside as text with its meaning, so the sign is never the only cue: "+4.6% (below fair value)". */
export function describeUpside(upside: number | null): string {
	if (upside === null) return 'n/a';
	if (upside === 0) return '0.0% (at fair value)';
	const sign = upside > 0 ? '+' : '−';
	const where = upside > 0 ? 'below' : 'above';
	return `${sign}${Math.abs(upside).toFixed(1)}% (price ${where} fair value)`;
}

const percent = (v: number | null): string => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
const times = (v: number | null): string => (v === null ? 'n/a' : `${v.toFixed(1)}×`);

/** The figures behind the score, labelled and formatted, in the order they are shown. */
export function qualityRows(q: QualityScore): readonly { readonly label: string; readonly value: string }[] {
	return [
		{ label: 'Revenue growth a year, last 10 years', value: percent(q.revenueGrowth10Y) },
		{ label: 'Revenue growth a year, last 3 years', value: percent(q.revenueGrowth3Y) },
		{ label: 'EBIT growth a year, last 10 years', value: percent(q.ebitGrowth10Y) },
		{ label: 'EBIT growth a year, last 3 years', value: percent(q.ebitGrowth3Y) },
		{
			label: 'Profitable years of the last 10',
			value: q.profitContinuity10Y === null ? 'n/a' : String(q.profitContinuity10Y)
		},
		{ label: 'Net debt to EBIT', value: times(q.netDebtToEbit) },
		{ label: 'Worst EBIT drawdown, last 10 years', value: percent(q.ebitMaxDrawdown10Y) },
		{ label: 'Return on equity', value: percent(q.returnOnEquity) },
		{ label: 'Return on capital employed', value: percent(q.roce) },
		{ label: "Eulerpool's expected return", value: percent(q.expectedReturn) }
	];
}
