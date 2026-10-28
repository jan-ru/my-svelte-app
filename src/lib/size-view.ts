import type { CompanyData } from './companies';
import { gdpValues, gdpYearRange, type GdpData } from './gdp';
import {
	COUNTRY_FILL,
	crossCell,
	countBy,
	dominantSector,
	sectorFill,
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
	measureLabel: string;
	/** The global total the percentages refer to: all companies, or the World Bank world GDP. */
	total: number;
	/** Every country with a value for the measure. */
	tiles: TreemapItem[];
	/** The selected countries (or the largest ten) against the global total. */
	shares: Shares;
	/** The industries of the selected countries, by company count; null when no country is selected. */
	breakdown: TreemapItem[] | null;
	/** The global company count, the denominator for `breakdown`. */
	breakdownTotal: number;
	/** One country and one industry together. */
	cross: CrossCell | null;
	/** What the GDP numbers are; null for the company measure. */
	gdpNote: string | null;
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
	const breakdown =
		nav.countries.length > 0
			? tilesOf(countBy(data, 'industry', { countries: nav.countries, sectors: nav.sectors }), (industry) => sectorFill(sectorOf[industry]))
			: null;
	const cross = nav.countries.length === 1 && nav.industries.length === 1 ? crossCell(data, nav.countries[0], nav.industries[0]) : null;

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
	measureLabel: string;
	/** All companies: the global total the percentages refer to. */
	total: number;
	/** Every industry with companies, coloured by its sector. */
	tiles: TreemapItem[];
	/** The sectors present in `tiles`, with their colour and company count: the legend, and the drill-down links. */
	legend: { sector: string; fill: string; value: number }[];
	/** The selected industries (or the largest ten) against the global total. */
	shares: Shares;
	/** The countries of the selected industries, by company count; null when no industry is selected. */
	breakdown: TreemapItem[] | null;
	cross: CrossCell | null;
}

export function industriesView(data: CompanyData, nav: SizeNav): IndustriesView {
	const values = countBy(data, 'industry', { countries: nav.countries, sectors: nav.sectors });
	const total = data.companies.length;
	const sectorOf = dominantSector(data);
	const tiles = tilesOf(values, (industry) => sectorFill(sectorOf[industry]));
	const legendCounts = new Map<string, number>();
	for (const t of tiles) legendCounts.set(sectorOf[t.id], (legendCounts.get(sectorOf[t.id]) ?? 0) + t.value);
	const legend = [...legendCounts]
		.map(([sector, value]) => ({ sector, fill: sectorFill(sector), value }))
		.sort((a, b) => b.value - a.value || a.sector.localeCompare(b.sector));
	const selected = nav.industries.length > 0 ? nav.industries : topIds(values, TOP_N);
	const breakdown =
		nav.industries.length > 0 ? tilesOf(countBy(data, 'country', { industries: nav.industries, sectors: nav.sectors }), () => COUNTRY_FILL) : null;
	const cross = nav.countries.length === 1 && nav.industries.length === 1 ? crossCell(data, nav.countries[0], nav.industries[0]) : null;
	return { measureLabel: 'companies', total, tiles, legend, shares: shareOfGlobal(values, selected, total), breakdown, cross };
}
