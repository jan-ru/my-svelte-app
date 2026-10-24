export const MAX_SELECTION = 4;

export type Family = 'vebitda' | 'pe' | 'pbv' | 'ps';
export type Role = 'multiples' | 'regions' | 'industries';

export interface Region {
	id: string;
	label: string;
	/** Appended to the family name to get the regional workbook name. */
	suffix: string;
}

export interface Multiple {
	id: string;
	label: string;
	family: Family;
	/** Column header text in the sheet (whitespace-normalised). */
	column: string;
	/** Header group the column must sit under, for two-level headers. */
	group?: string;
}

export const REGIONS: readonly Region[] = [
	{ id: 'us', label: 'US', suffix: '' },
	{ id: 'europe', label: 'Europe', suffix: 'Europe' },
	{ id: 'global', label: 'Global', suffix: 'Global' },
	{ id: 'japan', label: 'Japan', suffix: 'Japan' },
	{ id: 'india', label: 'India', suffix: 'India' },
	{ id: 'china', label: 'China', suffix: 'China' },
	{ id: 'emerging', label: 'Emerging Markets', suffix: 'emerg' },
	{ id: 'anz-canada', label: 'Australia, NZ and Canada', suffix: 'Rest' }
];

const POSITIVE_EBITDA = 'Only positive EBITDA firms';

export const MULTIPLES: readonly Multiple[] = [
	{ id: 'ev_ebitda', label: 'EV/EBITDA', family: 'vebitda', column: 'EV/EBITDA', group: POSITIVE_EBITDA },
	{ id: 'ev_ebit', label: 'EV/EBIT', family: 'vebitda', column: 'EV/EBIT', group: POSITIVE_EBITDA },
	{ id: 'pe_trailing', label: 'P/E (trailing)', family: 'pe', column: 'Trailing PE' },
	{ id: 'pe_forward', label: 'P/E (forward)', family: 'pe', column: 'Forward PE' },
	{ id: 'pe_current', label: 'P/E (current)', family: 'pe', column: 'Current PE' },
	{ id: 'pbv', label: 'P/B', family: 'pbv', column: 'PBV' },
	{ id: 'ev_ic', label: 'EV/Invested Capital', family: 'pbv', column: 'EV/ Invested Capital' },
	{ id: 'ps', label: 'P/S', family: 'ps', column: 'Price/Sales' },
	{ id: 'ev_sales', label: 'EV/Sales', family: 'ps', column: 'EV/Sales' }
];

const US_FILE: Record<Family, string> = {
	vebitda: 'vebitda',
	pe: 'pedata',
	pbv: 'pbvdata',
	ps: 'psdata'
};

const BASE_URL = 'https://pages.stern.nyu.edu/~adamodar/pc/datasets/';

export const multipleById = (id: string): Multiple | undefined => MULTIPLES.find((m) => m.id === id);
export const regionById = (id: string): Region | undefined => REGIONS.find((r) => r.id === id);

export function workbookName(family: Family, regionId: string): string {
	const region = regionById(regionId);
	if (!region) throw new Error(`Unknown region: ${regionId}`);
	return region.id === 'us' ? US_FILE[family] : `${family}${region.suffix}`;
}

export const workbookUrl = (family: Family, regionId: string): string =>
	`${BASE_URL}${workbookName(family, regionId)}.xls`;
