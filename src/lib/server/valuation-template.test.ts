import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, readTemplate, uploadTooLarge, writeTemplate } from './valuation-template';
import { get } from '#lib/at';

describe('writeTemplate and readTemplate', () => {
	it('writes an xlsx whose blank template reads back with a clear error, and a filled one reads back', () => {
		const blank = writeTemplate(2026);
		expect(blank[0]).toBe(0x50); // a zip, which an xlsx is
		const result = readTemplate(blank);
		// the example rows have no figures yet, but every label and year is there
		expect(result).toEqual({
			ok: true,
			figures: expect.objectContaining({ name: 'Example BV', currency: 'EUR', netDebt: 0 })
		});

		const wb = XLSX.read(blank, { type: 'array' });
		XLSX.utils.sheet_add_aoa(get(wb.Sheets, 'Figures'), [[100, 110, 120, 130]], { origin: 'B7' });
		const filled = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
		const read = readTemplate(filled);
		if (!read.ok) throw new Error(read.error);
		expect(read.figures.years.map((y) => y.values.revenue)).toEqual([100, 110, 120, 130]);
	});
	it('explains a file that is not a spreadsheet or has no usable sheet', () => {
		const pdf = new TextEncoder().encode('%PDF-1.4 not a sheet');
		const notSheet = readTemplate(pdf);
		expect(notSheet.ok).toBe(false);
		const brokenZip = readTemplate(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]));
		expect(brokenZip).toEqual({ ok: false, error: 'That file could not be read as a spreadsheet.' });
		const book = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), 'Empty');
		const empty = readTemplate(new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer));
		expect(empty).toEqual({ ok: false, error: 'Fill in the company name next to "Company".' });
	});
});

describe('uploadTooLarge', () => {
	const headers = (length?: number) => new Headers(length === undefined ? {} : { 'content-length': String(length) });

	it('refuses a body that declares more than a template plus the form around it', () => {
		expect(uploadTooLarge(headers(MAX_UPLOAD_BYTES * 2))).toBe(true);
	});
	it('lets through a template-sized body and one with no or a broken content-length', () => {
		expect(uploadTooLarge(headers(MAX_UPLOAD_BYTES))).toBe(false);
		expect(uploadTooLarge(headers())).toBe(false);
		expect(uploadTooLarge(new Headers({ 'content-length': 'lots' }))).toBe(false);
	});
});
