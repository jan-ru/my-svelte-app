import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

type Data = {
	nav: { measure: string; countries: string[]; industries: string[] };
	view: { total: number; tiles: { id: string; value: number }[]; breakdown: unknown };
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
		expect(plain.nav).toEqual({ measure: 'companies', countries: [], industries: [], sectors: [] });
		expect(plain.view.breakdown).toBeNull();
		expect(plain.view.total).toBeGreaterThan(40_000);
	});
	it('applies the query for logged-in requests', async () => {
		const japan = await run('?country=Japan', true);
		expect(japan.nav.countries).toEqual(['Japan']);
		expect(japan.view.breakdown).not.toBeNull();
		const gdp = await run('?measure=gdp', true);
		expect(gdp.nav.measure).toBe('gdp');
		expect(gdp.view.total).toBeGreaterThan(5e13);
	});
});
