import type { Period } from './financials-nav';

/** `keyName` is the environment variable that holds the source's API key; Yahoo needs none. */
export const SOURCES = [
	{ id: 'fmp', label: 'FMP', keyName: 'FMP_API_KEY' },
	{ id: 'yahoo', label: 'Yahoo Finance', keyName: null },
	{ id: 'eulerpool', label: 'Eulerpool', keyName: 'EULERPOOL_API_KEY' }
] as const;
export type Source = (typeof SOURCES)[number]['id'];

/**
 * Whether FMP is asked for trailing-twelve-month figures. It is false because the FMP plan this app runs on has
 * no TTM endpoints; set it to true if the plan changes. It is a constant, not an environment variable, because
 * `periodAvailable` also runs in the browser (the period toggle), where private environment variables do not exist.
 */
export const FMP_SUPPORTS_TTM = false;

export const sourceLabel = (source: Source): string => SOURCES.find((s) => s.id === source)?.label ?? source;

/** The environment variable that holds the source's API key, or null for a source without one. */
export const sourceKeyName = (source: Source): string | null => SOURCES.find((s) => s.id === source)?.keyName ?? null;

export function parseSource(raw: string | null): Source | undefined {
	return SOURCES.find((s) => s.id === raw)?.id;
}

/** A ticker without a dot is a US listing; share classes use a dash (BRK-B), so a dot means an exchange suffix (ABN.AS). */
export function isUsListing(symbol: string): boolean {
	return !symbol.includes('.');
}

/**
 * The one source that serves a view. Eulerpool serves any ticker, but only when it is asked for. Otherwise non-US
 * tickers are Yahoo only, and US tickers use the request or FMP.
 */
export function resolveSource(requested: Source | undefined, symbol: string): Source {
	if (requested === 'eulerpool') return 'eulerpool';
	if (!isUsListing(symbol)) return 'yahoo';
	return requested ?? 'fmp';
}

/** Eulerpool has no annual-style TTM: its trailing figures come in mixed units, so only annual statements are offered. */
export function periodAvailable(source: Source, period: Period): boolean {
	return period === 'annual' || source === 'yahoo' || (source === 'fmp' && FMP_SUPPORTS_TTM);
}

export function effectivePeriod(source: Source, period: Period): Period {
	return periodAvailable(source, period) ? period : 'annual';
}

/** The sources a ticker can be shown from: FMP serves US tickers only; Yahoo Finance and Eulerpool serve any. */
export const offeredSources = (symbol: string): readonly (typeof SOURCES)[number][] =>
	isUsListing(symbol) ? SOURCES : SOURCES.filter((s) => s.id !== 'fmp');
