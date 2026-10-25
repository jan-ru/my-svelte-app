import * as XLSX from 'xlsx';

export interface FixtureOptions {
	/** Column titles; the first must be 'Industry Name' for a valid file. */
	header: string[];
	rows: (string | number | null)[][];
	/** Optional header group row printed directly above the header. */
	groupRow?: (string | null)[];
	/** Blank rows between the metadata block and the header. */
	padRows?: number;
	/** Excel date serial for the "Date updated" cell. Defaults to 2026-01-05. */
	updatedSerial?: number;
	/** Name of the data sheet. Defaults to 'Industry Averages'. */
	sheetName?: string;
}

/** Build a small legacy .xls workbook shaped like the NYU files. */
export function makeWorkbook(o: FixtureOptions): Uint8Array<ArrayBuffer> {
	const meta: (string | number | null)[][] = [
		['Date updated:', o.updatedSerial ?? 46027],
		['Created by:', 'test'],
		['What is this data?', 'fixture'],
		['Variable definitions:', 'https://example.test']
	];
	const pad = Array.from({ length: o.padRows ?? 0 }, () => [null]);
	const aoa = [...meta, ...pad, ...(o.groupRow ? [o.groupRow] : []), o.header, ...o.rows];

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Variables']]), 'Variables & FAQ');
	XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), o.sheetName ?? 'Industry Averages');
	return new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Uint8Array);
}
