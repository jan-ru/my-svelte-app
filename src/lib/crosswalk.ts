import { get } from './at';

export interface Crosswalk {
	readonly generated: string;
	readonly companies: number;
	readonly sbi25: Readonly<Record<string, { level: number; section: string; nl: string; en: string }>>;
	readonly sbi25ToNace2: Readonly<Record<string, readonly string[]>>;
	readonly nace2Titles: Readonly<Record<string, string>>;
	readonly nace2ToIsic4: Readonly<Record<string, string>>;
	readonly isic4ToIsic31: Readonly<Record<string, readonly string[]>>;
	readonly isic31Titles: Readonly<Record<string, string>>;
	readonly isic31ToNaics: Readonly<Record<string, readonly string[]>>;
	readonly naicsTitles: Readonly<Record<string, string>>;
	readonly naicsToSic: Readonly<Record<string, readonly string[]>>;
	readonly sicTitles: Readonly<Record<string, string>>;
	/** Company SIC codes that are group codes (6020), mapped to the real SIC codes of the group. */
	readonly sicAlias: Readonly<Record<string, readonly string[]>>;
	/** SIC -> [industry, company count], largest first. */
	readonly damodaran: Readonly<Record<string, readonly (readonly [string, number])[]>>;
}

export interface Item {
	readonly code: string;
	readonly title: string;
}

export interface Match {
	readonly industry: string;
	readonly companies: number;
	readonly share: number;
}

export interface Trace {
	readonly start: Item;
	/** SBI 2025 classes (4 digits, equal to NACE Rev. 2.1) under the chosen code. */
	readonly nace21: readonly Item[];
	/** NACE Rev. 2 = SBI 2008 = ISIC Rev. 4 classes. Codes only: the sources give no 4-digit titles. */
	readonly nace2: readonly Item[];
	/** ISIC Rev. 4 classes; a NACE class is an ISIC class or a subdivision of one. */
	readonly isic4: readonly Item[];
	readonly isic31: readonly Item[];
	readonly naics: readonly Item[];
	readonly sic: readonly Item[];
	readonly damodaran: readonly Match[];
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
		(c) => c.length === 4 && (data.sbi25[code]?.level === 1 ? data.sbi25[c]?.section === code : c.startsWith(code))
	);
}

export function trace(data: Crosswalk, code: string): Trace | null {
	const entry = data.sbi25[code];
	if (!entry) return null;

	const classes = classesUnder(data, code);
	const nace2 = uniq(classes.flatMap((c) => data.sbi25ToNace2[c] ?? []));
	const isic4 = uniq(nace2.flatMap((c) => (data.nace2ToIsic4[c] ? [data.nace2ToIsic4[c]] : [])));
	const isic31 = uniq(isic4.flatMap((c) => data.isic4ToIsic31[c] ?? []));
	const naics = uniq(isic31.flatMap((c) => data.isic31ToNaics[c] ?? []));
	const sic = uniq(naics.flatMap((c) => data.naicsToSic[c] ?? []));

	const counts = new Map<string, number>();
	const add = (industry: string, n: number) => counts.set(industry, (counts.get(industry) ?? 0) + n);
	for (const s of sic) for (const [industry, n] of data.damodaran[s] ?? []) add(industry, n);
	// a group code such as 6020 counts for the real codes it stands for, split evenly
	for (const [alias, children] of Object.entries(data.sicAlias)) {
		const hit = children.filter((c) => sic.includes(c));
		if (hit.length > 0) for (const [industry, n] of data.damodaran[alias] ?? []) add(industry, (n * hit.length) / children.length);
	}
	const total = [...counts.values()].reduce((a, b) => a + b, 0);
	const damodaran = [...counts]
		.map(([industry, companies]) => ({ industry, companies, share: total === 0 ? 0 : companies / total }))
		.sort((a, b) => b.companies - a.companies || a.industry.localeCompare(b.industry));

	return {
		start: { code, title: entry.en },
		nace21: sortByCode(classes.map((c) => ({ code: c, title: get(data.sbi25, c).en }))),
		nace2: sortByCode(nace2.map((c) => ({ code: c, title: '' }))),
		isic4: sortByCode(isic4.map((c) => ({ code: c, title: '' }))),
		isic31: sortByCode(isic31.map((c) => ({ code: c, title: data.isic31Titles[c] ?? '' }))),
		naics: sortByCode(naics.map((c) => ({ code: c, title: data.naicsTitles[c] ?? '' }))),
		sic: sortByCode(sic.map((c) => ({ code: c, title: data.sicTitles[c] ?? '' }))),
		damodaran
	};
}

