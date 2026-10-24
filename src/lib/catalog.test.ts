import { describe, expect, it } from 'vitest';
import {
	MAX_SELECTION,
	MULTIPLES,
	REGIONS,
	multipleById,
	regionById,
	workbookName,
	workbookUrl,
	type Family
} from './catalog';

describe('catalog', () => {
	it('limits every dimension to 4', () => {
		expect(MAX_SELECTION).toBe(4);
	});

	it('defines 9 multiples and 8 regions with unique ids', () => {
		expect(MULTIPLES).toHaveLength(9);
		expect(REGIONS).toHaveLength(8);
		expect(new Set(MULTIPLES.map((m) => m.id)).size).toBe(9);
		expect(new Set(REGIONS.map((r) => r.id)).size).toBe(8);
	});

	it('names the US workbooks specially', () => {
		expect(workbookName('vebitda', 'us')).toBe('vebitda');
		expect(workbookName('pe', 'us')).toBe('pedata');
		expect(workbookName('pbv', 'us')).toBe('pbvdata');
		expect(workbookName('ps', 'us')).toBe('psdata');
	});

	it('names regional workbooks as family plus suffix', () => {
		expect(workbookName('pe', 'europe')).toBe('peEurope');
		expect(workbookName('pbv', 'global')).toBe('pbvGlobal');
		expect(workbookName('vebitda', 'emerging')).toBe('vebitdaemerg');
		expect(workbookName('ps', 'anz-canada')).toBe('psRest');
	});

	it('produces 32 distinct workbook names', () => {
		const families: Family[] = ['vebitda', 'pe', 'pbv', 'ps'];
		const names = families.flatMap((f) => REGIONS.map((r) => workbookName(f, r.id)));
		expect(new Set(names).size).toBe(32);
	});

	it('rejects an unknown region', () => {
		expect(() => workbookName('pe', 'mars')).toThrow(/mars/);
	});

	it('builds the NYU URL', () => {
		expect(workbookUrl('pe', 'europe')).toBe(
			'https://pages.stern.nyu.edu/~adamodar/pc/datasets/peEurope.xls'
		);
	});

	it('looks items up by id', () => {
		expect(multipleById('pe_trailing')?.label).toBe('P/E (trailing)');
		expect(regionById('anz-canada')?.label).toBe('Australia, NZ and Canada');
		expect(multipleById('nope')).toBeUndefined();
	});
});
