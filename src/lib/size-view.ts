import { get } from './at';
import type { CompanyData } from './companies';
import { gdpValues, gdpYearRange, type GdpData } from './gdp';
import {
	COUNTRY_FILL,
	crossCell,
	countBy,
	dominantSector,
	sectorFill,
	sectorStrong,
	shareOfGlobal,
	topIds,
	type CrossCell,
	type Shares
} from './size';
import type { SizeNav } from './size-nav';
import type { TreemapItem } from './size-treemap';

/** How many items the bars show when nothing is selected. */
export const TOP_N = 10;

export interface CountriesView {
	readonly measureLabel: string;
	/** The global total the percentages refer to: all companies, or the World Bank world GDP. */
	readonly total: number;
	/** Every country with a value for the measure. */
	readonly tiles: readonly TreemapItem[];
	/** The selected countries (or the largest ten) against the global total. */
	readonly shares: Shares;
	/** The industries of the selected countries, by company count; null when no country is selected. */
	readonly breakdown: readonly TreemapItem[] | null;
	/** The global company count, the denominator for `breakdown`. */
	readonly breakdownTotal: number;
	/** One country and one industry together. */
	readonly cross: CrossCell | null;
	/** What the GDP numbers are; null for the company measure. */
	readonly gdpNote: string | null;
}

/** One country and one industry together, when exactly one of each is selected. */
function crossOf(data: CompanyData, nav: SizeNav): CrossCell | null {
	const [country, ...otherCountries] = nav.countries;
	const [industry, ...otherIndustries] = nav.industries;
	if (country === undefined || industry === undefined || otherCountries.length > 0 || otherIndustries.length > 0)
		return null;
	return crossCell(data, country, industry);
}

const tilesOf = (values: Record<string, number>, fill: (id: string) => string): TreemapItem[] =>
	Object.entries(values)
		.filter(([, v]) => v > 0)
		.map(([id, value]) => ({ id, label: id, value, fill: fill(id) }))
		.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

export function countriesView(data: CompanyData, gdp: GdpData, nav: SizeNav): CountriesView {
	const gdpMeasure = nav.measure === 'gdp';
	const values = gdpMeasure
		? gdpValues(gdp, data.countries)
		: countBy(data, 'country', { industries: nav.industries, sectors: nav.sectors });
	const total = gdpMeasure ? gdp.world.value : data.companies.length;
	const selected = nav.countries.length > 0 ? nav.countries : topIds(values, TOP_N);

	const sectorOf = dominantSector(data);
	// GDP has no industry split, so the industry breakdown belongs to the companies measure only
	const breakdown =
		nav.countries.length > 0 && !gdpMeasure
			? tilesOf(countBy(data, 'industry', { countries: nav.countries, sectors: nav.sectors }), (industry) =>
					sectorFill(get(sectorOf, industry))
				)
			: null;
	const cross = crossOf(data, nav);

	const [from, to] = gdpYearRange(gdp);
	const missing = data.countries.filter((c) => !(c in values));
	const gdpNote = gdpMeasure
		? `GDP in current US$, the latest value per country (${from === to ? from : `${from} to ${to}`}). Source: World Bank, indicator NY.GDP.MKTP.CD, CC BY 4.0.` +
			(missing.length > 0 ? ` No GDP for: ${missing.join(', ')}.` : '')
		: null;

	return {
		measureLabel: gdpMeasure ? 'GDP' : 'companies',
		total,
		tiles: tilesOf(values, () => COUNTRY_FILL),
		shares: shareOfGlobal(values, selected, total),
		breakdown,
		breakdownTotal: data.companies.length,
		cross,
		gdpNote
	};
}

export interface IndustriesView {
	readonly measureLabel: string;
	/** All companies: the global total the percentages refer to. */
	readonly total: number;
	/** Every industry with companies, coloured by its sector. */
	readonly tiles: readonly TreemapItem[];
	/** The sectors present in `tiles`, with their strong colour and company count: the legend, the block headers and the drill-down links. */
	readonly legend: readonly { readonly sector: string; readonly fill: string; readonly value: number }[];
	/** The selected industries (or the largest ten) against the global total. */
	readonly shares: Shares;
	/** The countries of the selected industries, by company count; null when no industry is selected. */
	readonly breakdown: readonly TreemapItem[] | null;
	readonly cross: CrossCell | null;
}

export function industriesView(data: CompanyData, nav: SizeNav): IndustriesView {
	const values = countBy(data, 'industry', { countries: nav.countries, sectors: nav.sectors });
	const total = data.companies.length;
	const sectorOf = dominantSector(data);
	const tiles = tilesOf(values, (industry) => sectorFill(get(sectorOf, industry))).map((t) => ({
		...t,
		group: get(sectorOf, t.id)
	}));
	const legendCounts = new Map<string, number>();
	for (const t of tiles) legendCounts.set(t.group, (legendCounts.get(t.group) ?? 0) + t.value);
	const legend = [...legendCounts]
		.map(([sector, value]) => ({ sector, fill: sectorStrong(sector), value }))
		.sort((a, b) => b.value - a.value || a.sector.localeCompare(b.sector));
	const selected = nav.industries.length > 0 ? nav.industries : topIds(values, TOP_N);
	const breakdown =
		nav.industries.length > 0
			? tilesOf(countBy(data, 'country', { industries: nav.industries, sectors: nav.sectors }), () => COUNTRY_FILL)
			: null;
	const cross = crossOf(data, nav);
	return {
		measureLabel: 'companies',
		total,
		tiles,
		legend,
		shares: shareOfGlobal(values, selected, total),
		breakdown,
		cross
	};
}
