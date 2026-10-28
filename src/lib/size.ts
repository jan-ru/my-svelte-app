import type { CompanyData } from './companies';

export const MEASURES = [
	{ id: 'companies', label: 'Companies' },
	{ id: 'gdp', label: 'GDP' }
] as const;
export type Measure = (typeof MEASURES)[number]['id'];

export type Dimension = 'country' | 'industry' | 'sector' | 'region';

/** An empty or missing list means no restriction; names that do not exist match nothing. */
export interface SizeFilter {
	countries?: readonly string[];
	industries?: readonly string[];
	sectors?: readonly string[];
}

const COLUMN = { industry: 3, country: 4, region: 5, sector: 6 } as const;
const LIST = { industry: 'industries', country: 'countries', region: 'groups', sector: 'sectors' } as const;

const indexSet = (names: readonly string[] | undefined, list: string[]): Set<number> | null =>
	names && names.length > 0 ? new Set(names.map((n) => list.indexOf(n)).filter((i) => i >= 0)) : null;

/** Number of companies per value of a dimension, among the companies that match the filter. Values without companies are absent. */
export function countBy(data: CompanyData, by: Dimension, filter: SizeFilter = {}): Record<string, number> {
	const countries = indexSet(filter.countries, data.countries);
	const industries = indexSet(filter.industries, data.industries);
	const sectors = indexSet(filter.sectors, data.sectors);
	const names = data[LIST[by]];
	const counts: Record<string, number> = {};
	for (const c of data.companies) {
		if (countries && !countries.has(c[4])) continue;
		if (industries && !industries.has(c[3])) continue;
		if (sectors && !sectors.has(c[6])) continue;
		const name = names[c[COLUMN[by]]];
		counts[name] = (counts[name] ?? 0) + 1;
	}
	return counts;
}

/** The sector most of an industry's companies belong to (alphabetical on a tie). NYU has industries that span more than one sector; this is only used for colour. */
export function dominantSector(data: CompanyData): Record<string, string> {
	const tally = new Map<number, Map<number, number>>();
	for (const c of data.companies) {
		const sectors = tally.get(c[3]) ?? new Map<number, number>();
		sectors.set(c[6], (sectors.get(c[6]) ?? 0) + 1);
		tally.set(c[3], sectors);
	}
	const out: Record<string, string> = {};
	for (const [industry, sectors] of tally) {
		const best = [...sectors].sort((a, b) => b[1] - a[1] || data.sectors[a[0]].localeCompare(data.sectors[b[0]]))[0][0];
		out[data.industries[industry]] = data.sectors[best];
	}
	return out;
}

/** The n ids with the largest values. */
export function topIds(values: Record<string, number>, n: number): string[] {
	return Object.entries(values)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, n)
		.map(([id]) => id);
}

export interface ShareItem {
	id: string;
	value: number;
	/** Percent of the global total. */
	percent: number;
}
export interface Shares {
	items: ShareItem[];
	/** What is left of the global total after the selection; null when nothing is left. */
	rest: ShareItem | null;
	total: number;
}
export const REST_ID = 'rest';

export function shareOfGlobal(values: Record<string, number>, selected: readonly string[], total: number): Shares {
	const pct = (v: number) => (total > 0 ? (100 * v) / total : 0);
	const items = [...new Set(selected)]
		.filter((id) => (values[id] ?? 0) > 0)
		.map((id) => ({ id, value: values[id], percent: pct(values[id]) }))
		.sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
	const restValue = total - items.reduce((s, i) => s + i.value, 0);
	const rest = restValue > total * 1e-9 ? { id: REST_ID, value: restValue, percent: pct(restValue) } : null;
	return { items, rest, total };
}

export interface CrossCell {
	count: number;
	percentOfGlobal: number;
	percentOfCountry: number;
	percentOfIndustry: number;
	/** The Companies page for this pair. */
	href: string;
}

/** One country and one industry together; null when either does not exist. */
export function crossCell(data: CompanyData, country: string, industry: string): CrossCell | null {
	if (!data.countries.includes(country) || !data.industries.includes(industry)) return null;
	const count = countBy(data, 'country', { industries: [industry] })[country] ?? 0;
	const inCountry = Object.values(countBy(data, 'industry', { countries: [country] })).reduce((s, n) => s + n, 0);
	const inIndustry = Object.values(countBy(data, 'country', { industries: [industry] })).reduce((s, n) => s + n, 0);
	const pct = (n: number, of: number) => (of > 0 ? (100 * n) / of : 0);
	return {
		count,
		percentOfGlobal: pct(count, data.companies.length),
		percentOfCountry: pct(count, inCountry),
		percentOfIndustry: pct(count, inIndustry),
		href: `/companies?${new URLSearchParams({ country, industry })}`
	};
}

/**
 * Light fills, so the dark label text keeps at least a 4.5:1 contrast (tested). Colour is never the only signal:
 * every tile is labelled and the table below the chart lists the sector.
 */
export const SECTOR_FILLS: Record<string, string> = {
	'Communication Services': '#E7C6F2',
	'Consumer Discretionary': '#FAD7A0',
	'Consumer Staples': '#D5E8A8',
	Energy: '#F5B7B1',
	Financials: '#AED6F1',
	'Health Care': '#A9DFBF',
	Industrials: '#D5D8DC',
	'Information Technology': '#A3E4D7',
	Materials: '#E6CDA6',
	'Real Estate': '#F9E79F',
	Utilities: '#C5CAE9'
};
export const COUNTRY_FILL = '#B3D6FF';
export const sectorFill = (sector: string): string => SECTOR_FILLS[sector] ?? '#E3E8EE';

export const formatCount = (n: number): string => n.toLocaleString('en');

export function formatUsd(n: number): string {
	for (const [size, name] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']] as const) {
		if (n >= size) return `US$ ${(n / size).toLocaleString('en', { maximumFractionDigits: n / size >= 100 ? 0 : 1 })} ${name}`;
	}
	return `US$ ${Math.round(n).toLocaleString('en')}`;
}

export function formatPercent(p: number): string {
	if (p >= 10) return `${p.toFixed(0)}%`;
	if (p >= 0.1) return `${p.toFixed(1)}%`;
	return p > 0 ? '<0.1%' : '0%';
}
