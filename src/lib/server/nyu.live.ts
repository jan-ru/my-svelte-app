import { describe, expect, it } from 'vitest';
import { MULTIPLES, REGIONS, type Family } from '../catalog';
import { fetchWorkbook, pickColumn, type WorkbookData } from './nyu';

// Fetches the real NYU files. Run with `npm run check:data`, e.g. each January.
const books = new Map<string, Promise<WorkbookData>>();
function load(family: Family, regionId: string): Promise<WorkbookData> {
	const key = `${family}:${regionId}`;
	if (!books.has(key)) books.set(key, fetchWorkbook(family, regionId));
	return books.get(key)!;
}

describe('live NYU data', () => {
	for (const region of REGIONS) {
		for (const multiple of MULTIPLES) {
			it(`${multiple.id} resolves for ${region.id}`, async () => {
				const workbook = await load(multiple.family, region.id);
				const column = pickColumn(workbook, multiple.column, multiple.group);
				const numeric = [...column.values()].filter((c) => c.value !== null).length;
				expect(numeric).toBeGreaterThanOrEqual(20);
				expect(column.has('Total Market')).toBe(true);
			});
		}
	}
});
