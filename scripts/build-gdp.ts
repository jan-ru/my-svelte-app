// Builds src/lib/data/gdp.json (GDP, current US$, most recent value per country) and src/lib/data/macro.json
// (inflation and real GDP growth, the latest five years per country) from the World Bank API.
// Usage: node scripts/build-gdp.ts   (needs network access)
import fs from 'node:fs';
import path from 'node:path';
import { MANUAL_NAMES, matchCountries } from '../src/lib/gdp-match.ts';
import { MACRO_INDICATORS, MACRO_YEARS, latestYears, type CountryMacro, type YearValue } from '../src/lib/macro.ts';

const API = 'https://api.worldbank.org/v2';
const dir = path.join(import.meta.dirname, '../src/lib/data');

async function getRows<T>(url: string): Promise<T[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	const [meta, rows] = (await res.json()) as [{ pages: number }, T[]];
	if (meta.pages !== 1) throw new Error(`${url}: expected one page, got ${meta.pages}`);
	return rows;
}

interface WbCountryRow {
	id: string;
	name: string;
	region: { id: string };
}
interface WbGdpRow {
	countryiso3code: string;
	date: string;
	value: number | null;
}

// The indicator call has no region field, so aggregates (region id "NA") are told apart through the country list.
const countryRows = await getRows<WbCountryRow>(`${API}/country?format=json&per_page=400`);
const gdpRows = await getRows<WbGdpRow>(
	`${API}/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=20000&mrnev=1`
);

// One more year than the window, so a country whose newest value is a year old still gets five.
const thisYear = new Date().getFullYear();
const range = `${thisYear - MACRO_YEARS - 1}:${thisYear}`;
const [inflationRows, growthRows] = await Promise.all(
	[MACRO_INDICATORS.inflation, MACRO_INDICATORS.growth].map((code) =>
		getRows<WbGdpRow>(`${API}/country/all/indicator/${code}?format=json&per_page=20000&date=${range}`)
	)
);

const real = countryRows.filter((c) => c.region.id !== 'NA');
const nameOf = new Map(real.map((c) => [c.id, c.name]));
const countries: Record<string, { name: string; value: number; year: number }> = {};
for (const r of gdpRows) {
	const name = nameOf.get(r.countryiso3code);
	if (name !== undefined && r.value !== null)
		countries[r.countryiso3code] = { name, value: r.value, year: Number(r.date) };
}
const world = gdpRows.find((r) => r.countryiso3code === 'WLD');
if (!world || world.value === null) throw new Error('No World Bank world total (WLD)');

const nyuNames = (JSON.parse(fs.readFileSync(path.join(dir, 'companies.json'), 'utf8')) as { countries: string[] })
	.countries;
const { mapping, unmatched, unusedWb, badManual } = matchCountries(
	nyuNames,
	real.map((c) => ({ iso3: c.id, name: c.name })),
	MANUAL_NAMES
);

// Checked before anything is written, so a stale manual table cannot leave a half-trusted gdp.json behind.
if (badManual.length > 0) {
	console.error(`Manual table entries whose World Bank name no longer exists: ${badManual.join('; ')}`);
	process.exit(1);
}

const out = {
	generated: new Date().toISOString().slice(0, 10),
	source: 'World Bank, GDP (current US$), indicator NY.GDP.MKTP.CD, most recent non-empty value',
	world: { value: world.value, year: Number(world.date) },
	countries,
	nyu: mapping,
	unmatched
};
fs.writeFileSync(path.join(dir, 'gdp.json'), `${JSON.stringify(out, null, 1)}\n`);

/** The values per real country, latest window only. */
function byCountry(rows: readonly WbGdpRow[]): Map<string, YearValue[]> {
	const all = new Map<string, YearValue[]>();
	for (const r of rows)
		if (nameOf.has(r.countryiso3code) && r.value !== null)
			all.set(r.countryiso3code, [
				...(all.get(r.countryiso3code) ?? []),
				{ year: Number(r.date), value: Math.round(r.value * 100) / 100 }
			]);
	return new Map([...all].map(([iso, values]) => [iso, latestYears(values)]));
}
const inflation = byCountry(inflationRows ?? []);
const growth = byCountry(growthRows ?? []);
const macroCountries: Record<string, CountryMacro> = {};
for (const iso of [...nameOf.keys()].sort())
	if (inflation.has(iso) || growth.has(iso))
		macroCountries[iso] = { inflation: inflation.get(iso) ?? [], growth: growth.get(iso) ?? [] };
const macro = {
	generated: out.generated,
	source: `World Bank, inflation (consumer prices, annual %, ${MACRO_INDICATORS.inflation}) and GDP growth (constant prices, annual %, ${MACRO_INDICATORS.growth}), latest ${MACRO_YEARS} years with a value`,
	countries: macroCountries
};
fs.writeFileSync(path.join(dir, 'macro.json'), `${JSON.stringify(macro, null, 1)}\n`);

const years = Object.values(countries).map((c) => c.year);
console.log(
	`Wrote gdp.json: ${Object.keys(countries).length} countries with a value (${Math.min(...years)} to ${Math.max(...years)}), world ${world.value} (${world.date}).`
);
console.log(
	`Countries share of world total: ${((Object.values(countries).reduce((s, c) => s + c.value, 0) / world.value) * 100).toFixed(1)}%`
);
console.log(
	`Wrote macro.json: ${inflation.size} countries with inflation, ${growth.size} with real growth (years ${range}).`
);
console.log(`NYU countries without a World Bank match (${unmatched.length}): ${unmatched.join('; ') || 'none'}`);
console.log(`World Bank countries no NYU name maps to (${unusedWb.length}): ${unusedWb.join(' ')}`);
