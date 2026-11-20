import { MEASURES, type Measure } from './size';

/** Every query parameter the size pages read; each must be in ISR_ALLOW_QUERY (a test checks). */
export const SIZE_PARAMS = ['measure', 'country', 'industry', 'sector', 'band'] as const;
/** The query parameters an anonymous visitor's view follows; the others need the login (see `pageParams`). */
export const PUBLIC_SIZE_PARAMS = ['band'] as const;
export const MAX_SELECTED = 12;
/** Larger band numbers are read as 1; the views clamp to the bands there are, which is far fewer. */
export const MAX_BAND = 50;

export type SizePage = '/countries' | '/industries';
export interface SizeNav {
	measure: Measure;
	countries: string[];
	industries: string[];
	sectors: string[];
	/** Which band of the main treemap to show, 1 being the largest items (see `bands.ts`). */
	band: number;
}
export interface SizeKnown {
	countries: readonly string[];
	industries: readonly string[];
	sectors: readonly string[];
}

const clean = (values: string[], known: readonly string[]): string[] =>
	[...new Set(values)]
		.filter((v) => known.includes(v))
		.sort((a, b) => a.localeCompare(b))
		.slice(0, MAX_SELECTED);

export function parseSizeNav(params: URLSearchParams, known: SizeKnown, page: SizePage): SizeNav {
	const countries = clean(params.getAll('country'), known.countries);
	const industries = clean(params.getAll('industry'), known.industries);
	const sectors = clean(params.getAll('sector'), known.sectors);
	const asked = MEASURES.find((m) => m.id === params.get('measure'))?.id ?? 'companies';
	// GDP exists only for countries, so it needs the countries page and no industry or sector restriction
	const measure: Measure =
		asked === 'gdp' && page === '/countries' && industries.length === 0 && sectors.length === 0 ? 'gdp' : 'companies';
	const band = Number(params.get('band'));
	return {
		measure,
		countries,
		industries,
		sectors,
		band: Number.isInteger(band) && band >= 1 && band <= MAX_BAND ? band : 1
	};
}

/** One canonical URL per view: the facets are sorted, so the order they were chosen in does not matter. */
export function sizeHref(page: SizePage, nav: SizeNav): string {
	const sp = new URLSearchParams();
	if (nav.measure !== 'companies') sp.set('measure', nav.measure);
	for (const c of nav.countries) sp.append('country', c);
	for (const i of nav.industries) sp.append('industry', i);
	for (const s of nav.sectors) sp.append('sector', s);
	if (nav.band > 1) sp.set('band', String(nav.band));
	const query = sp.toString();
	return query ? `${page}?${query}` : page;
}

export const toggle = (list: string[], value: string): string[] =>
	list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
