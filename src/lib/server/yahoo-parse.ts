// src/lib/server/yahoo-parse.ts
import { Option, Schema, SchemaTransformation } from 'effect';
import type { Period } from '../financials-nav';
import { safeUrl } from '../safe-url';
import type { Kind, NewsItem, PricePoint, Profile, Statement, StatementYear } from '../source-data';
import { isRecord, num, str } from './coerce';
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

const records = (body: unknown): readonly Readonly<Record<string, unknown>>[] => {
	if (!Array.isArray(body)) throw unexpected();
	return body.filter(isRecord);
};

// The quotes of `chart()` as Effect Schemas, the pilot of ADR-012. They accept what `num` and `toDate` accept.
const Text = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()));
/** A finite number, or a string that reads as one. */
const Num = Schema.Union([Schema.Finite, Text.pipe(Schema.decodeTo(Schema.FiniteFromString))]);
/** Epoch seconds, or milliseconds from 1e11 on. */
const Epoch = Schema.Finite.pipe(
	Schema.decodeTo(
		Schema.Date,
		SchemaTransformation.transform({
			decode: (n: number) => new Date(n < 1e11 ? n * 1000 : n),
			encode: (date: Date) => date.getTime()
		})
	)
);
/** A date string goes to `Date` as it is, untrimmed, as `toDate` does: `Date` reads a padded one differently. */
const DateText = Schema.String.pipe(Schema.check(Schema.isPattern(/\S/)), Schema.decodeTo(Schema.DateFromString));
const When = Schema.Union([Schema.Date, Epoch, DateText]);
/** A quote that counts: a date and a close. Anything else in the list is skipped, as before. */
const Quote = Schema.Struct({ date: When, close: Num, volume: Schema.optionalKey(Schema.Unknown) });
const Quotes = Schema.Array(Schema.Unknown);

const decodeQuote = Schema.decodeUnknownOption(Quote);
const decodeNum = Schema.decodeUnknownOption(Num);

/** Daily closes from `chart().quotes`; `gmtoffsetSeconds` (from `chart().meta`) puts each quote on its exchange-local date. */
export function parseYahooPrices(quotes: unknown, gmtoffsetSeconds = 0): PricePoint[] {
	const list = Option.getOrThrowWith(Schema.decodeUnknownOption(Quotes)(quotes), unexpected);
	const byDate = new Map<string, PricePoint>();
	for (const quote of list.flatMap((item) => Option.toArray(decodeQuote(item)))) {
		const date = isoDate(quote.date, gmtoffsetSeconds);
		byDate.set(date, { date, close: quote.close, volume: Option.getOrNull(decodeNum(quote.volume)) });
	}
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function parseYahooProfile(summary: unknown): Profile | null {
	if (!isRecord(summary)) throw unexpected();
	const a = isRecord(summary.assetProfile) ? summary.assetProfile : {};
	const p = isRecord(summary.price) ? summary.price : {};
	const officers = Array.isArray(a.companyOfficers) ? a.companyOfficers.filter(isRecord) : [];
	const ceo = officers.find((o) => typeof o.title === 'string' && /\bceo\b|chief executive/i.test(o.title));
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
	balance: [
		'totalAssets',
		'totalLiabilitiesNetMinorityInterest',
		'stockholdersEquity',
		'cashAndCashEquivalents',
		'totalDebt'
	],
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

function newestFirst(rows: readonly Readonly<Record<string, unknown>>[], currency: string | null): StatementYear[] {
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
