import { describe, expect, it, vi } from 'vitest';
import companies from '#lib/data/companies.json';
import { load } from './+page.server';
import { at } from '#lib/at';

type Data = { nav: { industries: string[]; sectors: string[] }; view: { tiles: unknown[]; breakdown: unknown; total: number } };
const run = async (query: string, interactive: boolean) =>
	(await load({
		url: new URL(`http://x.test/industries${query}`),
		locals: { authed: interactive, interactive },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof load>[0])) as unknown as Data;

describe('industries loader', () => {
	it('gives anonymous visitors the default view, whatever the query says', async () => {
		const plain = await run('', false);
		const asked = await run('?industry=Steel&sector=Materials&country=Japan', false);
		expect(asked).toEqual(plain);
		expect(plain.view.tiles).toHaveLength(94);
		expect(plain.view.breakdown).toBeNull();
	});
	it('applies the query for logged-in requests', async () => {
		const name = at(companies.industries, 0);
		const one = await run(`?industry=${encodeURIComponent(name)}`, true);
		expect(one.nav.industries).toEqual([name]);
		expect(one.view.breakdown).not.toBeNull();
		const materials = await run('?sector=Materials', true);
		expect(materials.nav.sectors).toEqual(['Materials']);
		expect(materials.view.tiles.length).toBeLessThan(94);
	});
});
