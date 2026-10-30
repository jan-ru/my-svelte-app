// src/lib/server/fmp-info.ts
import { safeUrl } from '../safe-url';
import { FmpError, fmpGet, throwIfErrorBody } from './fmp';

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

export interface PriceTarget {
	consensus: number | null;
	median: number | null;
	high: number | null;
	low: number | null;
}

export interface Peer {
	symbol: string;
	name: string | null;
	price: number | null;
	marketCap: number | null;
}

export const PEERS_LIMIT = 20;
export const NEWS_LIMIT = 20;
const NEWS_PATH = 'news/stock';
const SNIPPET_MAX = 300;

export const str = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

export const num = (value: unknown): number | null => {
	const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const unexpected = () => new FmpError('unavailable', 'Unexpected response from FMP');

export function parseProfile(body: unknown): Profile | null {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw unexpected();
	const r = body[0];
	if (!r || typeof r !== 'object') return null;
	const rec = r as Record<string, unknown>;
	const profile: Profile = {
		name: str(rec.companyName),
		exchange: str(rec.exchangeFullName) ?? str(rec.exchange),
		sector: str(rec.sector),
		industry: str(rec.industry),
		country: str(rec.country),
		ceo: str(rec.ceo),
		website: safeUrl(rec.website),
		ipoDate: str(rec.ipoDate),
		currency: str(rec.currency),
		description: str(rec.description),
		employees: num(rec.fullTimeEmployees),
		price: num(rec.price),
		marketCap: num(rec.marketCap),
		beta: num(rec.beta)
	};
	return Object.values(profile).every((v) => v === null) ? null : profile;
}

export function parseNews(body: unknown): NewsItem[] {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw unexpected();
	const items: NewsItem[] = [];
	for (const entry of body) {
		if (!entry || typeof entry !== 'object') continue;
		const rec = entry as Record<string, unknown>;
		const title = str(rec.title);
		if (!title) continue;
		const text = str(rec.text);
		items.push({
			title,
			publisher: str(rec.publisher) ?? str(rec.site),
			date: str(rec.publishedDate),
			text: text && text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX).trimEnd()}…` : text,
			url: safeUrl(rec.url)
		});
	}
	return items;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePrices(body: unknown): PricePoint[] {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw unexpected();
	// One point per date: a repeated date keeps the last record in the response.
	const byDate = new Map<string, PricePoint>();
	for (const entry of body) {
		if (!entry || typeof entry !== 'object') continue;
		const rec = entry as Record<string, unknown>;
		const date = str(rec.date);
		const close = num(rec.close);
		if (!date || !ISO_DATE.test(date) || close === null) continue;
		byDate.set(date, { date, close, volume: num(rec.volume) });
	}
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function fetchProfile(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<Profile | null> {
	return parseProfile(await fmpGet('profile', { symbol }, apiKey, fetchFn));
}

export async function fetchNews(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<NewsItem[]> {
	return parseNews(await fmpGet(NEWS_PATH, { symbols: symbol, limit: String(NEWS_LIMIT) }, apiKey, fetchFn));
}

export async function fetchPrices(
	symbol: string,
	apiKey: string,
	from: string,
	to: string,
	fetchFn: typeof fetch = fetch
): Promise<PricePoint[]> {
	return parsePrices(await fmpGet('historical-price-eod/full', { symbol, from, to }, apiKey, fetchFn));
}

export function parsePriceTarget(body: unknown): PriceTarget | null {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw unexpected();
	const r = body[0];
	if (!r || typeof r !== 'object') return null;
	const rec = r as Record<string, unknown>;
	const target: PriceTarget = {
		consensus: num(rec.targetConsensus),
		median: num(rec.targetMedian),
		high: num(rec.targetHigh),
		low: num(rec.targetLow)
	};
	return Object.values(target).every((v) => v === null) ? null : target;
}

export function parsePeers(body: unknown): Peer[] {
	throwIfErrorBody(body);
	if (!Array.isArray(body)) throw unexpected();
	const peers: Peer[] = [];
	for (const entry of body) {
		if (!entry || typeof entry !== 'object') continue;
		const rec = entry as Record<string, unknown>;
		const symbol = str(rec.symbol);
		if (!symbol) continue;
		peers.push({ symbol, name: str(rec.companyName), price: num(rec.price), marketCap: num(rec.mktCap) });
	}
	return peers.slice(0, PEERS_LIMIT);
}

export async function fetchPriceTarget(
	symbol: string,
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<PriceTarget | null> {
	return parsePriceTarget(await fmpGet('price-target-consensus', { symbol }, apiKey, fetchFn));
}

export async function fetchPeers(symbol: string, apiKey: string, fetchFn: typeof fetch = fetch): Promise<Peer[]> {
	return parsePeers(await fmpGet('stock-peers', { symbol }, apiKey, fetchFn));
}
