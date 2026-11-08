// src/lib/server/eulerpool-parse.ts
// Pure parsers for Eulerpool responses. They take the parsed JSON body and return the shapes in `source-data.ts`.
import type { FairValue, QualityScore } from '../insight';
import { safeUrl } from '../safe-url';
import type { Kind, PricePoint, Profile, Statement, StatementYear } from '../source-data';
import { isRecord, num, str } from './coerce';
import { SourceError } from './source-error';

const MILLION = 1_000_000;
const MAX_YEARS = 5;
/** Two rows closer than this are the same fiscal year (Apple has 27 and 30 September 2025). */
const SAME_YEAR_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const unexpected = () => new SourceError('unavailable', 'Unexpected response from Eulerpool');

/** Fields that identify a row; everything else in it is a figure. */
const META = new Set(['ticker', 'period', 'year', 'quarter_period']);

/** An actual period is a plain date. Analyst forecasts come in the same list with an `e` after the date (`2031-09-30e`). */
const ACTUAL_PERIOD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Eulerpool's names for the figures, in the names FMP and Yahoo use, so a table reads the same from any source.
 * `assets` is the non-current part; `allAssets` is the total. Anything not listed keeps its own name.
 */
const RENAME: Readonly<Record<Kind, Readonly<Record<string, string>>>> = {
	income: {
		costOfGoodsSold: 'costOfRevenue',
		grossIncome: 'grossProfit',
		researchDevelopment: 'researchAndDevelopment',
		provisionforIncomeTaxes: 'incomeTaxExpense',
		diluted_eps: 'dilutedEPS'
	},
	balance: {
		allAssets: 'totalAssets',
		assets: 'nonCurrentAssets',
		liabilities: 'totalLiabilities',
		fixedLiabilities: 'nonCurrentLiabilities',
		equity: 'stockholdersEquity',
		capital: 'totalLiabilitiesAndEquity',
		otherCurrentliabilities: 'otherCurrentLiabilities'
	},
	cashflow: {
		amortization: 'depreciationAndAmortization',
		changesinWorkingCapital: 'changesInWorkingCapital',
		netOperatingCashFlow: 'operatingCashFlow',
		netInvestingCashFlow: 'investingCashFlow',
		netCashFinancingActivities: 'financingCashFlow',
		capex: 'capitalExpenditure',
		cashNet: 'netChangeInCash',
		fcf: 'freeCashFlow'
	}
};

/** Lines shown first, in this order, when the company reports them (the names after renaming). */
export const KEY_LINES: Readonly<Record<Kind, readonly string[]>> = {
	income: ['revenue', 'grossProfit', 'ebit', 'netIncome', 'dilutedEPS'],
	balance: ['totalAssets', 'totalLiabilities', 'stockholdersEquity', 'currentAssets', 'currentLiabilities'],
	cashflow: ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'capitalExpenditure', 'freeCashFlow']
};

/** Statements are in millions, except per-share figures. */
const scale = (key: string, value: number): number => (/eps$/i.test(key) ? value : Math.round(value * MILLION));

function toYear(kind: Kind, row: Readonly<Record<string, unknown>>, currency: string | null): StatementYear | null {
	const period = str(row.period);
	if (!period || !ACTUAL_PERIOD.test(period)) return null;
	const rename = RENAME[kind];
	const values: Record<string, number | null> = {};
	for (const [key, raw] of Object.entries(row)) {
		if (META.has(key)) continue;
		const value = num(raw);
		if (value !== null) values[rename[key] ?? key] = scale(key, value);
	}
	if (Object.keys(values).length === 0) return null;
	return { fiscalYear: period.slice(0, 4), date: period, currency, values };
}

/** Of two rows for the same fiscal year, the one with more figures. */
const richer = (a: StatementYear, b: StatementYear): StatementYear =>
	Object.keys(b.values).length > Object.keys(a.values).length ? b : a;

function onePerYear(oldestFirst: readonly StatementYear[]): StatementYear[] {
	const out: StatementYear[] = [];
	for (const year of oldestFirst) {
		const last = out.at(-1);
		const days = last ? (Date.parse(year.date) - Date.parse(last.date)) / DAY_MS : Infinity;
		if (last && days < SAME_YEAR_DAYS) out[out.length - 1] = richer(last, year);
		else out.push(year);
	}
	return out;
}

