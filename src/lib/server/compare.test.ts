import { describe, expect, it, vi } from 'vitest';
import type { Selection } from '../params';
import { getComparison, getIndustries, type WorkbookLoader } from './compare';
import type { WorkbookData } from './nyu';

function book(
	header: string[],
	rows: [string, number | null, ...(number | null)[]][],
	groups?: string[],
	updated = '2026-01-05'
): WorkbookData {
	return {
		updated,
		header,
		groups: groups ?? header.map(() => ''),
		rows: rows.map(([industry, firms, ...values]) => ({
			industry,
			firms,
			values: [null, firms, ...values]
		}))
	};
}

const peBook = book(
	['Industry Name', 'Number of firms', 'Current PE', 'Trailing PE', 'Forward PE'],
	[
		['Software', 100, 30, 25, 20],
		['Steel', 20, 12, 10, 9]
	]
);

const ebitdaBook = book(
	['Industry Name', 'Number of firms', 'EV/EBITDA', 'EV/EBIT'],
	[
		['Software', 100, 18, 25],
		['Steel', 20, 6, 9]
	],
	['', '', 'Only positive EBITDA firms', 'Only positive EBITDA firms']
);

const loader = (): WorkbookLoader => vi.fn(async (family) => (family === 'pe' ? peBook : ebitdaBook));

const select = (over: Partial<Selection>): Selection => ({
	multiples: ['pe_trailing'],
	regions: ['us'],
	industries: ['Software', 'Steel'],
	...over
});

describe('getComparison', () => {
	it('maps each multiple, region and industry to a cell', async () => {
		const result = await getComparison(select({ multiples: ['pe_trailing', 'ev_ebitda'] }), loader());
		expect(result.cells.pe_trailing?.us?.Software).toEqual({ value: 25, firms: 100 });
		expect(result.cells.ev_ebitda?.us?.Steel).toEqual({ value: 6, firms: 20 });
		expect(result.updated).toBe('2026-01-05');
		expect(result.errors).toEqual({});
	});

	it('loads each family and region only once', async () => {
		const load = loader();
		await getComparison(
			select({
				multiples: ['pe_trailing', 'pe_forward', 'ev_ebitda'],
				regions: ['us', 'europe']
			}),
			load
		);
		expect(load).toHaveBeenCalledTimes(4);
	});

	it('reports a failed workbook without losing the others', async () => {
		const load: WorkbookLoader = vi.fn(async (_family, region) => {
			if (region === 'europe') throw new Error('down');
			return peBook;
		});
		const result = await getComparison(select({ regions: ['us', 'europe'] }), load);
		expect(result.errors['pe_trailing:europe']).toMatch(/down/);
		expect(result.cells.pe_trailing?.us?.Software?.value).toBe(25);
		expect(result.cells.pe_trailing?.europe).toBeUndefined();
	});

	it('reports a missing column', async () => {
		const noForward = book(['Industry Name', 'Number of firms', 'Trailing PE'], [['Software', 100, 25]]);
		const result = await getComparison(select({ multiples: ['pe_forward'] }), async () => noForward);
		expect(result.errors['pe_forward:us']).toMatch(/Forward PE/);
	});

	it('gives an empty cell for an industry the workbook lacks', async () => {
		const result = await getComparison(select({ industries: ['Nonexistent'] }), loader());
		expect(result.cells.pe_trailing?.us?.Nonexistent).toEqual({ value: null, firms: null });
	});
});

describe('getIndustries', () => {
	it('lists the industries of the US P/E workbook', async () => {
		const load = vi.fn(async () => peBook);
		expect(await getIndustries(load)).toEqual(['Software', 'Steel']);
		expect(load).toHaveBeenCalledWith('pe', 'us');
	});
});
