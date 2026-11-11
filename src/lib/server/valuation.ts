// src/lib/server/valuation.ts
// Loads what the valuation page shows: the company's figures, the peers' multiples, FMP's peer suggestions and the
// Damodaran sector values, then hands them to the pure calculation in `valuation.ts`.
import { resolveSource, sourceKeyName, sourceLabel, type Source } from '../source';
import type { Insight } from '../insight';
import type { Peer, Statement } from '../source-data';
import { parseSymbol } from '../symbol';
import { BASIS, valuationView } from '../valuation/valuation';
import type { CompanyFigures, PeerRow, ValuationView } from '../valuation/data';
import { figuresFromStatements, peerMultiples } from '../valuation/figures';
import type { ValuationNav } from '../valuation/nav';
import { getComparison } from './compare';
import { insightFetchers, loadInsight, type InsightFetchers } from './insight';
import {
	fetchersOf,
	keyOf,
	type PeersFetcher,
	type ProfileFetcher,
	type RatiosFetcher,
	type StatementFetcher
} from './financials';
import { failureKind, sourceFailureMessage } from './source-error';

/** What the valuation needs from one source. Estimates and peers are FMP only. */
export interface ValuationFetchers {
	readonly statement: StatementFetcher;
	readonly profile: ProfileFetcher;
	readonly estimates?: RatiosFetcher;
	readonly peers?: PeersFetcher;
}

/** Damodaran values for the selected multiples in one region and industry, keyed by multiple id. */
export type SectorLoader = (
	multiples: readonly string[],
	region: string,
	industry: string
) => Promise<Readonly<Record<string, number | null>>>;

export const loadSector: SectorLoader = async (multiples, region, industry) => {
	const comparison = await getComparison({ multiples: [...multiples], regions: [region], industries: [industry] });
	return Object.fromEntries(multiples.map((m) => [m, comparison.cells[m]?.[region]?.[industry]?.value ?? null]));
};

export type ValuationPage =
	| { readonly state: 'locked' }
	| { readonly state: 'unconfigured' }
	| { readonly state: 'idle' }
	| { readonly state: 'invalid' }
	| {
			readonly state: 'ready';
			/** The ticker, or '' for a private company. */
			readonly symbol: string;
			/** Where the company's figures came from; peers come from the source the peer's ticker resolves to. */
			readonly source: Source | 'manual';
			readonly company: CompanyFigures | null;
			readonly message: string | null;
			/** FMP's peer suggestions that are not picked yet. */
			readonly suggestions: readonly Peer[];
			readonly peers: readonly PeerRow[];
			readonly result: ValuationView | null;
			readonly sectorMessage: string | null;
			/** Eulerpool's own estimates, beside the valuation and not part of it; null for a private company or without a key. */
			readonly insight: Insight | null;
	  };

function messageFor(what: string, symbol: string, error: unknown, source: Source): string {
	console.error(`valuation: ${sourceLabel(source)} ${what} for ${symbol} failed (${failureKind(error)})`);
	return sourceFailureMessage(error, symbol, sourceLabel(source));
}

const orNull = <T>(promise: Promise<T> | undefined): Promise<T | null> =>
	promise ? promise.catch(() => null) : Promise.resolve(null);

interface Loaded {
	readonly figures: CompanyFigures | null;
	readonly name: string;
	readonly marketCap: number | null;
	readonly message: string | null;
}

/** One company's figures; only the income statement is required, the rest fills in what it can. */
async function loadCompany(
	symbol: string,
	source: Source,
	fetchers: ValuationFetchers,
	apiKey: string,
	needForecast: boolean
): Promise<Loaded> {
	const [profile, balance, estimates] = await Promise.all([
		orNull(fetchers.profile(symbol, apiKey)),
		orNull(fetchers.statement('balance', symbol, apiKey, 'annual')),
		orNull(needForecast ? fetchers.estimates?.(symbol, apiKey) : undefined)
	]);
	const name = profile?.name ?? symbol;
	const marketCap = profile?.marketCap ?? null;
	let income: Statement;
	try {
		income = await fetchers.statement('income', symbol, apiKey, 'annual');
	} catch (error) {
		return { figures: null, name, marketCap, message: messageFor('income statement', symbol, error, source) };
	}
	const figures = figuresFromStatements({
		name,
		origin: source,
		income,
		balance,
		estimates,
		currency: profile?.currency ?? null
	});
	return {
		figures,
		name,
		marketCap,
		message: figures ? null : `${sourceLabel(source)} has no annual figures for ${symbol}.`
	};
}

