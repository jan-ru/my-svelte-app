export interface GdpData {
	generated: string;
	source: string;
	world: { value: number; year: number };
	/** World Bank countries (aggregates left out) that have a value, by ISO3 code. */
	countries: Record<string, { name: string; value: number; year: number }>;
	/** NYU country name to ISO3 code. */
	nyu: Record<string, string>;
	/** NYU countries with no World Bank counterpart. */
	unmatched: string[];
}

/** GDP in current US$ and its year for an NYU country; null when unmapped or the World Bank has no value. */
export function gdpOf(data: GdpData, nyuName: string): { value: number; year: number } | null {
	const iso = data.nyu[nyuName];
	const country = iso ? data.countries[iso] : undefined;
	return country ? { value: country.value, year: country.year } : null;
}

/** NYU country name to GDP, for the countries that have one. */
export function gdpValues(data: GdpData, nyuNames: readonly string[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const name of nyuNames) {
		const gdp = gdpOf(data, name);
		if (gdp) out[name] = gdp.value;
	}
	return out;
}

/** Oldest and newest year among the countries' latest values. */
export function gdpYearRange(data: GdpData): [number, number] {
	const years = Object.values(data.countries).map((c) => c.year);
	return [Math.min(...years), Math.max(...years)];
}
