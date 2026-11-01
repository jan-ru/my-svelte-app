// Inflation and real GDP growth per country, from macro.json (written by `npm run build:gdp`).
// Rates do not add up to a world total, so they are shown per selected country, not as tiles or shares.

/** One yearly value of a World Bank rate, in percent. */
export interface YearValue {
	readonly year: number;
	readonly value: number;
}

/** The latest years with a value, oldest first; at most `MACRO_YEARS` of them. */
export interface CountryMacro {
	readonly inflation: readonly YearValue[];
	readonly growth: readonly YearValue[];
}

export interface MacroData {
	readonly generated: string;
	readonly source: string;
	/** World Bank countries with at least one value, by ISO3 code. */
	readonly countries: Readonly<Record<string, CountryMacro>>;
}

/** World Bank indicator codes. */
export const MACRO_INDICATORS = {
	inflation: 'FP.CPI.TOTL.ZG', // inflation, consumer prices (annual %)
	growth: 'NY.GDP.MKTP.KD.ZG' // GDP growth (annual %), constant prices
} as const;

/** The average covers this many years; a single year (such as 2022's inflation spike) misleads. */
export const MACRO_YEARS = 5;
/** Fewer values than this give no average. */
export const MACRO_MIN_YEARS = 3;

export interface RateSummary {
	readonly latest: YearValue;
	/** Mean of the values from `from` to `latest.year`; null with fewer than `MACRO_MIN_YEARS` values. */
	readonly average: number | null;
	readonly from: number;
}

export interface MacroRow {
	readonly country: string;
	readonly inflation: RateSummary | null;
	readonly growth: RateSummary | null;
}

/** Keeps the latest `MACRO_YEARS` values in a window ending at the newest year, oldest first. */
export function latestYears(values: readonly YearValue[]): YearValue[] {
	const newest = Math.max(...values.map((v) => v.year));
	return values.filter((v) => v.year > newest - MACRO_YEARS).toSorted((a, b) => a.year - b.year);
}

export function summarize(values: readonly YearValue[]): RateSummary | null {
	const kept = latestYears(values);
	const first = kept[0];
	const latest = kept.at(-1);
	if (!first || !latest) return null;
	const average = kept.length >= MACRO_MIN_YEARS ? kept.reduce((s, v) => s + v.value, 0) / kept.length : null;
	return { latest, average, from: first.year };
}

/** One row per selected NYU country; rates are null when the country is unmapped or has no values. */
export function macroRows(
	macro: MacroData,
	nyu: Readonly<Record<string, string>>,
	countries: readonly string[]
): MacroRow[] {
	return countries.map((country) => {
		const iso = nyu[country];
		const m = iso ? macro.countries[iso] : undefined;
		return { country, inflation: m ? summarize(m.inflation) : null, growth: m ? summarize(m.growth) : null };
	});
}

/** A rate in percent with one decimal and its sign, such as "2.8%" or "−0.4%". */
export function formatRate(p: number): string {
	const s = Math.abs(p).toFixed(1);
	return s === '0.0' ? '0.0%' : `${p < 0 ? '−' : ''}${s}%`;
}

/** The oldest and newest year shown among the rows, for the source line; null when nothing is shown. */
export function macroYearRange(rows: readonly MacroRow[]): [number, number] | null {
	const years = rows.flatMap((r) => [r.inflation, r.growth]).flatMap((s) => (s ? [s.from, s.latest.year] : []));
	return years.length > 0 ? [Math.min(...years), Math.max(...years)] : null;
}
