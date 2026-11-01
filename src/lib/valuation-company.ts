// src/lib/valuation-company.ts
// A private company's figures travel in the URL (`co`), so nothing is stored on the server and a bookmark keeps them.
// This module turns `CompanyFigures` into a compact, URL-safe string and back, checking everything it reads. Pure.
import type { CompanyFigures, FigureYear, Metric } from './valuation-data';

/** The order of the figures in an encoded year. */
export const METRICS: readonly Metric[] = ['revenue', 'ebitda', 'ebit', 'netIncome', 'bookEquity', 'investedCapital'];

export const MAX_YEARS = 12;
export const MAX_NAME = 80;
/** A URL stays well inside what browsers and Vercel accept. */
export const MAX_ENCODED = 4000;

type Packed = [name: string, currency: string, netDebt: number | null, years: [string, 0 | 1, ...(number | null)[]][]];

const toBase64Url = (text: string): string =>
	btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromBase64Url(raw: string): string | null {
	try {
		const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
		return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
	} catch {
		return null;
	}
}

export function encodeCompany(figures: CompanyFigures): string {
	const packed: Packed = [
		figures.name,
		figures.currency,
		figures.netDebt,
		figures.years.map((y) => [y.fiscalYear, y.kind === 'actual' ? 1 : 0, ...METRICS.map((m) => y.values[m] ?? null)])
	];
	return toBase64Url(JSON.stringify(packed));
}

const isAmount = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v));
const YEAR = /^\d{4}$/;
const CURRENCY = /^[A-Z]{3}$/;

function decodeYear(raw: unknown): FigureYear | null {
	if (!Array.isArray(raw) || raw.length !== 2 + METRICS.length) return null;
	const [fiscalYear, actual, ...values] = raw as unknown[];
	if (typeof fiscalYear !== 'string' || !YEAR.test(fiscalYear) || (actual !== 0 && actual !== 1)) return null;
	if (!values.every(isAmount)) return null;
	return {
		fiscalYear,
		kind: actual === 1 ? 'actual' : 'forecast',
		values: Object.fromEntries(METRICS.map((m, i) => [m, values[i]]))
	};
}

/** The figures in a `co` value, or null when it is missing, too long or not exactly what `encodeCompany` writes. */
export function decodeCompany(raw: string | null): CompanyFigures | null {
	if (!raw || raw.length > MAX_ENCODED) return null;
	const json = fromBase64Url(raw);
	if (json === null) return null;
	let packed: unknown;
	try {
		packed = JSON.parse(json);
	} catch {
		return null;
	}
	if (!Array.isArray(packed) || packed.length !== 4) return null;
	const [name, currency, netDebt, years] = packed as unknown[];
	if (typeof name !== 'string' || name.trim() === '' || name.length > MAX_NAME) return null;
	if (typeof currency !== 'string' || !CURRENCY.test(currency) || !isAmount(netDebt)) return null;
	if (!Array.isArray(years) || years.length === 0 || years.length > MAX_YEARS) return null;
	const decoded = years.map(decodeYear).filter((y) => y !== null);
	if (decoded.length !== years.length) return null;
	return { name, currency, origin: 'manual', netDebt, years: decoded };
}
