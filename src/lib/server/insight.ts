// src/lib/server/insight.ts
// Loads Eulerpool's fair value and quality score for a listed company. Either may be missing or fail without
// hiding the other, and neither feeds the valuation: the page shows them beside it, labelled as Eulerpool's.
import type { FairValue, Insight, QualityScore } from '../insight';
import { sourceKeyName } from '../source';
import { cached } from './cache';
import { fetchEulerpoolFairValue, fetchEulerpoolQuality } from './eulerpool';
import { failureKind, sourceFailureMessage } from './source-error';

export type FairValueFetcher = (symbol: string, apiKey: string) => Promise<FairValue | null>;
export type QualityFetcher = (symbol: string, apiKey: string) => Promise<QualityScore | null>;

export interface InsightFetchers {
	readonly fairValue: FairValueFetcher;
	readonly quality: QualityFetcher;
}

export const INSIGHT_TTL_MS = 24 * 60 * 60 * 1000;
const bySymbol = (symbol: string, _apiKey: string) => symbol;

/** Both estimates change slowly, so a day's cache per ticker keeps a month's quota for many views. */
export const insightFetchers: InsightFetchers = {
	fairValue: cached(INSIGHT_TTL_MS, bySymbol, (symbol, apiKey) => fetchEulerpoolFairValue(symbol, apiKey)),
	quality: cached(INSIGHT_TTL_MS, bySymbol, (symbol, apiKey) => fetchEulerpoolQuality(symbol, apiKey))
};

interface Attempt<T> {
	readonly value: T | null;
	readonly error: string | null;
}

async function attempt<T>(what: string, symbol: string, run: () => Promise<T | null>): Promise<Attempt<T>> {
	try {
		return { value: await run(), error: null };
	} catch (error) {
		console.error(`Eulerpool ${what} for ${symbol} failed (${failureKind(error)})`);
		return {
			value: null,
			error: sourceFailureMessage(error, symbol, 'Eulerpool', sourceKeyName('eulerpool') ?? undefined)
		};
	}
}

/** What to tell the visitor about a part that is missing: the failure, or that Eulerpool simply has none. */
function messageFor(symbol: string, fair: Attempt<FairValue>, quality: Attempt<QualityScore>): string | null {
	const error = fair.error ?? quality.error;
	if (error) return error;
	if (!fair.value && !quality.value) return `Eulerpool has no fair value or quality score for ${symbol}.`;
	if (!fair.value) return `Eulerpool has no fair value for ${symbol}.`;
	if (!quality.value) return `Eulerpool has no quality score for ${symbol}.`;
	return null;
}

export async function loadInsight(
	symbol: string,
	apiKey: string,
	fetchers: InsightFetchers = insightFetchers
): Promise<Insight> {
	const [fair, quality] = await Promise.all([
		attempt('fair value', symbol, () => fetchers.fairValue(symbol, apiKey)),
		attempt('quality score', symbol, () => fetchers.quality(symbol, apiKey))
	]);
	return { fairValue: fair.value, quality: quality.value, message: messageFor(symbol, fair, quality) };
}
