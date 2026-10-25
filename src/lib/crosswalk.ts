export interface Crosswalk {
	generated: string;
	companies: number;
	sbi25: Record<string, { level: number; section: string; nl: string; en: string }>;
	sbi25ToNace2: Record<string, string[]>;
	nace2Titles: Record<string, string>;
	isic4ToIsic31: Record<string, string[]>;
	isic31Titles: Record<string, string>;
	isic31ToNaics: Record<string, string[]>;
	naicsTitles: Record<string, string>;
	naicsToSic: Record<string, string[]>;
	sicTitles: Record<string, string>;
	/** SIC -> [industry, company count], largest first. */
	damodaran: Record<string, [string, number][]>;
}

export interface Item {
	code: string;
	title: string;
}

export interface Match {
	industry: string;
	companies: number;
	share: number;
}

export interface Trace {
	start: Item;
	/** SBI 2025 classes (4 digits, equal to NACE Rev. 2.1) under the chosen code. */
	nace21: Item[];
	/** NACE Rev. 2 = SBI 2008 = ISIC Rev. 4 classes. Codes only: the sources give no 4-digit titles. */
	nace2: Item[];
	isic31: Item[];
	naics: Item[];
	sic: Item[];
	damodaran: Match[];
}

export const MAX_RESULTS = 20;

const uniq = <T>(values: T[]): T[] => [...new Set(values)];
const sortByCode = (items: Item[]): Item[] => items.sort((a, b) => a.code.localeCompare(b.code));

/** Find SBI 2025 codes by code prefix or by words in the English or Dutch title. */
export function searchSbi(data: Crosswalk, query: string): Item[] {
	const q = query.trim().toLowerCase();
	if (q === '') return [];
	const words = q.split(/\s+/);
	const found: Item[] = [];
	for (const [code, entry] of Object.entries(data.sbi25)) {
		const text = `${entry.en} ${entry.nl}`.toLowerCase();
		if (code.toLowerCase().startsWith(q.replace('.', '')) || words.every((w) => text.includes(w))) {
			found.push({ code, title: entry.en });
		}
	}
	return sortByCode(found).slice(0, MAX_RESULTS);
}

/** Four-digit SBI 2025 classes at or under `code` (a section letter or a 2-4 digit code). */
function classesUnder(data: Crosswalk, code: string): string[] {
	return Object.keys(data.sbi25).filter(
		(c) => c.length === 4 && (data.sbi25[code]?.level === 1 ? data.sbi25[c].section === code : c.startsWith(code))
	);
}

export function trace(data: Crosswalk, code: string): Trace | null {
	const entry = data.sbi25[code];
	if (!entry) return null;

	const classes = classesUnder(data, code);
	const nace2 = uniq(classes.flatMap((c) => data.sbi25ToNace2[c] ?? []));
	const isic31 = uniq(nace2.flatMap((c) => data.isic4ToIsic31[c] ?? []));
	const naics = uniq(isic31.flatMap((c) => data.isic31ToNaics[c] ?? []));
	const sic = uniq(naics.flatMap((c) => data.naicsToSic[c] ?? []));

	const counts = new Map<string, number>();
	for (const s of sic) for (const [industry, n] of data.damodaran[s] ?? []) counts.set(industry, (counts.get(industry) ?? 0) + n);
	const total = [...counts.values()].reduce((a, b) => a + b, 0);
	const damodaran = [...counts]
		.map(([industry, companies]) => ({ industry, companies, share: total === 0 ? 0 : companies / total }))
		.sort((a, b) => b.companies - a.companies || a.industry.localeCompare(b.industry));

	return {
		start: { code, title: entry.en },
		nace21: sortByCode(classes.map((c) => ({ code: c, title: data.sbi25[c].en }))),
		nace2: sortByCode(nace2.map((c) => ({ code: c, title: '' }))),
		isic31: sortByCode(isic31.map((c) => ({ code: c, title: data.isic31Titles[c] ?? '' }))),
		naics: sortByCode(naics.map((c) => ({ code: c, title: data.naicsTitles[c] ?? '' }))),
		sic: sortByCode(sic.map((c) => ({ code: c, title: data.sicTitles[c] ?? '' }))),
		damodaran
	};
}
