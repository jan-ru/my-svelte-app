import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

type Data = { q: string; industry: string; trace: unknown; reverse: unknown };
const run = async (query: string, interactive: boolean) =>
	(await load({
		url: new URL(`http://x.test/classification${query}`),
		locals: { authed: interactive, interactive },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof load>[0])) as unknown as Data;

describe('classification loader', () => {
	it('ignores search, code and industry for anonymous visitors', async () => {
		const asked = await run('?q=bank&code=64&industry=Banks%20(Regional)', false);
		expect(asked).toEqual(await run('', false));
		expect(asked.q).toBe('');
		expect(asked.industry).toBe('');
		expect(asked.trace).toBeNull();
	});
	it('searches for logged-in requests', async () => {
		expect((await run('?q=bank', true)).q).toBe('bank');
	});
});
