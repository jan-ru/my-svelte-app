import { beforeEach, describe, expect, it, vi } from 'vitest';

type Env = Record<'SITE_PASSWORD' | 'SESSION_SECRET' | 'FMP_API_KEY', string | undefined>;
const env = vi.hoisted((): Env => ({
	SITE_PASSWORD: 'pw',
	SESSION_SECRET: 's'.repeat(32),
	FMP_API_KEY: undefined
}));
vi.mock('$app/env/private', () => env);
vi.mock('#lib/server/financials', () => ({ loadFinancials: vi.fn(async () => ({ kind: 'stub' })) }));

import { load } from './+page.server';

async function redirected(run: () => unknown): Promise<{ status: number; location: string }> {
	try {
		await run();
	} catch (e) {
		const r = e as { status?: number; location?: string };
		if (typeof r.status === 'number' && typeof r.location === 'string')
			return { status: r.status, location: r.location };
		throw e;
	}
	throw new Error('expected a redirect');
}

beforeEach(() => {
	env.SITE_PASSWORD = 'pw';
	env.SESSION_SECRET = 's'.repeat(32);
});

describe('load', () => {
	const run = (query: string, locals: { authed: boolean; interactive: boolean }) => {
		const setHeaders = vi.fn();
		return {
			setHeaders,
			result: () =>
				load({
					locals,
					url: new URL(`http://x.test/financials${query}`),
					setHeaders
				} as unknown as Parameters<typeof load>[0])
		};
	};

	it('is private and uncached', async () => {
		const { setHeaders, result } = run('', { authed: false, interactive: false });
		await result();
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
	});

	it('sends an old login link on to the login page', async () => {
		expect(await redirected(run('?from=%2Fcompanies', { authed: false, interactive: false }).result)).toEqual({
			status: 303,
			location: '/login?from=%2Fcompanies'
		});
		expect(
			(await redirected(run('?from=https%3A%2F%2Fevil.test', { authed: true, interactive: true }).result)).location
		).toBe('/login');
	});
});
