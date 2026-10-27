import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Selection } from '#lib/params';
import type { Comparison } from '#lib/server/compare';

// No network: the NYU layer is replaced by fixtures.
const nyu = vi.hoisted(() => ({
	getIndustries: vi.fn(),
	getComparison: vi.fn()
}));
vi.mock('#lib/server/compare', () => nyu);

import { DEFAULT_SELECTION } from '#lib/params';
import { load } from './+page.server';

const INDUSTRIES = [...DEFAULT_SELECTION.industries, 'Steel', 'Banks (Regional)'];

function comparison(selection: Selection, errors: Comparison['errors'] = {}): Comparison {
	return {
		updated: '2026-01-05',
		errors,
		cells: Object.fromEntries(
			selection.multiples.map((m) => [
				m,
				Object.fromEntries(
					selection.regions.map((r) => [r, Object.fromEntries(selection.industries.map((i) => [i, { value: 10, firms: 5 }]))])
				)
			])
		)
	};
}

const run = async (query: string, interactive: boolean) => {
	const setHeaders = vi.fn();
	const data = (await load({
		url: new URL(`http://x.test/${query}`),
		locals: { authed: interactive, interactive },
		setHeaders
	} as unknown as Parameters<typeof load>[0])) as unknown as { view: { selection: Selection }; loadError: string | null; model: unknown };
	return { data, setHeaders };
};

beforeEach(() => {
	vi.clearAllMocks();
	nyu.getIndustries.mockResolvedValue(INDUSTRIES);
	nyu.getComparison.mockImplementation(async (selection: Selection) => comparison(selection));
});

describe('home loader', () => {
	it('gives anonymous visitors the default view whatever the query says', async () => {
		const plain = await run('', false);
		const asked = await run('?i=Steel&i=Banks%20(Regional)&m=pe_trailing&r=japan', false);
		expect(asked.data).toEqual(plain.data);
		expect(asked.data.view.selection).toEqual(DEFAULT_SELECTION);
		expect(nyu.getComparison.mock.calls.map(([selection]) => selection)).toEqual([DEFAULT_SELECTION, DEFAULT_SELECTION]);
	});

	it('caches a complete anonymous result publicly', async () => {
		const { setHeaders } = await run('', false);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400' });
	});

	it('reads the query for interactive requests', async () => {
		const { data } = await run('?i=Steel&m=pe_trailing', true);
		expect(data.view.selection.industries).toEqual(['Steel']);
		expect(data.view.selection.multiples).toEqual(['pe_trailing']);
	});

	it('never caches a partial result', async () => {
		nyu.getComparison.mockImplementation(async (selection: Selection) => comparison(selection, { 'pe_trailing:us': 'Data unavailable: x' }));
		const { setHeaders } = await run('', false);
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store' });
	});

	it('shows an error and caches nothing when the NYU list cannot be loaded', async () => {
		nyu.getIndustries.mockRejectedValue(new Error('down'));
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { data, setHeaders } = await run('', false);
		spy.mockRestore();
		expect(data.loadError).toMatch(/could not be loaded/);
		expect(data.model).toBeNull();
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'no-store' });
		expect(nyu.getComparison).not.toHaveBeenCalled();
	});
});
