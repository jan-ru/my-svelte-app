// src/lib/valuation-nav.ts
// The valuation page keeps all of its state in the URL, so a bookmark keeps the company, the picked peers and
// the benchmark. This module reads and writes that state; it is pure.
import { MAX_SELECTION, MULTIPLES, REGIONS } from './catalog';
import { parseSource, type Source } from './source';
import { parseSymbol } from './symbol';
import type { Band } from './valuation-data';

export const VALUATION_PATH = '/financials/valuation';

/** Each peer costs a few API calls, so the list is capped. */
export const MAX_PEERS = 8;

export const DEFAULT_MULTIPLES: readonly string[] = ['ev_ebitda', 'ev_sales', 'pe_trailing'];
export const DEFAULT_REGION = 'global';

export interface ValuationNav {
	/** Upper-cased ticker, or '' when none (or an invalid one) was given. */
	readonly symbol: string;
	readonly peers: readonly string[];
	/** Multiple ids from `MULTIPLES`, in catalog order. */
	readonly multiples: readonly string[];
	readonly region: string;
	/** A Damodaran industry name, or null for no sector benchmark. */
	readonly industry: string | null;
	/** Manual bands by multiple id (`lo.<id>` and `hi.<id>` in the query), only for selected multiples. */
	readonly overrides: Readonly<Record<string, Band>>;
	readonly source?: Source;
}

const MAX_NAME_LENGTH = 100;

function readPeers(sp: URLSearchParams, symbol: string): string[] {
	// a peer field may hold several tickers typed with commas or spaces
	const typed = sp.getAll('peer').flatMap((v) => v.split(/[\s,]+/));
	const valid = typed.map(parseSymbol).filter((s): s is string => s !== null && s !== symbol);
	return [...new Set(valid)].slice(0, MAX_PEERS);
}

function readMultiples(sp: URLSearchParams): string[] {
	if (!sp.has('m')) return [...DEFAULT_MULTIPLES];
	const asked = new Set(sp.getAll('m'));
	return MULTIPLES.map((m) => m.id)
		.filter((id) => asked.has(id))
		.slice(0, MAX_SELECTION);
}

const positive = (raw: string | null): number | null => {
	const value = Number((raw ?? '').trim().replace(',', '.'));
	return raw !== null && raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
};

/** A manual band needs both ends; the order does not matter here (`valueMethod` sorts them). */
function readOverrides(sp: URLSearchParams, multiples: readonly string[]): Record<string, Band> {
	return Object.fromEntries(
		multiples.flatMap((id) => {
			const low = positive(sp.get(`lo.${id}`));
			const high = positive(sp.get(`hi.${id}`));
			return low !== null && high !== null ? [[id, { low, high }]] : [];
		})
	);
}

/** Parse the query. `industries` is the known Damodaran list; an industry outside it is dropped. */
export function parseValuationNav(sp: URLSearchParams, industries: readonly string[] = []): ValuationNav {
	const symbol = parseSymbol(sp.get('symbol')) ?? '';
	const region = sp.get('region') ?? '';
	const industry = sp.get('industry') ?? '';
	const source = parseSource(sp.get('source'));
	const multiples = readMultiples(sp);
	return {
		symbol,
		peers: readPeers(sp, symbol),
		multiples,
		region: REGIONS.some((r) => r.id === region) ? region : DEFAULT_REGION,
		industry: industry.length <= MAX_NAME_LENGTH && industries.includes(industry) ? industry : null,
		overrides: readOverrides(sp, multiples),
		...(source ? { source } : {})
	};
}

/** The URL for a state; the inverse of `parseValuationNav`. */
export function valuationHref(nav: ValuationNav): string {
	const sp = new URLSearchParams();
	if (nav.symbol) sp.set('symbol', nav.symbol);
	for (const p of nav.peers) sp.append('peer', p);
	if (nav.multiples.length === 0) sp.append('m', '');
	for (const m of nav.multiples) sp.append('m', m);
	sp.set('region', nav.region);
	if (nav.industry) sp.set('industry', nav.industry);
	for (const [id, band] of Object.entries(nav.overrides)) {
		sp.set(`lo.${id}`, String(band.low));
		sp.set(`hi.${id}`, String(band.high));
	}
	if (nav.source) sp.set('source', nav.source);
	return `${VALUATION_PATH}?${sp}`;
}
