// Builds src/lib/data/crosswalk.json from the official correspondence tables.
// Usage: node scripts/build-crosswalk.ts <input-dir>
// The input directory must contain the files listed in FILES (see docs/crosswalk.md).
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';

type Key = keyof typeof FILES;
type Table = Record<string, string[]>;
type Row = unknown[];

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
	console.error('Usage: node scripts/build-crosswalk.ts <input-dir>');
	process.exit(1);
}
const file = (key: Key): string => path.join(dir, FILES[key]);
const sheetRows = (key: Key, sheet?: string): Row[] => {
	const wb = XLSX.read(fs.readFileSync(file(key)), { type: 'buffer', sheets: sheet });
	const name = sheet ?? wb.SheetNames[0];
	const ws = name === undefined ? undefined : wb.Sheets[name];
	if (!ws) throw new Error(`No sheet ${name ?? ''} in ${file(key)}`);
	return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null });
};

function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text.charAt(i);
		if (quoted) {
			if (c === '"' && text.charAt(i + 1) === '"') {
				cell += '"';
				i++;
			} else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(cell);
			cell = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text.charAt(i + 1) === '\n') i++;
			row.push(cell);
			cell = '';
			if (row.length > 1 || row[0] !== '') rows.push(row);
			row = [];
		} else cell += c;
	}
	if (cell !== '' || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows.slice(1); // header
}

const clean = (v: unknown): string =>
	(typeof v === 'string' || typeof v === 'number' ? String(v) : '').replace(/\s+/g, ' ').trim();
const addTo = (map: Table, key: string, value: string): void => {
	if (!map[key]) map[key] = [];
	if (!map[key].includes(value)) map[key].push(value);
};
const sorted = (map: Table): Table => Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]));

// 1. SBI 2025 structure (levels 1-4 = sections, divisions, groups, classes; first four levels equal NACE Rev. 2.1).
const sbi25: Record<string, { level: number; section: string; nl: string; en: string }> = {};
for (const r of sheetRows('sbiStructure', 'Structuur SBI2025 versie 2026').slice(1)) {
	const level = Number(r[0]);
	const code = clean(r[2]);
	if (!code || level > 4) continue;
	sbi25[code] = { level, section: clean(r[3]), nl: clean(r[4]), en: clean(r[5]) };
}

// 2. SBI 2025 -> SBI 2008 (= NACE Rev. 2 = ISIC Rev. 4 at four digits).
const sbi25ToNace2: Table = {};
const nace2Titles: Record<string, string> = {};
for (const r of sheetRows('sbi25to08', 'SBI2025-SBI2008 v2.0').slice(1)) {
	const from = clean(r[0]).slice(0, 4);
	const to = clean(r[3]).slice(0, 4);
	if (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to)) continue;
	addTo(sbi25ToNace2, from, to);
	// the 5-digit SBI 2008 title is only used when no 4-digit title is known
	nace2Titles[to] ??= clean(r[5]);
}

// 2b. NACE Rev. 2 -> ISIC Rev. 4. A NACE class is either an ISIC class or a subdivision of one
// (for example NACE 58.21 and 58.29 sit inside ISIC 5820), so fall back to the ISIC class of the same group.
const isic4Codes = new Set<string>();
const nace2ToIsic4: Record<string, string> = {};

// 3. ISIC Rev. 4 -> ISIC Rev. 3.1 (UN).
const isic4ToIsic31: Table = {};
for (const r of parseCsv(fs.readFileSync(file('isic4to31'), 'utf8'))) {
	addTo(isic4ToIsic31, clean(r[0]), clean(r[2]));
	isic4Codes.add(clean(r[0]));
}
const unmappedNace2: string[] = [];
const approximated: string[] = [];
for (const nace of new Set(Object.values(sbi25ToNace2).flat())) {
	let isic = [nace, nace.slice(0, 3) + '0'].find((c) => isic4Codes.has(c));
	if (!isic) {
		// No official NACE-ISIC table is used here. NACE classes extend ISIC classes, so take the nearest
		// ISIC class in the same division: the largest code at or below, else the smallest above.
		const division = [...isic4Codes].filter((c) => c.slice(0, 2) === nace.slice(0, 2)).sort();
		isic = [...division].reverse().find((c) => c <= nace) ?? division.find((c) => c > nace);
		if (isic) approximated.push(nace);
	}
	if (isic) nace2ToIsic4[nace] = isic;
	else unmappedNace2.push(nace);
}
console.log(`NACE Rev. 2 -> ISIC Rev. 4: ${Object.keys(nace2ToIsic4).length - approximated.length} exact or same group, ${approximated.length} by nearest code`);
if (unmappedNace2.length) console.warn('NACE Rev. 2 codes without an ISIC Rev. 4 class:', unmappedNace2.join(' '));

// 4. ISIC Rev. 3.1 -> NAICS 2002 US (UN).
const isic31ToNaics: Table = {};
const isic31Titles: Record<string, string> = {};
const naicsTitles: Record<string, string> = {};
for (const r of parseCsv(fs.readFileSync(file('isic31Naics'), 'utf8'))) {
	const isic = clean(r[0]);
	const naics = clean(r[2]);
	if (!isic || !naics) continue;
	addTo(isic31ToNaics, isic, naics);
	isic31Titles[isic] ??= clean(r[1]);
	naicsTitles[naics] ??= clean(r[3]);
}

// 5. NAICS 2002 -> SIC 1987 (US Census).
const naicsToSic: Table = {};
const sicTitles: Record<string, string> = {};
for (const r of sheetRows('sicNaics').slice(1)) {
	if (typeof r[0] !== 'number' || typeof r[2] !== 'number') continue;
	const sic = String(r[0]).padStart(4, '0');
	const naics = String(r[2]);
	addTo(naicsToSic, naics, sic);
	sicTitles[sic] ??= clean(r[1]);
	naicsTitles[naics] ??= clean(r[3]);
}

// 6. SIC -> Damodaran industry, counted over the companies in indname.xls.
const sicToDamodaran: Record<string, Record<string, number>> = {};
let companies = 0;
for (const r of sheetRows('indname', 'By industry').slice(1)) {
	const industry = clean(r[2]);
	const sic = clean(r[4]).padStart(4, '0');
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

// Some company SIC codes are group codes that are not in the Census table (6020 stands for 6021, 6022, 6029).
// Record them as aliases of the real codes in the same three-digit group.
const realSic = Object.keys(sicTitles);
const sicAlias: Table = {};
let aliased = 0;
let unresolved = 0;
for (const [sic, counts] of Object.entries(sicToDamodaran)) {
	if (sicTitles[sic]) continue;
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	const children = realSic.filter((c) => c.slice(0, 3) === sic.slice(0, 3)).sort();
	if (children.length) {
		sicAlias[sic] = children;
		aliased += total;
	} else unresolved += total;
}
console.log(`SIC group codes: ${Object.keys(sicAlias).length} aliased (${aliased} companies), ${unresolved} companies unresolved`);

const out = {
	generated: new Date().toISOString().slice(0, 10),
	companies,
	sbi25,
	sbi25ToNace2: sorted(sbi25ToNace2),
	nace2Titles,
	nace2ToIsic4,
	isic4ToIsic31: sorted(isic4ToIsic31),
	isic31Titles,
	isic31ToNaics: sorted(isic31ToNaics),
	naicsTitles,
	naicsToSic: sorted(naicsToSic),
	sicTitles,
	sicAlias,
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
