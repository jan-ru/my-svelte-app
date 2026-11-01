import { MULTIPLES, type Family } from '../catalog';
import type { Selection } from '../params';
import { createCache } from './cache';
import { MissingColumnError, fetchWorkbook, pickColumn, type Cell, type WorkbookData } from './nyu';

export interface Comparison {
	/** Most recent "Date updated" among the workbooks used. */
	updated: string | null;
	/** cells[multipleId][regionId][industry] */
	cells: Record<string, Record<string, Record<string, Cell>>>;
	/** errors['<multipleId>:<regionId>'] = message. Those pairs have no entry in `cells`. */
	errors: Record<string, string>;
}

export type WorkbookLoader = (family: Family, regionId: string) => Promise<WorkbookData>;

const cache = createCache<WorkbookData>({ ttlMs: 24 * 60 * 60 * 1000 });

export const loadWorkbook: WorkbookLoader = (family, regionId) =>
	cache.get(`${family}:${regionId}`, () => fetchWorkbook(family, regionId));

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function getComparison(
	selection: Selection,
	load: WorkbookLoader = loadWorkbook
): Promise<Comparison> {
	const multiples = MULTIPLES.filter((m) => selection.multiples.includes(m.id));

	const wanted = new Map<string, { family: Family; regionId: string }>();
	for (const m of multiples) {
		for (const regionId of selection.regions) {
			wanted.set(`${m.family}:${regionId}`, { family: m.family, regionId });
		}
	}

	const loaded = new Map<string, WorkbookData | Error>();
	await Promise.all(
		[...wanted].map(async ([key, { family, regionId }]) => {
			try {
				loaded.set(key, await load(family, regionId));
			} catch (error) {
				console.error(`could not load NYU workbook ${key}`, error);
				loaded.set(key, error instanceof Error ? error : new Error(String(error)));
			}
		})
	);

	const comparison: Comparison = { updated: null, cells: {}, errors: {} };

	for (const m of multiples) {
		const byRegion: Record<string, Record<string, Cell>> = {};
		comparison.cells[m.id] = byRegion;
		for (const regionId of selection.regions) {
			const workbook = loaded.get(`${m.family}:${regionId}`);
			const errorKey = `${m.id}:${regionId}`;

			if (workbook instanceof Error || workbook === undefined) {
				comparison.errors[errorKey] = `Data unavailable: ${workbook ? messageOf(workbook) : 'not loaded'}`;
				continue;
			}

			try {
				const column = pickColumn(workbook, m.column, m.group);
				byRegion[regionId] = Object.fromEntries(
					selection.industries.map((name) => [name, column.get(name) ?? { value: null, firms: null }])
				);
				if (workbook.updated && (!comparison.updated || workbook.updated > comparison.updated)) {
					comparison.updated = workbook.updated;
				}
			} catch (error) {
				if (!(error instanceof MissingColumnError)) throw error;
				comparison.errors[errorKey] = `Data unavailable: ${error.message}`;
			}
		}
	}

	return comparison;
}

/** Industry names, taken from the US P/E workbook (all workbooks share the same names). */
export async function getIndustries(load: WorkbookLoader = loadWorkbook): Promise<string[]> {
	const workbook = await load('pe', 'us');
	return workbook.rows.map((r) => r.industry);
}
