// src/lib/server/yahoo-parse.ts
import type { Period } from '../financials-nav';
import { safeUrl } from '../safe-url';
import type { Kind, NewsItem, PricePoint, Profile, Statement, StatementYear } from '../source-data';
import { num, str } from './coerce';
import { SourceError } from './source-error';

const unexpected = () => new SourceError('unavailable', 'Unexpected response from Yahoo Finance');

/** Yahoo gives Date objects, epoch seconds or ISO strings depending on the call. */
export function toDate(value: unknown): Date | null {
	let date: Date | null = null;
	if (value instanceof Date) date = value;
	else if (typeof value === 'number' && Number.isFinite(value)) date = new Date(value < 1e11 ? value * 1000 : value);
	else if (typeof value === 'string' && value.trim() !== '') date = new Date(value);
	return date && !Number.isNaN(date.getTime()) ? date : null;
}

const isoDate = (date: Date, offsetSeconds = 0): string =>
	new Date(date.getTime() + offsetSeconds * 1000).toISOString().slice(0, 10);

const records = (body: unknown): Record<string, unknown>[] => {
	if (!Array.isArray(body)) throw unexpected();
	return body.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object');
};

/** Daily closes from `chart().quotes`; `gmtoffsetSeconds` (from `chart().meta`) puts each quote on its exchange-local date. */
export function parseYahooPrices(quotes: unknown, gmtoffsetSeconds = 0): PricePoint[] {
	const byDate = new Map<string, PricePoint>();
	for (const rec of records(quotes)) {
		const when = toDate(rec.date);
		const close = num(rec.close);
		if (!when || close === null) continue;
		const date = isoDate(when, gmtoffsetSeconds);
		byDate.set(date, { date, close, volume: num(rec.volume) });
	}
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function parseYahooProfile(summary: unknown): Profile | null {
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw unexpected();
	const { assetProfile, price } = summary as { assetProfile?: Record<string, unknown>; price?: Record<string, unknown> };
	const a = assetProfile ?? {};
	const p = price ?? {};
	const officers = Array.isArray(a.companyOfficers) ? (a.companyOfficers as Record<string, unknown>[]) : [];
	const ceo = officers.find((o) => o && typeof o.title === 'string' && /\bceo\b|chief executive/i.test(o.title));
	const profile: Profile = {
		name: str(p.longName) ?? str(p.shortName),
		exchange: str(p.exchangeName),
		sector: str(a.sector),
		industry: str(a.industry),
		country: str(a.country),
		ceo: str(ceo?.name),
		website: safeUrl(a.website),
		ipoDate: null,
		currency: str(p.currency),
		description: str(a.longBusinessSummary),
		employees: num(a.fullTimeEmployees),
		price: num(p.regularMarketPrice),
		marketCap: num(p.marketCap),
		beta: null
	};
	return Object.values(profile).every((v) => v === null) ? null : profile;
}

/** News from `search().news`. Yahoo has no summary text, so `text` is always null. */
export function parseYahooNews(items: unknown): NewsItem[] {
	const news: NewsItem[] = [];
	for (const rec of records(items)) {
		const title = str(rec.title);
		if (!title) continue;
		const when = toDate(rec.providerPublishTime);
		news.push({
			title,
			publisher: str(rec.publisher),
			date: when ? when.toISOString().replace('T', ' ').slice(0, 19) : null,
			text: null,
			url: safeUrl(rec.link)
		});
	}
	return news;
}

/** Lines shown first, in this order, when the company reports them. */
export const KEY_LINES: Record<Kind, string[]> = {
	income: ['totalRevenue', 'grossProfit', 'operatingIncome', 'ebitda', 'netIncome', 'dilutedEPS'],
	balance: ['totalAssets', 'totalLiabilitiesNetMinorityInterest', 'stockholdersEquity', 'cashAndCashEquivalents', 'totalDebt'],
	cashflow: ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'capitalExpenditure', 'freeCashFlow']
};

const META = new Set(['TYPE', 'periodType', 'date', 'symbol', 'currencyCode']);
const MAX_YEARS = 5;

function toYear(row: Record<string, unknown>, currency: string | null): StatementYear | null {
	const when = toDate(row.date);
	if (!when) return null;
	const values: Record<string, number | null> = {};
	for (const [key, value] of Object.entries(row)) {
		if (META.has(key)) continue;
		const n = num(value);
		if (n !== null) values[key] = n;
	}
	return { fiscalYear: String(when.getUTCFullYear()), date: isoDate(when), currency, values };
}

function newestFirst(rows: Record<string, unknown>[], currency: string | null): StatementYear[] {
	const byDate = new Map<string, StatementYear>();
	for (const row of rows) {
		const year = toYear(row, currency);
		if (year) byDate.set(year.date, year);
	}
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * A Yahoo `fundamentalsTimeSeries` result as a `Statement`. TTM takes the newest trailing point
 * (income, cash flow) or the latest annual one (balance sheet, which has no trailing series).
 */
export function parseYahooStatement(
	kind: Kind,
	annual: unknown,
	trailing: unknown,
	period: Period,
	currency: string | null
): Statement {
	const years =
		period === 'ttm'
			? newestFirst(records(kind === 'balance' ? annual : trailing), currency).slice(0, 1)
			: newestFirst(records(annual), currency).slice(0, MAX_YEARS);

	const present = new Set<string>();
	for (const year of years) for (const key of Object.keys(year.values)) present.add(key);
	const key = KEY_LINES[kind].filter((k) => present.has(k));
	return { lines: [...key, ...[...present].filter((k) => !key.includes(k))], years };
}
