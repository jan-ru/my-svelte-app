// src/lib/source-data.ts
// The shapes every data source (FMP, Yahoo) produces and the views consume. A source module imports these,
// never another source's module, so a source can be added or replaced without touching the others.

export type Kind = 'income' | 'balance' | 'cashflow';

export interface StatementYear {
	readonly fiscalYear: string;
	readonly date: string;
	readonly currency: string | null;
	readonly values: Readonly<Record<string, number | null>>;
}

export interface Statement {
	/** Names of the figures, in the order the source first returns them. */
	readonly lines: readonly string[];
	/** Newest first, at most five. */
	readonly years: readonly StatementYear[];
}

export interface Profile {
	readonly name: string | null;
	readonly exchange: string | null;
	readonly sector: string | null;
	readonly industry: string | null;
	readonly country: string | null;
	readonly ceo: string | null;
	readonly website: string | null;
	readonly ipoDate: string | null;
	readonly currency: string | null;
	readonly description: string | null;
	readonly employees: number | null;
	readonly price: number | null;
	readonly marketCap: number | null;
	readonly beta: number | null;
}

export interface NewsItem {
	readonly title: string;
	readonly publisher: string | null;
	readonly date: string | null;
	readonly text: string | null;
	readonly url: string | null;
}

export interface PricePoint {
	readonly date: string;
	readonly close: number;
	readonly volume: number | null;
}

export interface PriceTarget {
	readonly consensus: number | null;
	readonly median: number | null;
	readonly high: number | null;
	readonly low: number | null;
}

export interface Peer {
	readonly symbol: string;
	readonly name: string | null;
	readonly price: number | null;
	readonly marketCap: number | null;
}

/** A company that Eulerpool links to the one asked for as a supplier, a customer or both. */
export interface SupplyLink {
	readonly symbol: string;
	readonly name: string;
	readonly country: string | null;
	readonly industry: string | null;
	readonly supplier: boolean;
	readonly customer: boolean;
	/** Correlation of the two share prices over the last year and the last three months, from -1 to 1. Not a measure of the relationship. */
	readonly correlation1y: number | null;
	readonly correlation3m: number | null;
}

/**
 * The companies linked to one company. `links` is every link by name, up to `SUPPLY_LIMIT`; the counts cover every
 * link Eulerpool lists, so the page can say if any were left out.
 */
export interface SupplyChain {
	readonly total: number;
	readonly suppliers: number;
	readonly customers: number;
	/** Links that are both a supplier and a customer. */
	readonly both: number;
	readonly links: readonly SupplyLink[];
}

/** How many supply chain links are kept per company (Apple has about 850). */
export const SUPPLY_LIMIT = 1000;

/** How many headlines a source returns. */
export const NEWS_LIMIT = 20;
