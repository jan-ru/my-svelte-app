import { describe, expect, it } from 'vitest';
import { MAX_WORKBOOK_BYTES, MissingColumnError, fetchWorkbook, parseWorkbook, pickColumn } from './nyu';
import { makeWorkbook } from './testing/make-workbook';

const PE_HEADER = ['Industry Name', 'Number of firms', 'Current PE', 'Trailing PE', 'Forward PE'];
const PE_ROWS = [
	['Advertising', 52, 132.2, 44.4, 52.9],
	['Steel', 30, 'NA', 10, null],
	['Grand Total', 5994, 72, 57, 27]
];

const GROUP_ROW = [null, null, 'Only positive EBITDA firms', null, 'All firms', null];
const EBITDA_HEADER = ['Industry Name', 'Number of firms', 'EV/EBITDA', 'EV/EBIT', 'EV/EBITDA', 'EV/EBIT'];
const EBITDA_ROWS = [
	['Advertising', 52, 12, 20, 15, 21],
	['Steel', 30, 'NA', 'NA', 'NA', 'NA']
];

describe('parseWorkbook', () => {
	it('reads industries, firm counts and numeric values', () => {
		const wb = parseWorkbook(makeWorkbook({ header: PE_HEADER, rows: PE_ROWS }));
		expect(wb.rows[0]).toEqual({
			industry: 'Advertising',
			firms: 52,
			values: [null, 52, 132.2, 44.4, 52.9]
		});
	});

	it('turns NA and blank cells into null', () => {
		const wb = parseWorkbook(makeWorkbook({ header: PE_HEADER, rows: PE_ROWS }));
		expect(wb.rows[1]?.values).toEqual([null, 30, null, 10, null]);
	});

	it('aliases Grand Total to Total Market', () => {
		const wb = parseWorkbook(makeWorkbook({ header: PE_HEADER, rows: PE_ROWS }));
		expect(wb.rows.map((r) => r.industry)).toEqual(['Advertising', 'Steel', 'Total Market']);
	});

	it('converts the Excel date serial to an ISO date', () => {
		const wb = parseWorkbook(makeWorkbook({ header: PE_HEADER, rows: PE_ROWS }));
		expect(wb.updated).toBe('2026-01-05');
	});

	it('finds the header row wherever it is', () => {
		const plain = parseWorkbook(makeWorkbook({ header: PE_HEADER, rows: PE_ROWS }));
		const padded = parseWorkbook(makeWorkbook({ header: PE_HEADER, rows: PE_ROWS, padRows: 3 }));
		expect(padded.rows).toEqual(plain.rows);
	});

	it('has no groups for a single-level header', () => {
		const wb = parseWorkbook(makeWorkbook({ header: PE_HEADER, rows: PE_ROWS }));
		expect(wb.groups.every((g) => g === '')).toBe(true);
	});

	it('carries each header group across the columns it spans', () => {
		const wb = parseWorkbook(
			makeWorkbook({ groupRow: GROUP_ROW, header: EBITDA_HEADER, rows: EBITDA_ROWS })
		);
		expect(wb.groups).toEqual([
			'',
			'',
			'Only positive EBITDA firms',
			'Only positive EBITDA firms',
			'All firms',
			'All firms'
		]);
	});

	it('throws when the data sheet is missing', () => {
		const data = makeWorkbook({ header: PE_HEADER, rows: PE_ROWS, sheetName: 'Other' });
		expect(() => parseWorkbook(data)).toThrow(/Industry Averages/);
	});

	it('throws when the header row is missing', () => {
		const data = makeWorkbook({ header: ['Name', 'Firms'], rows: [['x', 1]] });
		expect(() => parseWorkbook(data)).toThrow(/Industry Name/);
	});
});

describe('pickColumn', () => {
	const grouped = () =>
		parseWorkbook(makeWorkbook({ groupRow: GROUP_ROW, header: EBITDA_HEADER, rows: EBITDA_ROWS }));

	it('uses the requested group', () => {
		expect(pickColumn(grouped(), 'EV/EBITDA', 'Only positive EBITDA firms').get('Advertising')).toEqual({
			value: 12,
			firms: 52
		});
		expect(pickColumn(grouped(), 'EV/EBITDA', 'All firms').get('Advertising')).toEqual({
			value: 15,
			firms: 52
		});
	});

	it('takes the first match when no group is given', () => {
		expect(pickColumn(grouped(), 'EV/EBITDA').get('Advertising')?.value).toBe(12);
	});

	it('keeps the firm count when the value is NA', () => {
		expect(pickColumn(grouped(), 'EV/EBIT', 'All firms').get('Steel')).toEqual({
			value: null,
			firms: 30
		});
	});

	it('ignores spacing differences in header text', () => {
		const wb = parseWorkbook(
			makeWorkbook({
				header: ['Industry Name', 'Number of firms', 'EV/  Invested   Capital'],
				rows: [['Advertising', 52, 4.6]]
			})
		);
		expect(pickColumn(wb, 'EV/ Invested Capital').get('Advertising')?.value).toBe(4.6);
	});

	it('throws MissingColumnError naming the column', () => {
		const wb = grouped();
		expect(() => pickColumn(wb, 'Nope')).toThrow(MissingColumnError);
		expect(() => pickColumn(wb, 'Nope')).toThrow(/Nope/);
	});
});

describe('fetchWorkbook', () => {
	const bytes = makeWorkbook({ header: PE_HEADER, rows: PE_ROWS });

	it('downloads and parses the right file', async () => {
		const seen: string[] = [];
		const fakeFetch = (async (url: string | URL | Request) => {
			seen.push(String(url));
			return new Response(bytes, { status: 200 });
		}) as typeof fetch;

		const wb = await fetchWorkbook('pe', 'europe', fakeFetch);
		expect(seen).toEqual(['https://pages.stern.nyu.edu/~adamodar/pc/datasets/peEurope.xls']);
		expect(wb.rows).toHaveLength(3);
	});

	it('rejects on a non-200 response and says which status', async () => {
		const fakeFetch = (async () => new Response('nope', { status: 404 })) as typeof fetch;
		await expect(fetchWorkbook('pe', 'us', fakeFetch)).rejects.toThrow(/404/);
	});

	it('rejects a file whose declared size is over the limit', async () => {
		const fakeFetch = (async () =>
			new Response(bytes, {
				status: 200,
				headers: { 'content-length': String(MAX_WORKBOOK_BYTES + 1) }
			})) as typeof fetch;
		await expect(fetchWorkbook('pe', 'us', fakeFetch)).rejects.toThrow(/too large/);
	});

	it('rejects a body over the limit even without a content-length header', async () => {
		const big = new Uint8Array(MAX_WORKBOOK_BYTES + 1);
		const fakeFetch = (async () => new Response(big, { status: 200 })) as typeof fetch;
		await expect(fetchWorkbook('pe', 'us', fakeFetch)).rejects.toThrow(/too large/);
	});
});
