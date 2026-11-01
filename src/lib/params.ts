import { at } from './at';
import { MAX_SELECTION, MULTIPLES, REGIONS, type Role } from './catalog';

export interface Selection {
	multiples: string[];
	regions: string[];
	industries: string[];
}

export interface Layout {
	panels: Role;
	x: Role;
	color: Role;
}

export interface ViewParams {
	selection: Selection;
	layout: Layout;
}

export const DEFAULT_SELECTION: Selection = {
	multiples: ['ev_ebitda', 'pe_trailing'],
	regions: ['us', 'europe'],
	industries: ['Software (System & Application)', 'Retail (General)', 'Total Market']
};

export const DEFAULT_LAYOUT: Layout = { panels: 'multiples', x: 'industries', color: 'regions' };

const ROLES: readonly Role[] = ['multiples', 'regions', 'industries'];
const isRole = (value: string | null): value is Role => ROLES.some((r) => r === value);
const MULTIPLE_IDS = new Set(MULTIPLES.map((m) => m.id));
const REGION_IDS = new Set(REGIONS.map((r) => r.id));
const MAX_NAME_LENGTH = 100;

function readList(
	sp: URLSearchParams,
	key: string,
	isValid: (value: string) => boolean,
	fallback: readonly string[]
): string[] {
	if (!sp.has(key)) return [...fallback];
	const raw = sp.getAll(key).filter((v) => v !== '');
	const kept = [...new Set(raw)].filter(isValid);
	if (kept.length === 0 && raw.length > 0) return [...fallback];
	return kept.slice(0, MAX_SELECTION);
}

function readLayout(sp: URLSearchParams): Layout {
	const asked = [sp.get('p'), sp.get('x'), sp.get('c')];
	const dims = [DEFAULT_LAYOUT.panels, DEFAULT_LAYOUT.x, DEFAULT_LAYOUT.color];
	const used = new Set<Role>();
	const slots = asked.map((r) => {
		if (isRole(r) && !used.has(r)) {
			used.add(r);
			return r;
		}
		return null;
	});
	const leftover = dims.filter((d) => !used.has(d));
	let free = 0;
	const fill = (slot: Role | null | undefined): Role => slot ?? at(leftover, free++);
	return { panels: fill(slots[0]), x: fill(slots[1]), color: fill(slots[2]) };
}

export function parseParams(sp: URLSearchParams, knownIndustries?: readonly string[]): ViewParams {
	const known = knownIndustries && new Set(knownIndustries);
	return {
		selection: {
			multiples: readList(sp, 'm', (v) => MULTIPLE_IDS.has(v), DEFAULT_SELECTION.multiples),
			regions: readList(sp, 'r', (v) => REGION_IDS.has(v), DEFAULT_SELECTION.regions),
			industries: readList(sp, 'i', (v) => v.length <= MAX_NAME_LENGTH && (!known || known.has(v)), DEFAULT_SELECTION.industries)
		},
		layout: readLayout(sp)
	};
}

export function toSearchParams({ selection, layout }: ViewParams): URLSearchParams {
	const sp = new URLSearchParams();
	const write = (key: string, values: string[]) => {
		if (values.length === 0) sp.append(key, '');
		for (const v of values) sp.append(key, v);
	};
	write('m', selection.multiples);
	write('r', selection.regions);
	write('i', selection.industries);
	sp.set('p', layout.panels);
	sp.set('x', layout.x);
	sp.set('c', layout.color);
	return sp;
}

/** Assign `dim` to `key`; whichever role had `dim` takes over the old value. */
export function applyRole(layout: Layout, key: keyof Layout, dim: Role): Layout {
	const next: Layout = { ...layout, [key]: dim };
	const other = (Object.keys(layout) as (keyof Layout)[]).find(
		(k) => k !== key && layout[k] === dim
	);
	if (other) next[other] = layout[key];
	return next;
}
