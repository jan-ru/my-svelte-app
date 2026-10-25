// Builds src/lib/data/companies.json from the NYU Stern company list (indname.xls).
// Usage: node scripts/build-companies.mjs <path-to-indname.xls>
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) {
	console.error('Usage: node scripts/build-companies.mjs <path-to-indname.xls>');
	process.exit(1);
}

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const wb = XLSX.read(fs.readFileSync(input), { type: 'buffer', sheets: 'By industry' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['By industry'], { header: 1, defval: null }).slice(1);

// Dictionary-code the repeated text to keep the file small.
const dict = () => {
	const values = [];
	const index = new Map();
	return {
		values,
		id(value) {
			if (!index.has(value)) (index.set(value, values.length), values.push(value));
			return index.get(value);
		}
	};
};
const industries = dict();
const countries = dict();
const groups = dict();

const companies = [];
for (const r of rows) {
	const name = clean(r[0]);
	const industry = clean(r[2]);
	if (!name || !industry) continue;
	const sic = clean(r[4]);
	companies.push([
		name,
		clean(r[1]),
		/^\d{1,4}$/.test(sic) ? sic.padStart(4, '0') : '',
		industries.id(industry),
		countries.id(clean(r[5])),
		groups.id(clean(r[6]))
	]);
}
companies.sort((a, b) => a[0].localeCompare(b[0]));

const out = {
	generated: new Date().toISOString().slice(0, 10),
	industries: industries.values,
	countries: countries.values,
	groups: groups.values,
	/** [name, ticker, sic, industry index, country index, region group index] */
	companies
};
const target = path.join('src', 'lib', 'data', 'companies.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out));
console.log(
	`wrote ${target}: ${fs.statSync(target).size} bytes; ${companies.length} companies, ` +
		`${industries.values.length} industries, ${countries.values.length} countries, ${groups.values.length} regions`
);