export interface Ranked extends Item {
	/** Share of the weight that reached an SBI class, splitting evenly at every one-to-many hop. Adds up to 1. */
	readonly share: number;
}

export interface ReverseTrace {
	readonly industry: string;
	readonly companies: number;
	/** Fraction of the industry's companies whose SIC code could be followed all the way to an SBI 2025 class. */
	readonly followed: number;
	readonly sic: readonly (Item & { readonly companies: number })[];
	/** SBI 2025 classes (4 digits), best match first. */
	readonly sbi25: readonly Ranked[];
}

export const MAX_REVERSE = 25;

type Inverse = Record<string, string[]>;
interface Inverses {
	readonly sicToNaics: Inverse;
	readonly naicsToIsic31: Inverse;
	readonly isic31ToIsic4: Inverse;
	readonly isic4ToNace2: Inverse;
	readonly nace2ToSbi25: Inverse;
}

const inverseCache = new WeakMap<Crosswalk, Inverses>();

function invert(map: Readonly<Record<string, readonly string[]>>): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const [from, tos] of Object.entries(map)) for (const to of tos) (out[to] ??= []).push(from);
	return out;
}

function inverses(data: Crosswalk): Inverses {
	let inv = inverseCache.get(data);
	if (!inv) {
		inv = {
			sicToNaics: invert(data.naicsToSic),
			naicsToIsic31: invert(data.isic31ToNaics),
			isic31ToIsic4: invert(data.isic4ToIsic31),
			isic4ToNace2: invert(Object.fromEntries(Object.entries(data.nace2ToIsic4).map(([n, i]) => [n, [i]]))),
			nace2ToSbi25: invert(data.sbi25ToNace2)
		};
		inverseCache.set(data, inv);
	}
	return inv;
}

/** Move weight one hop, splitting each node's weight evenly over its targets. Nodes with no target drop out. */
function hop(weights: Map<string, number>, next: Readonly<Inverse>): Map<string, number> {
	const out = new Map<string, number>();
	for (const [node, w] of weights) {
		const targets = next[node] ?? [];
		for (const t of targets) out.set(t, (out.get(t) ?? 0) + w / targets.length);
	}
	return out;
}

export function industries(data: Crosswalk): string[] {
	const names = new Set<string>();
	for (const list of Object.values(data.damodaran)) for (const [name] of list) names.add(name);
	return [...names].sort((a, b) => a.localeCompare(b));
}

/** From a Damodaran industry back to SBI 2025 classes, weighting by where its companies sit. */
export function reverseTrace(data: Crosswalk, industry: string): ReverseTrace | null {
	const sicCounts = new Map<string, number>();
	for (const [sic, list] of Object.entries(data.damodaran)) {
		for (const [name, n] of list) if (name === industry) sicCounts.set(sic, n);
	}
	const companies = [...sicCounts.values()].reduce((a, b) => a + b, 0);
	if (companies === 0) return null;

	const inv = inverses(data);
	let weights = new Map<string, number>();
	for (const [sic, n] of sicCounts) {
		const real = data.sicAlias[sic] ?? [sic];
		for (const r of real) weights.set(r, (weights.get(r) ?? 0) + n / companies / real.length);
	}
	weights = hop(weights, inv.sicToNaics);
	weights = hop(weights, inv.naicsToIsic31);
	weights = hop(weights, inv.isic31ToIsic4);
	weights = hop(weights, inv.isic4ToNace2);
	weights = hop(weights, inv.nace2ToSbi25);

	const reached = [...weights].flatMap(([code, w]) => {
		const entry = data.sbi25[code];
		return entry ? [{ code, title: entry.en, w }] : [];
	});
	const followed = reached.reduce((sum, { w }) => sum + w, 0);
	const sbi25 = reached
		.map(({ code, title, w }) => ({ code, title, share: w / followed }))
		.sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));

	return {
		industry,
		companies,
		followed,
		sic: [...sicCounts]
			.map(([code, n]) => ({ code, title: data.sicTitles[code] ?? (data.sicAlias[code] ? `group code for ${data.sicAlias[code].join(', ')}` : ''), companies: n }))
			.sort((a, b) => b.companies - a.companies || a.code.localeCompare(b.code)),
		sbi25
	};
}
