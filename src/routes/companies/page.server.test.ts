import { describe, expect, it, vi } from 'vitest';
import { PAGE_SIZE, PREVIEW_ROWS } from '#lib/companies';
import { load } from './+page.server';

type Data = { result: { rows: unknown[]; total: number; page: number; pages: number }; filters: Record<string, string>; preview: boolean };
const run = async (query: string, interactive: boolean) =>
	(await load({
		url: new URL(`http://x.test/companies${query}`),
		locals: { authed: interactive, interactive },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof load>[0])) as unknown as Data;

describe('companies loader', () => {
	it('gives anonymous visitors the first 20 unfiltered rows, whatever the query says', async () => {
		const plain = await run('', false);
		const asked = await run('?country=Japan&industry=Steel&q=zzz&page=7&sic=1234', false);
		expect(asked).toEqual(plain);
		expect(plain.preview).toBe(true);
		expect(plain.result.rows).toHaveLength(PREVIEW_ROWS);
		expect(plain.result.total).toBeGreaterThan(40_000);
		expect([plain.result.page, plain.result.pages]).toEqual([1, 1]);
		expect(Object.values(plain.filters).every((v) => v === '')).toBe(true);
	});
	it('keeps the full interactive behaviour for logged-in requests', async () => {
		const japan = await run('?country=Japan', true);
		expect(japan.preview).toBe(false);
		expect(japan.filters.country).toBe('Japan');
		expect(japan.result.rows).toHaveLength(PAGE_SIZE);
		expect(japan.result.pages).toBeGreaterThan(1);
	});
});