/**
 * An annual statement from `/equity/incomestatement`, `/balancesheet` or `/cashflowstatement`: an array of periods,
 * oldest first, with forecasts at the end. `currency` is the company's (the rows carry none).
 */
export function parseEulerpoolStatement(kind: Kind, body: unknown, currency: string | null): Statement {
	if (!Array.isArray(body)) throw unexpected();
	const rows = body.filter(isRecord);
	const parsed = rows.flatMap((row) => toYear(kind, row, currency) ?? []);
	const years = onePerYear(parsed.sort((a, b) => a.date.localeCompare(b.date)))
		.reverse()
		.slice(0, MAX_YEARS);

	const present = new Set(years.flatMap((y) => Object.keys(y.values)));
	const key = KEY_LINES[kind].filter((k) => present.has(k));
	// the rest in the order the newest year reports them
	const rest = years
		.flatMap((y) => Object.keys(y.values))
		.filter((k, i, all) => !key.includes(k) && all.indexOf(k) === i);
	return { lines: [...key, ...rest], years };
}

/** A company from `/equity/overview`. Amounts are in millions; there is no exchange, CEO or beta. */
export function parseEulerpoolProfile(body: unknown): Profile | null {
	if (!isRecord(body)) throw unexpected();
	const marketCap = num(body.marketCap);
	const profile: Profile = {
		name: str(body.name),
		exchange: null,
		sector: str(body.sector),
		industry: str(body.industry),
		country: str(body.country),
		ceo: null,
		website: safeUrl(body.website),
		ipoDate: str(body.ipo),
		currency: str(body.currency),
		description: str(body.description),
		employees: num(body.employees),
		price: num(body.price),
		marketCap: marketCap === null ? null : Math.round(marketCap * MILLION),
		beta: null
	};
	return Object.values(profile).every((v) => v === null) ? null : profile;
}

/** The reporting currency of a company from `/equity/overview`, or null. */
export const parseEulerpoolCurrency = (body: unknown): string | null => (isRecord(body) ? str(body.currency) : null);

/**
 * Daily closes from `/equity/candles`: `{ timestamp (ms), open, high, low, close }`. The candles are approximated from
 * quotes, so a close can differ a little from the official one; there is no volume. Timestamps fall on the trading
 * day in UTC, whatever their hour.
 */
export function parseEulerpoolPrices(body: unknown): PricePoint[] {
	if (!Array.isArray(body)) throw unexpected();
	const byDate = new Map<string, PricePoint>();
	for (const row of body.filter(isRecord)) {
		const timestamp = num(row.timestamp);
		const close = num(row.close);
		if (timestamp === null || close === null) continue;
		const when = new Date(timestamp);
		if (Number.isNaN(when.getTime())) continue;
		const date = when.toISOString().slice(0, 10);
		byDate.set(date, { date, close, volume: null });
	}
	return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Eulerpool's fair value from `/fair-value/by-isin`. The amounts are per share in the listing's currency, which the
 * response does not name, so the caller passes it. Null when there is no fair value.
 */
export function parseEulerpoolFairValue(body: unknown, currency: string | null): FairValue | null {
	if (!isRecord(body)) throw unexpected();
	const fairValue = num(body.fairValue);
	if (fairValue === null) return null;
	return {
		fairValue,
		income: num(body.fairValueIncome),
		revenue: num(body.fairValueRevenue),
		dividend: num(body.fairValueDividend),
		lastPrice: num(body.lastPrice),
		upside: num(body.upside),
		currency
	};
}

/** The AAQS quality score from `/equity/aaqs`. Null when there is no score. */
export function parseEulerpoolQuality(body: unknown): QualityScore | null {
	if (!isRecord(body)) throw unexpected();
	const score = num(body.score);
	if (score === null) return null;
	return {
		score,
		revenueGrowth10Y: num(body.revenueGrowth10Y),
		revenueGrowth3Y: num(body.revenueGrowth3Y),
		ebitGrowth10Y: num(body.ebitGrowth10Y),
		ebitGrowth3Y: num(body.ebitGrowth3Y),
		profitContinuity10Y: num(body.profitContinuity10Y),
		netDebtToEbit: num(body.netDebtToEBIT),
		ebitMaxDrawdown10Y: num(body.ebitMaxDrawdown10Y),
		returnOnEquity: num(body.returnOnEquity),
		roce: num(body.roce),
		expectedReturn: num(body.expectedReturn)
	};
}
