import { describe, expect, it } from 'vitest';
import { MULTIPLES, REGIONS, type Family } from '../catalog';
import { DEFAULT_SELECTION } from '../params';
import { fetchWorkbook, pickColumn, type WorkbookData } from './nyu';

// Fetches the real NYU files. Run with `npm run check:data`, e.g. each January.
const books = new Map<string, Promise<WorkbookData>>();
function load(family: Family, regionId: string): Promise<WorkbookData> {
	const key = `${family}:${regionId}`;
	const book = books.get(key) ?? fetchWorkbook(family, regionId);
	books.set(key, book);
	return book;
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

	it('default industries exist in the US pe column', async () => {
		const pe = MULTIPLES.find((m) => m.id === 'pe_trailing')!;
		const column = pickColumn(await load(pe.family, 'us'), pe.column, pe.group);
		for (const name of DEFAULT_SELECTION.industries) {
			expect(column.has(name), name).toBe(true);
		}
	});
});
