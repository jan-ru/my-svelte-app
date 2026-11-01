// src/lib/valuation-figures.ts
// Turns the statements a source returns (FMP or Yahoo) into `CompanyFigures`, and a peer's figures plus its market
// cap into the multiples the valuation compares. Pure.
import type { Statement, StatementYear } from './source-data';
import { BASIS, pickYear } from './valuation';
import type { CompanyFigures, FigureYear, Metric, PeerMultiples } from './valuation-data';

/** The line names each source uses for a figure; the first one present wins (FMP first, then Yahoo). */
const LINES = {
	revenue: ['revenue', 'totalRevenue'],
	ebitda: ['ebitda'],
	ebit: ['ebit', 'operatingIncome'],
	netIncome: ['netIncome'],
	equity: ['totalStockholdersEquity', 'stockholdersEquity'],
	netDebt: ['netDebt'],
	debt: ['totalDebt'],
	cash: ['cashAndCashEquivalents']
} as const;

/** FMP analyst estimate lines (averages). */
const ESTIMATE_LINES: Readonly<Partial<Record<Metric, string>>> = {
	revenue: 'revenueAvg',
	ebitda: 'ebitdaAvg',
	ebit: 'ebitAvg',
	netIncome: 'netIncomeAvg'
};

const first = (year: StatementYear | undefined, keys: readonly string[]): number | null =>
	keys.map((k) => year?.values[k]).find((v): v is number => typeof v === 'number' && Number.isFinite(v)) ?? null;

/** Net debt as reported, or total debt minus cash. */
export function netDebtOf(balance: StatementYear | undefined): number | null {
	const reported = first(balance, LINES.netDebt);
	if (reported !== null) return reported;
	const debt = first(balance, LINES.debt);
	const cash = first(balance, LINES.cash);
	return debt === null || cash === null ? null : debt - cash;
}

function actualYear(income: StatementYear, balance: StatementYear | undefined): FigureYear {
	const equity = first(balance, LINES.equity);
	const netDebt = netDebtOf(balance);
	return {
		fiscalYear: income.fiscalYear,
		kind: 'actual',
		values: {
			revenue: first(income, LINES.revenue),
			ebitda: first(income, LINES.ebitda),
			ebit: first(income, LINES.ebit),
			netIncome: first(income, LINES.netIncome),
			bookEquity: equity,
			investedCapital: equity === null || netDebt === null ? null : equity + netDebt
		}
	};
}

const forecastYear = (estimate: StatementYear): FigureYear => ({
	fiscalYear: estimate.fiscalYear,
	kind: 'forecast',
	values: Object.fromEntries(Object.entries(ESTIMATE_LINES).map(([metric, line]) => [metric, first(estimate, [line])]))
});

/**
 * A listed company's figures: actual years from the income statement and balance sheet, forecast years from
 * analyst estimates after the last actual year. Null when the income statement has no years.
 */
export function figuresFromStatements(input: {
	readonly name: string;
	readonly origin: 'fmp' | 'yahoo';
	readonly income: Statement;
	readonly balance: Statement | null;
	readonly estimates: Statement | null;
	/** Used when the statements carry no currency. */
	readonly currency: string | null;
}): CompanyFigures | null {
	const { income, balance, estimates } = input;
	const latest = income.years[0];
	if (!latest) return null;
	const balanceFor = (fiscalYear: string) => balance?.years.find((y) => y.fiscalYear === fiscalYear);
	const actual = income.years.map((y) => actualYear(y, balanceFor(y.fiscalYear))).toReversed();
	const forecast = (estimates?.years ?? [])
		.filter((y) => Number(y.fiscalYear) > Number(latest.fiscalYear))
		.map(forecastYear)
		.toSorted((a, b) => Number(a.fiscalYear) - Number(b.fiscalYear));
	return {
		name: input.name,
		currency: latest.currency ?? input.currency ?? 'USD',
		origin: input.origin,
		netDebt: netDebtOf(balance?.years[0]),
		years: [...actual, ...forecast]
	};
}

/**
 * A peer's multiples from its figures and market cap: enterprise value (market cap plus net debt) or market cap,
 * divided by the figure each multiple uses. A multiple is null when a figure is missing or not positive.
 */
export function peerMultiples(
	symbol: string,
	name: string,
	figures: CompanyFigures | null,
	marketCap: number | null
): PeerMultiples {
	const multiples = Object.fromEntries(
		Object.entries(BASIS).map(([id, basis]) => {
			if (!figures || marketCap === null || marketCap <= 0) return [id, null];
			const value = pickYear(figures, basis.year)?.values[basis.metric];
			const base =
				basis.target === 'equity' ? marketCap : figures.netDebt === null ? null : marketCap + figures.netDebt;
			const usable = typeof value === 'number' && value > 0 && base !== null && base > 0;
			return [id, usable ? base / value : null];
		})
	);
	return { symbol, name, multiples };
}
