// src/lib/source-data.ts
// The shapes every data source (FMP, Yahoo) produces and the views consume. A source module imports these,
// never another source's module, so a source can be added or replaced without touching the others.

export type Kind = 'income' | 'balance' | 'cashflow';

export interface StatementYear {
	fiscalYear: string;
	date: string;
	currency: string | null;
	values: Record<string, number | null>;
}

export interface Statement {
	/** Names of the figures, in the order the source first returns them. */
	lines: string[];
	/** Newest first, at most five. */
	years: StatementYear[];
}

export interface Profile {
	name: string | null;
	exchange: string | null;
	sector: string | null;
	industry: string | null;
	country: string | null;
	ceo: string | null;
	website: string | null;
	ipoDate: string | null;
	currency: string | null;
	description: string | null;
	employees: number | null;
	price: number | null;
	marketCap: number | null;
	beta: number | null;
}

export interface NewsItem {
	title: string;
	publisher: string | null;
	date: string | null;
	text: string | null;
	url: string | null;
}

export interface PricePoint {
	date: string;
	close: number;
	volume: number | null;
}

/** How many headlines a source returns. */
export const NEWS_LIMIT = 20;
