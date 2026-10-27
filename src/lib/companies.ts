import { parseSymbol } from './symbol';
import { yahooSymbol } from './yahoo';

export interface CompanyData {
	generated: string;
	industries: string[];
	countries: string[];
	groups: string[];
	sectors: string[];
	subGroups: string[];
	/** [name, ticker, sic, industry index, country index, region index, sector index, sub group index] */
	companies: [string, string, string, number, number, number, number, number][];
}

export interface Company {
	name: string;
	ticker: string;
	sic: string;
	industry: string;
	country: string;
	region: string;
}

export interface CompanyQuery {
	industry?: string;
	sic?: string;
	country?: string;
	q?: string;
	page?: number;
}

export interface CompanyPage {
	total: number;
	page: number;
	pages: number;
	rows: Company[];
	/** Countries present in the matches before the country filter, with counts, largest first. */
	countries: [string, number][];
}

export const PAGE_SIZE = 50;

/** Filter the company list. Unknown industry or country values simply match nothing. */
export function queryCompanies(data: CompanyData, query: CompanyQuery): CompanyPage {
	const industry = query.industry ? data.industries.indexOf(query.industry) : undefined;
	const country = query.country ? data.countries.indexOf(query.country) : undefined;
	const sic = query.sic?.trim() || undefined;
	const words = (query.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);

	const base = data.companies.filter(
		(c) =>
			(industry === undefined || c[3] === industry) &&
			(sic === undefined || c[2] === sic) &&
			words.every((w) => c[0].toLowerCase().includes(w) || c[1].toLowerCase().includes(w))
	);

	const counts = new Map<number, number>();
	for (const c of base) counts.set(c[4], (counts.get(c[4]) ?? 0) + 1);
	const countries = [...counts]
		.map(([i, n]) => [data.countries[i], n] as [string, number])
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

	const matches = country === undefined ? base : base.filter((c) => c[4] === country);
	const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
	const page = Math.min(Math.max(1, Math.floor(query.page ?? 1) || 1), pages);
	const rows = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((c) => ({
		name: c[0],
		ticker: c[1],
		sic: c[2],
		industry: data.industries[c[3]],
		country: data.countries[c[4]],
		region: data.groups[c[5]]
	}));
	return { total: matches.length, page, pages, rows, countries };
}

/** Capital IQ exchange codes of the US exchange listings FMP covers (OTC is left out). */
const US_EXCHANGES = new Set(['NasdaqGS', 'NasdaqGM', 'NasdaqCM', 'NYSE', 'NYSEAM']);

/** The FMP ticker for a US exchange listing (`NYSE:BRK.B` -> `BRK-B`); null for anything else. */
export function fmpSymbol(company: Pick<Company, 'ticker' | 'country'>): string | null {
	if (company.country !== 'United States') return null;
	const colon = company.ticker.indexOf(':');
	if (colon < 0 || !US_EXCHANGES.has(company.ticker.slice(0, colon))) return null;
	return parseSymbol(company.ticker.slice(colon + 1).replaceAll('.', '-'));
}

/** Where the Financials button leads: FMP for US exchange listings, Yahoo Finance for other mappable rows, nothing otherwise. */
export function financialsLink(company: Pick<Company, 'ticker' | 'country'>): string | null {
	const fmp = fmpSymbol(company);
	if (fmp) return `/financials?symbol=${encodeURIComponent(fmp)}`;
	// US rows without an FMP symbol are OTC and the like: no button
	if (company.country === 'United States') return null;
	const yahoo = parseSymbol(yahooSymbol(company.ticker) ?? '');
	return yahoo ? `/financials?symbol=${encodeURIComponent(yahoo)}&source=yahoo` : null;
}
