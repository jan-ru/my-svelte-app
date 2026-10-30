import type { Period } from './financials-nav';

export const SOURCES = [
	{ id: 'fmp', label: 'FMP' },
	{ id: 'yahoo', label: 'Yahoo Finance' }
] as const;
export type Source = (typeof SOURCES)[number]['id'];

/**
 * Whether FMP is asked for trailing-twelve-month figures. It is false because the FMP plan this app runs on has
 * no TTM endpoints; set it to true if the plan changes. It is a constant, not an environment variable, because
 * `periodAvailable` also runs in the browser (the period toggle), where private environment variables do not exist.
 */
export const FMP_SUPPORTS_TTM = false;

export const sourceLabel = (source: Source): string => SOURCES.find((s) => s.id === source)!.label;

export function parseSource(raw: string | null): Source | undefined {
	return SOURCES.find((s) => s.id === raw)?.id;
}

/** A ticker without a dot is a US listing; share classes use a dash (BRK-B), so a dot means an exchange suffix (ABN.AS). */
export function isUsListing(symbol: string): boolean {
	return !symbol.includes('.');
}

/** The one source that serves a view: non-US tickers are Yahoo only, US tickers use the request or FMP. */
export function resolveSource(requested: Source | undefined, symbol: string): Source {
	if (!isUsListing(symbol)) return 'yahoo';
	return requested ?? 'fmp';
}

export function periodAvailable(source: Source, period: Period): boolean {
	return period === 'annual' || source === 'yahoo' || FMP_SUPPORTS_TTM;
}

export function effectivePeriod(source: Source, period: Period): Period {
	return periodAvailable(source, period) ? period : 'annual';
}
