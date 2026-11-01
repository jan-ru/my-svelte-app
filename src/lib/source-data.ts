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

/** How many headlines a source returns. */
export const NEWS_LIMIT = 20;
