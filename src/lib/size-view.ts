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
		? `GDP in current US$, the latest value per country (${from === to ? from : `${from} to ${to}`}). Source: World Bank, indicator NY.GDP.MKTP.CD, CC BY 4.0. ` +
			(missing.length > 0 ? `No GDP for: ${missing.join(', ')}.` : '')
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
