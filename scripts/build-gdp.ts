// Builds src/lib/data/gdp.json from the World Bank API (GDP, current US$, most recent value per country).
// Usage: node scripts/build-gdp.ts   (needs network access)
import fs from 'node:fs';
import path from 'node:path';
import { MANUAL_NAMES, matchCountries } from '../src/lib/gdp-match.ts';

const API = 'https://api.worldbank.org/v2';
const dir = path.join(import.meta.dirname, '../src/lib/data');

async function getRows<T>(url: string): Promise<T[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	const [meta, rows] = (await res.json()) as [{ pages: number }, T[]];
	if (meta.pages !== 1) throw new Error(`${url}: expected one page, got ${meta.pages}`);
	return rows;
}

interface WbCountryRow { id: string; name: string; region: { id: string } }
interface WbGdpRow { countryiso3code: string; date: string; value: number | null }

// The indicator call has no region field, so aggregates (region id "NA") are told apart through the country list.
const countryRows = await getRows<WbCountryRow>(`${API}/country?format=json&per_page=400`);
const gdpRows = await getRows<WbGdpRow>(`${API}/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=20000&mrnev=1`);

const real = countryRows.filter((c) => c.region.id !== 'NA');
const nameOf = new Map(real.map((c) => [c.id, c.name]));
const countries: Record<string, { name: string; value: number; year: number }> = {};
for (const r of gdpRows) {
	const name = nameOf.get(r.countryiso3code);
	if (name !== undefined && r.value !== null) countries[r.countryiso3code] = { name, value: r.value, year: Number(r.date) };
}
const world = gdpRows.find((r) => r.countryiso3code === 'WLD');
if (!world || world.value === null) throw new Error('No World Bank world total (WLD)');

const nyuNames = (JSON.parse(fs.readFileSync(path.join(dir, 'companies.json'), 'utf8')) as { countries: string[] }).countries;
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

const years = Object.values(countries).map((c) => c.year);
console.log(`Wrote gdp.json: ${Object.keys(countries).length} countries with a value (${Math.min(...years)} to ${Math.max(...years)}), world ${world.value} (${world.date}).`);
console.log(`Countries share of world total: ${((Object.values(countries).reduce((s, c) => s + c.value, 0) / world.value) * 100).toFixed(1)}%`);
console.log(`NYU countries without a World Bank match (${unmatched.length}): ${unmatched.join('; ') || 'none'}`);
console.log(`World Bank countries no NYU name maps to (${unusedWb.length}): ${unusedWb.join(' ')}`);
