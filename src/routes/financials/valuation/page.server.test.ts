import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
	SITE_PASSWORD: 'pw' as string | undefined,
	SESSION_SECRET: 's'.repeat(32) as string | undefined,
	FMP_API_KEY: 'KEY' as string | undefined
}));
vi.mock('$app/env/private', () => env);
vi.mock('#lib/server/valuation', () => ({ loadValuation: vi.fn(async () => ({ state: 'stub' })) }));
vi.mock('#lib/server/compare', () => ({ getIndustries: vi.fn(async () => ['Semiconductor']) }));

import { getIndustries } from '#lib/server/compare';
import { loadValuation } from '#lib/server/valuation';
import { load } from './+page.server';

const run = async (query: string, authed: boolean) => {
	const headers: Record<string, string> = {};
	const data = await (load as unknown as (e: unknown) => Promise<Record<string, unknown>>)({
		locals: { authed, interactive: authed },
		url: new URL(`http://x.test/financials/valuation${query}`),
		setHeaders: (h: Record<string, string>) => Object.assign(headers, h)
	});
	return { data, headers };
};

beforeEach(() => {
	vi.clearAllMocks();
	env.SITE_PASSWORD = 'pw';
	env.SESSION_SECRET = 's'.repeat(32);
});

describe('valuation load', () => {
	it('is never cached and passes the parsed state and the key to the loader', async () => {
		const { data, headers } = await run('?symbol=asml.as&industry=Semiconductor&peer=nvda', true);
		expect(headers['cache-control']).toBe('private, no-store');
		expect(data).toMatchObject({ configured: true, industries: ['Semiconductor'], view: { state: 'stub' } });
		expect(data.nav).toMatchObject({ symbol: 'ASML.AS', industry: 'Semiconductor', peers: ['NVDA'] });
		expect(loadValuation).toHaveBeenCalledWith(expect.objectContaining({ authed: true, rawSymbol: 'asml.as', apiKey: 'KEY' }));
	});
	it('does not load the industry list for a visitor without a session', async () => {
		const { data } = await run('?industry=Semiconductor', false);
		expect(getIndustries).not.toHaveBeenCalled();
		expect(data).toMatchObject({ industries: [], nav: { industry: null } });
	});
	it('still works when the industry list fails, and reports a missing password setup', async () => {
		vi.mocked(getIndustries).mockRejectedValueOnce(new Error('nyu down'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		env.SITE_PASSWORD = undefined;
		const { data } = await run('?industry=Semiconductor', true);
		expect(data).toMatchObject({ configured: false, industries: [], nav: { industry: null } });
	});
});
