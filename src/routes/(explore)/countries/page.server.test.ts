import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

type Data = {
	nav: { measure: string; countries: string[]; industries: string[]; band: number };
	view: {
		total: number;
		tiles: { id: string; value: number }[];
		breakdown: unknown;
		banded: { band: { index: number; count: number; first: number }; tiles: { id: string }[] };
	};
	macro: { country: string }[];
};
const run = async (query: string, interactive: boolean) =>
	(await load({
		url: new URL(`http://x.test/countries${query}`),
		locals: { authed: interactive, interactive },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof load>[0])) as unknown as Data;

describe('countries loader', () => {
	it('gives anonymous visitors the default view, whatever the query says', async () => {
		const plain = await run('', false);
		const asked = await run('?country=Japan&industry=Banks&measure=gdp', false);
		expect(asked).toEqual(plain);
		expect(plain.nav).toEqual({ measure: 'companies', countries: [], industries: [], sectors: [], band: 1 });
		expect(plain.view.breakdown).toBeNull();
		expect(plain.macro).toEqual([]);
		expect(plain.view.total).toBeGreaterThan(40_000);
	});
	it('follows the band for anonymous visitors too, and only the band', async () => {
		const zoomed = await run('?band=2&country=Japan&measure=gdp', false);
		expect(zoomed.nav).toEqual({ measure: 'companies', countries: [], industries: [], sectors: [], band: 2 });
		expect(zoomed).toEqual(await run('?band=2', false));
		expect(zoomed.view.banded.band.index).toBe(2);
		expect(zoomed.view.banded.band.first).toBeGreaterThan(1);
		// the zoomed band still lists every country for the data table
		expect(zoomed.view.tiles).toEqual((await run('', false)).view.tiles);
	});
	it('gives the largest band a "more" tile, and more than one band, for all countries', async () => {
		const { banded } = (await run('', false)).view;
		expect(banded.band.count).toBeGreaterThan(1);
		expect(banded.tiles.at(-1)?.id).toBe('\u0000more');
	});
	it('applies the query for logged-in requests', async () => {
		const japan = await run('?country=Japan', true);
		expect(japan.nav.countries).toEqual(['Japan']);
		expect(japan.view.breakdown).not.toBeNull();
		expect(japan.macro.map((r) => r.country)).toEqual(['Japan']);
		const gdp = await run('?measure=gdp', true);
		expect(gdp.nav.measure).toBe('gdp');
		expect(gdp.view.total).toBeGreaterThan(5e13);
	});
});
