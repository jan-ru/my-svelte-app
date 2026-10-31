// src/lib/server/valuation-template.ts
// Reads and writes the private company template as an .xlsx file. The parsing itself is pure (`valuation-template.ts`).
import * as XLSX from 'xlsx';
import { parseTemplateRows, templateRows, type Cell, type TemplateResult } from '../valuation-template';

/** Larger uploads are refused before they are parsed. */
export const MAX_UPLOAD_BYTES = 1_000_000;

export function readTemplate(data: Uint8Array): TemplateResult {
	let rows: Cell[][];
	try {
		const workbook = XLSX.read(data, { type: 'array' });
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		rows = sheet ? XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: null, raw: true }) : [];
	} catch {
		return { ok: false, error: 'That file could not be read as a spreadsheet.' };
	}
	return parseTemplateRows(rows);
}

export function writeTemplate(thisYear: number): Uint8Array<ArrayBuffer> {
	const workbook = XLSX.utils.book_new();
	const sheet = XLSX.utils.aoa_to_sheet(templateRows(thisYear));
	sheet['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
	XLSX.utils.book_append_sheet(workbook, sheet, 'Figures');
	const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
	return new Uint8Array(bytes);
}
