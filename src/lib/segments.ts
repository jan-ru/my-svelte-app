import { DETAILS, PERIODS, navHref, type Nav, type Period } from './financials-nav';
import { periodAvailable, sourceLabel, type Source, type SOURCES } from './source';

/** One option of a segmented control. A null `href` is an option that cannot be chosen; `title` says why. */
export interface Segment {
	readonly label: string;
	readonly href: string | null;
	readonly current: boolean;
	readonly title?: string;
}

/** Annual or trailing twelve months; a period the source cannot serve is disabled, with the reason. */
export function periodSegments(nav: Nav, period: Period, source: Source, symbol: string): readonly Segment[] {
	return PERIODS.map((p): Segment =>
		periodAvailable(source, p.id)
			? { label: p.label, href: navHref({ ...nav, period: p.id }, symbol), current: period === p.id }
			: {
					label: p.label,
					href: null,
					current: false,
					title: `Trailing twelve months is not available from ${sourceLabel(source)}. Choose Yahoo.`
				}
	);
}

/** The sources offered for the ticker, each keeping the page state. */
export function sourceSegments(
	offered: readonly (typeof SOURCES)[number][],
	nav: Nav,
	period: Period,
	source: Source,
	symbol: string
): readonly Segment[] {
	return offered.map((s) => ({
		label: s.label,
		href: navHref({ ...nav, period, source: s.id }, symbol),
		current: source === s.id
	}));
}

/** Condensed or full balance sheet; unset means condensed. */
export function detailSegments(nav: Nav, symbol: string): readonly Segment[] {
	const current = nav.detail ?? 'condensed';
	return DETAILS.map((d) => ({
		label: d.label,
		href: navHref({ ...nav, detail: d.id }, symbol),
		current: current === d.id
	}));
}
