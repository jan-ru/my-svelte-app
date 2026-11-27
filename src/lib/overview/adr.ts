// src/lib/overview/adr.ts
// The decisions page of the release overview, from the ADRs in docs/adr/. Pure: scripts/build-overview.ts reads the
// files. Imports are relative with .ts because Node runs that script directly (see the plan's Global Constraints).
import { at } from '../at.ts';

/** Where an ADR stands, from the `status:` line of its frontmatter. */
export type AdrStatus = 'Accepted' | 'Proposed' | 'Superseded';

/** One ADR file, as the overview needs it. */
export interface Adr {
	readonly number: number;
	/** `ADR-003` */
	readonly id: string;
	readonly title: string;
	readonly status: AdrStatus;
	/** For a superseded ADR, the one that replaced it. */
	readonly supersededBy?: string;
	readonly date: string;
}

/** The themes of the decisions page, in the order it shows them. */
export const THEME_ORDER = ['Data', 'Pages', 'Access', 'Valuation', 'Code', 'Delivery'] as const;
export type Theme = (typeof THEME_ORDER)[number];

/** The theme of every accepted ADR. A new accepted ADR needs a row here; adr.test.ts fails until it has one. */
export const ADR_THEMES = {
	'ADR-001': 'Data',
	'ADR-002': 'Pages',
	'ADR-003': 'Access',
	'ADR-004': 'Access',
	'ADR-005': 'Data',
	'ADR-006': 'Data',
	'ADR-007': 'Code',
	'ADR-008': 'Valuation',
	'ADR-009': 'Code',
	'ADR-011': 'Delivery',
	'ADR-013': 'Code',
	'ADR-014': 'Access',
	'ADR-015': 'Access'
} as const satisfies Readonly<Record<string, Theme>>;

const THEMES: Readonly<Record<string, Theme>> = ADR_THEMES;

/** The theme of an accepted ADR; throws when ADR_THEMES has none. */
export function themeOf(adr: Adr): Theme {
	const theme = THEMES[adr.id];
	if (theme === undefined) {
		throw new Error(`${adr.id} is accepted but has no theme in ADR_THEMES (src/lib/overview/adr.ts)`);
	}
	return theme;
}

function parseStatus(fileName: string, text: string): Pick<Adr, 'status' | 'supersededBy'> {
	if (text === 'Accepted' || text === 'Proposed') return { status: text };
	const by = /^Superseded by (ADR-\d{3})$/.exec(text);
	if (by) return { status: 'Superseded', supersededBy: at(by, 1) };
	throw new Error(`${fileName}: unknown status "${text}"`);
}

/** Reads an ADR file: its frontmatter (`status`, `date`) and its `# ADR-NNN: Title` heading. */
export function parseAdr(fileName: string, text: string): Adr {
	const fail = (what: string): never => {
		throw new Error(`${fileName}: ${what}`);
	};
	const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? fail('no frontmatter');
	const line = (key: string): string =>
		new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(front)?.[1]?.trim() ?? fail(`no ${key}: in the frontmatter`);
	const heading = /^# ADR-(\d{3}): (.+)$/m.exec(text) ?? fail('no "# ADR-NNN: Title" heading');
	const number = Number(at(heading, 1));
	if (Number(fileName.slice(0, 4)) !== number) fail(`the heading says ADR-${at(heading, 1)}`);
	return {
		number,
		id: `ADR-${at(heading, 1)}`,
		title: at(heading, 2).trim(),
		...parseStatus(fileName, line('status')),
		date: line('date')
	};
}

/** The accepted ADRs of one theme. */
export interface DecisionGroup {
	readonly theme: Theme;
	readonly adrs: readonly Adr[];
}

/** What the decisions page shows. */
export interface DecisionsView {
	readonly total: number;
	readonly accepted: number;
	readonly proposed: readonly Adr[];
	readonly superseded: readonly Adr[];
	readonly groups: readonly DecisionGroup[];
}

/** Counts the ADRs by status and groups the accepted ones by theme, each in number order. */
export function decisionsView(adrs: readonly Adr[]): DecisionsView {
	const sorted = [...adrs].sort((a, b) => a.number - b.number);
	const by = (status: AdrStatus): readonly Adr[] => sorted.filter((a) => a.status === status);
	const accepted = by('Accepted');
	const groups = THEME_ORDER.map((theme) => ({ theme, adrs: accepted.filter((a) => themeOf(a) === theme) })).filter(
		(group) => group.adrs.length > 0
	);
	return {
		total: sorted.length,
		accepted: accepted.length,
		proposed: by('Proposed'),
		superseded: by('Superseded'),
		groups
	};
}
