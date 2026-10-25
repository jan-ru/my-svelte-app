import { yahooQuote, yahooSearch } from './yahoo';

/** Google Finance exchange code per Capital IQ exchange code, for exchanges Yahoo lacks or mislabels. */
const GOOGLE: Record<string, string> = {
	BSE: 'BOM', KLSE: 'KLSE', BASE: 'BCBA', NSEL: 'VSE', ICSE: 'ICE'
};

const SYMBOL = /^[A-Za-z0-9.&-]+$/;

export type QuoteLink = {
	url: string;
	/** YF = Yahoo Finance, GF = Google Finance */
	source: 'YF' | 'GF';
	/** true when the link is a search page rather than the company's quote page */
	search: boolean;
};

/** Quote page for a Capital IQ style ticker: Yahoo first, then Google, else a Yahoo search. */
export function quoteLink(ticker: string, name = ''): QuoteLink | null {
	const yahoo = yahooQuote(ticker);
	if (yahoo) return { url: yahoo, source: 'YF', search: false };
	const [exchange, symbol] = ticker.split(':', 2);
	const google = GOOGLE[exchange];
	if (google && symbol && SYMBOL.test(symbol)) {
		return { url: `https://www.google.com/finance/quote/${encodeURIComponent(symbol)}:${google}`, source: 'GF', search: false };
	}
	const search = yahooSearch(ticker, name);
	return search ? { url: search, source: 'YF', search: true } : null;
}
