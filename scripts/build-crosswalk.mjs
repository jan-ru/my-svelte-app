// Builds src/lib/data/crosswalk.json from the official correspondence tables.
// Usage: node scripts/build-crosswalk.mjs <input-dir>
// The input directory must contain the files listed in FILES (see docs/crosswalk.md).
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

const FILES = {
	sbiStructure: 'sbi2025_structuur.xlsx',
	sbi25to08: 'schakel_2025_2008.xlsx',
	isic4to31: 'isic4_isic31.txt',
	isic31Naics: 'isic31_naics2002_titles.txt',
	sicNaics: 'sic_naics2002.xls',
	indname: 'indname.xls'
};

const dir = process.argv[2];
if (!dir) {
	console.error('Usage: node scripts/build-crosswalk.mjs <input-dir>');
	process.exit(1);
}
const file = (key) => path.join(dir, FILES[key]);
const sheetRows = (key, sheet) => {
	const wb = XLSX.read(fs.readFileSync(file(key)), { type: 'buffer', sheets: sheet });
	return XLSX.utils.sheet_to_json(wb.Sheets[sheet ?? wb.SheetNames[0]], { header: 1, defval: null });
};

function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
			else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') (row.push(cell), (cell = ''));
		else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(cell);
			cell = '';
			if (row.length > 1 || row[0] !== '') rows.push(row);
			row = [];
		} else cell += c;
	}
	if (cell !== '' || row.length) (row.push(cell), rows.push(row));
	return rows.slice(1); // header
}

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const addTo = (map, key, value) => {
	if (!map[key]) map[key] = [];
	if (!map[key].includes(value)) map[key].push(value);
};
const sorted = (map) => Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]));

// 1. SBI 2025 structure (levels 1-4 = sections, divisions, groups, classes; first four levels equal NACE Rev. 2.1).
const sbi25 = {};
for (const r of sheetRows('sbiStructure', 'Structuur SBI2025 versie 2026').slice(1)) {
	const level = Number(r[0]);
	const code = clean(r[2]);
	if (!code || level > 4) continue;
	sbi25[code] = { level, section: clean(r[3]), nl: clean(r[4]), en: clean(r[5]) };
}

// 2. SBI 2025 -> SBI 2008 (= NACE Rev. 2 = ISIC Rev. 4 at four digits).
const sbi25ToNace2 = {};
const nace2Titles = {};
for (const r of sheetRows('sbi25to08', 'SBI2025-SBI2008 v2.0').slice(1)) {
	const from = clean(r[0]).slice(0, 4);
	const to = clean(r[3]).slice(0, 4);
	if (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to)) continue;
	addTo(sbi25ToNace2, from, to);
	// the 5-digit SBI 2008 title is only used when no 4-digit title is known
	nace2Titles[to] ??= clean(r[5]);
}

// 3. ISIC Rev. 4 -> ISIC Rev. 3.1 (UN).
const isic4ToIsic31 = {};
for (const r of parseCsv(fs.readFileSync(file('isic4to31'), 'utf8'))) addTo(isic4ToIsic31, clean(r[0]), clean(r[2]));

// 4. ISIC Rev. 3.1 -> NAICS 2002 US (UN).
const isic31ToNaics = {};
const isic31Titles = {};
const naicsTitles = {};
for (const r of parseCsv(fs.readFileSync(file('isic31Naics'), 'utf8'))) {
	const isic = clean(r[0]);
	const naics = clean(r[2]);
	if (!isic || !naics) continue;
	addTo(isic31ToNaics, isic, naics);
	isic31Titles[isic] ??= clean(r[1]);
	naicsTitles[naics] ??= clean(r[3]);
}

// 5. NAICS 2002 -> SIC 1987 (US Census).
const naicsToSic = {};
const sicTitles = {};
for (const r of sheetRows('sicNaics').slice(1)) {
	if (typeof r[0] !== 'number' || typeof r[2] !== 'number') continue;
	const sic = String(r[0]).padStart(4, '0');
	const naics = String(r[2]);
	addTo(naicsToSic, naics, sic);
	sicTitles[sic] ??= clean(r[1]);
	naicsTitles[naics] ??= clean(r[3]);
}

// 6. SIC -> Damodaran industry, counted over the companies in indname.xls.
const sicToDamodaran = {};
let companies = 0;
for (const r of sheetRows('indname', 'By industry').slice(1)) {
	const industry = clean(r[2]);
	const sic = String(clean(r[4])).padStart(4, '0');
	if (!industry || !/^\d{4}$/.test(sic)) continue;
	companies++;
	sicToDamodaran[sic] ??= {};
	sicToDamodaran[sic][industry] = (sicToDamodaran[sic][industry] ?? 0) + 1;
}
const damodaran = Object.fromEntries(
	Object.entries(sicToDamodaran)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([sic, counts]) => [sic, Object.entries(counts).sort((a, b) => b[1] - a[1])])
);

const out = {
	generated: new Date().toISOString().slice(0, 10),
	companies,
	sbi25,
	sbi25ToNace2: sorted(sbi25ToNace2),
	nace2Titles,
	isic4ToIsic31: sorted(isic4ToIsic31),
	isic31Titles,
	isic31ToNaics: sorted(isic31ToNaics),
	naicsTitles,
	naicsToSic: sorted(naicsToSic),
	sicTitles,
	damodaran
};

const target = path.join('src', 'lib', 'data', 'crosswalk.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out));
console.log(
	`wrote ${target}: ${fs.statSync(target).size} bytes; sbi25 ${Object.keys(sbi25).length}, ` +
		`sbi25->nace2 ${Object.keys(out.sbi25ToNace2).length}, isic4->3.1 ${Object.keys(out.isic4ToIsic31).length}, ` +
		`isic3.1->naics ${Object.keys(out.isic31ToNaics).length}, naics->sic ${Object.keys(out.naicsToSic).length}, ` +
		`sic->damodaran ${Object.keys(damodaran).length}, companies ${companies}`
);
