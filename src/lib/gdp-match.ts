export interface WbCountry {
	iso3: string;
	name: string;
}

/**
 * NYU country names that differ from the World Bank's. Checked against the live API on 2026-10-28; the build script
 * prints any target that no longer exists. Jersey and Guernsey are left out on purpose: the World Bank reports them
 * together as "Channel Islands", and mapping both would count that GDP twice. Taiwan and Martinique have no World Bank
 * entry. All of these stay in the company counts and show GDP as "n/a".
 */
export const MANUAL_NAMES: Record<string, string> = {
	'South Korea': 'Korea, Rep.',
	'Hong Kong': 'Hong Kong SAR, China',
	Turkey: 'Turkiye',
	Vietnam: 'Viet Nam',
	'Czech Republic': 'Czechia',
	'Ivory Coast': "Cote d'Ivoire",
	Egypt: 'Egypt, Arab Rep.',
	Venezuela: 'Venezuela, RB',
	'Palestinian Authority': 'West Bank and Gaza',
	'Trinidad & Tobago': 'Trinidad and Tobago',
	'Saint Lucia': 'St. Lucia',
	'Curaçao': 'Curacao',
	Bahamas: 'Bahamas, The',
	Macau: 'Macao SAR, China',
	Slovakia: 'Slovak Republic',
	Macedonia: 'North Macedonia',
	Russia: 'Russian Federation',
	'Turks & Caicos Islands': 'Turks and Caicos Islands'
};

export interface Matching {
	/** NYU country name to World Bank ISO3 code. */
	mapping: Record<string, string>;
	/** NYU names with no World Bank counterpart. */
	unmatched: string[];
	/** World Bank ISO3 codes no NYU name points at. */
	unusedWb: string[];
	/** NYU names whose manual target is not a World Bank name (the table needs fixing). */
	badManual: string[];
}

export function matchCountries(nyu: readonly string[], wb: readonly WbCountry[], manual: Record<string, string>): Matching {
	const byName = new Map(wb.map((c) => [c.name, c.iso3]));
	const mapping: Record<string, string> = {};
	const unmatched: string[] = [];
	const badManual: string[] = [];
	const owner = new Map<string, string>();
	for (const name of nyu) {
		let iso = byName.get(name);
		const target = manual[name];
		if (iso === undefined && target !== undefined) {
			iso = byName.get(target);
			if (iso === undefined) badManual.push(name);
		}
		if (iso === undefined) {
			unmatched.push(name);
			continue;
		}
		const other = owner.get(iso);
		if (other !== undefined) throw new Error(`${other} and ${name} both map to ${iso}`);
		owner.set(iso, name);
		mapping[name] = iso;
	}
	const used = new Set(Object.values(mapping));
	const unusedWb = wb.map((c) => c.iso3).filter((iso) => !used.has(iso)).sort();
	return { mapping, unmatched, unusedWb, badManual };
}
