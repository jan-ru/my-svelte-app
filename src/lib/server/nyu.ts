import * as XLSX from 'xlsx';
import { at } from '../at';
import { workbookUrl, type Family } from '../catalog';

const SHEET = 'Industry Averages';
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;

export interface Cell {
	value: number | null;
	firms: number | null;
}

export interface WorkbookRow {
	industry: string;
	firms: number | null;
	/** values[i] is the numeric content of column i (null if blank or NA). */
	values: (number | null)[];
}

export interface WorkbookData {
	/** ISO date (YYYY-MM-DD) from the "Date updated" cell, if present. */
	updated: string | null;
	header: string[];
	/** The header group above each column, '' when there is none. */
	groups: string[];
	rows: WorkbookRow[];
}

export class MissingColumnError extends Error {}

const normalise = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const toNumber = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Some NYU files call the market-wide row "Grand Total" instead of "Total Market". */
const canonicalIndustry = (name: string): string => (name === 'Grand Total' ? 'Total Market' : name);

function serialToIso(serial: number): string {
	return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);
}

export function parseWorkbook(data: Uint8Array): WorkbookData {
	const workbook = XLSX.read(data, { type: 'array' });
	const sheet = workbook.Sheets[SHEET];
	if (!sheet) throw new Error(`Sheet "${SHEET}" not found`);

	const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
	const headerIndex = rows.findIndex((r) => normalise(r[0]) === 'Industry Name');
	if (headerIndex === -1) throw new Error('Header row "Industry Name" not found');

	const dateRow = rows.slice(0, headerIndex).find((r) => normalise(r[0]) === 'Date updated:');
	const serial = dateRow ? toNumber(dateRow[1]) : null;

	const header = at(rows, headerIndex).map(normalise);

	// A group row sits directly above the header: first cell empty, some text further right.
	const above = rows[headerIndex - 1] ?? null;
	const hasGroups =
		above !== null &&
		above[0] == null &&
		above.some((c) => typeof c === 'string' && c.trim() !== '');
	let current = '';
	const groups = header.map((_, i) => {
		if (hasGroups) {
			const label = normalise(above[i]);
			if (label) current = label;
		}
		return current;
	});

	const dataRows: WorkbookRow[] = [];
	for (const r of rows.slice(headerIndex + 1)) {
		const industry = canonicalIndustry(normalise(r[0]));
		if (!industry) continue;
		dataRows.push({ industry, firms: toNumber(r[1]), values: header.map((_, i) => toNumber(r[i])) });
	}

	return { updated: serial === null ? null : serialToIso(serial), header, groups, rows: dataRows };
}

/** One column of the workbook as industry -> cell. Throws MissingColumnError if absent. */
export function pickColumn(wb: WorkbookData, column: string, group?: string): Map<string, Cell> {
	const wanted = normalise(column);
	const wantedGroup = group === undefined ? undefined : normalise(group);
	const index = wb.header.findIndex(
		(h, i) => i >= 2 && h === wanted && (wantedGroup === undefined || wb.groups[i] === wantedGroup)
	);
	if (index === -1) {
		throw new MissingColumnError(`Column "${column}"${group ? ` in group "${group}"` : ''} not found`);
	}
	return new Map(wb.rows.map((r) => [r.industry, { value: r.values[index] ?? null, firms: r.firms }]));
}

export async function fetchWorkbook(
	family: Family,
	regionId: string,
	fetchFn: typeof fetch = fetch
): Promise<WorkbookData> {
	const url = workbookUrl(family, regionId);
	const response = await fetchFn(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!response.ok) throw new Error(`NYU returned ${response.status} for ${url}`);
	const declared = Number(response.headers.get('content-length'));
	if (declared > MAX_WORKBOOK_BYTES) throw new Error(`NYU file too large (${declared} bytes): ${url}`);
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.byteLength > MAX_WORKBOOK_BYTES) throw new Error(`NYU file too large (${bytes.byteLength} bytes): ${url}`);
	return parseWorkbook(bytes);
}
