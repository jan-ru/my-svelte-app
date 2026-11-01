import { describe, expect, it } from 'vitest';
import companies from './data/companies.json';
import crosswalk from './data/crosswalk.json';

// The generated JSON is typed by the declarations next to it (*.d.json.ts), so check that it really has that shape.
const people = companies;
const xw = crosswalk;

describe('companies.json', () => {
	it('has a plausible number of companies', () => {
		expect(people.companies.length).toBeGreaterThan(40_000);
	});

	it('has well-formed rows with indices that exist', () => {
		for (const [name, ticker, sic, industry, country, region, sector, subGroup] of people.companies) {
			expect(name).not.toBe('');
			expect(typeof ticker).toBe('string');
			expect(sic).toMatch(/^(\d{4})?$/);
			expect(people.industries[industry]).toBeDefined();
			expect(people.countries[country]).toBeDefined();
			expect(people.groups[region]).toBeDefined();
			expect(people.sectors[sector]).toBeDefined();
			expect(people.subGroups[subGroup]).toBeDefined();
		}
	});

	it('has no duplicate dictionary entries', () => {
		for (const list of [people.industries, people.countries, people.groups, people.sectors, people.subGroups]) {
			expect(new Set(list).size).toBe(list.length);
		}
	});
});

describe('crosswalk.json', () => {
	it('has every table filled in', () => {
		for (const table of [
			xw.sbi25, xw.sbi25ToNace2, xw.nace2ToIsic4, xw.isic4ToIsic31,
			xw.isic31ToNaics, xw.naicsToSic, xw.sicTitles, xw.damodaran
		]) {
			expect(Object.keys(table).length).toBeGreaterThan(50);
		}
	});

	it('links every SBI class to NACE codes', () => {
		for (const code of Object.keys(xw.sbi25ToNace2)) {
			expect(xw.sbi25[code], code).toBeDefined();
			expect(xw.sbi25ToNace2[code]?.length).toBeGreaterThan(0);
		}
	});

	it('lists real industries with positive company counts', () => {
		for (const list of Object.values(xw.damodaran)) {
			for (const [industry, count] of list) {
				expect(industry).not.toBe('');
				expect(count).toBeGreaterThan(0);
			}
		}
	});

	it('uses the same industries as the company list', () => {
		const known = new Set(people.industries);
		for (const list of Object.values(xw.damodaran)) {
			for (const [industry] of list) expect(known.has(industry), industry).toBe(true);
		}
	});
});
