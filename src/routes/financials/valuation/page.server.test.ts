import { beforeEach, describe, expect, it, vi } from 'vitest';

type Env = Record<'SITE_PASSWORD' | 'SESSION_SECRET' | 'FMP_API_KEY', string | undefined>;
const env = vi.hoisted((): Env => ({ SITE_PASSWORD: 'pw', SESSION_SECRET: 's'.repeat(32), FMP_API_KEY: 'KEY' }));
vi.mock('$app/env/private', () => env);
vi.mock('#lib/server/valuation', () => ({ loadValuation: vi.fn(async () => ({ state: 'stub' })) }));
vi.mock('#lib/server/compare', () => ({ getIndustries: vi.fn(async () => ['Semiconductor']) }));

import { getIndustries } from '#lib/server/compare';
import { loadValuation } from '#lib/server/valuation';
import { writeTemplate } from '#lib/server/valuation-template';
import { decodeCompany } from '#lib/valuation-company';
import { actions, load } from './+page.server';
import { GET } from './template/+server';

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

const upload = async (query: string, file: File | null, authed = true) => {
	const body = new FormData();
	if (file) body.set('file', file);
	try {
		return await (actions.upload as unknown as (e: unknown) => Promise<unknown>)({
			locals: { authed },
			request: new Request('http://x.test/financials/valuation?/upload', { method: 'POST', body }),
			url: new URL(`http://x.test/financials/valuation${query}`)
		});
	} catch (e) {
		return e;
	}
};
const xlsx = (bytes: Uint8Array<ArrayBuffer>) => new File([bytes], 'figures.xlsx');

describe('upload action', () => {
	it('refuses a visitor without a session, a missing file and an oversized one', async () => {
		expect(await upload('', xlsx(writeTemplate(2026)), false)).toMatchObject({ status: 401 });
		expect(await upload('', null)).toMatchObject({ status: 400, data: { message: 'Choose a filled-in template to upload.' } });
		expect(await upload('', new File([new Uint8Array(1_000_001)], 'big.xlsx'))).toMatchObject({ status: 413 });
	});
	it('explains a template it cannot read', async () => {
		const r = await upload('', new File(['Company,\n'], 'x.csv'));
		expect(r).toMatchObject({ status: 400, data: { message: 'Fill in the company name next to "Company".' } });
	});
	it('sends the figures on in the URL and keeps the rest of the page state', async () => {
		const r = (await upload('?/upload&symbol=AAPL&peer=MSFT&m=ps&industry=Semiconductor', xlsx(writeTemplate(2026)))) as { status: number; location: string };
		expect(r.status).toBe(303);
		const url = new URL(r.location, 'http://x.test');
		expect(url.pathname).toBe('/financials/valuation');
		expect(url.searchParams.get('symbol')).toBeNull();
		expect(url.searchParams.getAll('peer')).toEqual(['MSFT']);
		expect(url.searchParams.get('industry')).toBe('Semiconductor');
		expect(decodeCompany(url.searchParams.get('co'))?.name).toBe('Example BV');
	});
});

describe('template download', () => {
	const get = (authed: boolean) => (GET as unknown as (e: unknown) => Response)({ locals: { authed } });
	it('serves the xlsx to a logged-in visitor, privately', () => {
		const r = get(true);
		expect(r.headers.get('content-type')).toContain('spreadsheetml');
		expect(r.headers.get('content-disposition')).toContain('valuation-template.xlsx');
		expect(r.headers.get('cache-control')).toBe('private, no-store');
	});
	it('refuses a visitor without a session', () => {
		expect(() => get(false)).toThrow();
	});
});