export async function loadValuation(input: {
	readonly authed: boolean;
	readonly nav: ValuationNav;
	readonly rawSymbol: string | null;
	readonly apiKey: string | undefined;
	/** The Eulerpool key; `apiKey` is FMP's. */
	readonly eulerpoolKey?: string | undefined;
	/** Replace single fetchers or the sector loader (tests inject these). */
	readonly fmp?: Partial<ValuationFetchers>;
	readonly yahoo?: Partial<ValuationFetchers>;
	readonly eulerpool?: Partial<ValuationFetchers>;
	readonly insight?: Partial<InsightFetchers>;
	readonly sector?: SectorLoader;
}): Promise<ValuationPage> {
	if (!input.authed) return { state: 'locked' };
	const { nav } = input;
	const keys = { fmp: input.apiKey, eulerpool: input.eulerpoolKey };
	const source = resolveSource(nav.source, nav.symbol);
	// a private company needs no ticker and no key of its own; its peers say so per row when the key is missing
	const symbol = nav.company ? '' : parseSymbol(input.rawSymbol);
	if (!nav.company) {
		if (sourceKeyName(source) !== null && !keyOf(source, keys)) return { state: 'unconfigured' };
		if (!input.rawSymbol?.trim()) return { state: 'idle' };
		if (!symbol) return { state: 'invalid' };
	}

	const fetchersFor = (s: Source): ValuationFetchers =>
		fetchersOf(s, { fmp: input.fmp, yahoo: input.yahoo, eulerpool: input.eulerpool });
	const keyFor = (s: Source) => keyOf(s, keys);
	const needForecast = nav.multiples.some((m) => BASIS[m]?.year === 'forward');

	const loadPeer = async (peer: string): Promise<PeerRow> => {
		const peerSource = resolveSource(nav.source, peer);
		if (sourceKeyName(peerSource) !== null && !keyFor(peerSource)) {
			return {
				...peerMultiples(peer, peer, null, null),
				message: `The ${sourceLabel(peerSource)} key is not configured.`
			};
		}
		const loaded = await loadCompany(peer, peerSource, fetchersFor(peerSource), keyFor(peerSource), needForecast);
		const message =
			loaded.message ?? (loaded.marketCap === null ? `No market cap for ${peer}, so no multiples.` : null);
		return { ...peerMultiples(peer, loaded.name, loaded.figures, loaded.marketCap), message };
	};

	const fetchers = fetchersFor(source);
	const sector = input.sector ?? loadSector;
	// Eulerpool's estimates need only a ticker and its key, whichever source the figures come from
	const eulerpoolKey = keyFor('eulerpool');
	const skipInsight = nav.company || !symbol || !eulerpoolKey;
	const [company, peers, suggested, sectors, insight] = await Promise.all([
		nav.company || !symbol
			? { figures: nav.company, name: nav.company?.name ?? '', marketCap: null, message: null }
			: loadCompany(symbol, source, fetchers, keyFor(source), needForecast),
		Promise.all(nav.peers.map(loadPeer)),
		nav.company || !symbol ? null : orNull(fetchers.peers?.(symbol, keyFor(source))),
		nav.industry && nav.multiples.length > 0
			? sector(nav.multiples, nav.region, nav.industry).catch((error: unknown) => {
					console.error('valuation: Damodaran sector values failed', error);
					return null;
				})
			: Promise.resolve({}),
		skipInsight ? null : loadInsight(symbol, eulerpoolKey, { ...insightFetchers, ...input.insight })
	]);

	return {
		state: 'ready',
		symbol: symbol ?? '',
		source: nav.company ? 'manual' : source,
		company: company.figures,
		message: company.message,
		suggestions: (suggested ?? []).filter((p) => p.symbol !== symbol && !nav.peers.includes(p.symbol)),
		peers,
		result: company.figures
			? valuationView({
					figures: company.figures,
					multiples: nav.multiples,
					peers,
					sectors: sectors ?? {},
					overrides: nav.overrides
				})
			: null,
		sectorMessage: sectors === null ? 'The Damodaran sector values could not be loaded right now.' : null,
		insight
	};
}
