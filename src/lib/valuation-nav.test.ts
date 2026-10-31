import { describe, expect, it } from 'vitest';
import { encodeCompany } from './valuation-company';
import type { CompanyFigures } from './valuation-data';
import { DEFAULT_MULTIPLES, DEFAULT_REGION, MAX_PEERS, parseValuationNav, valuationHref } from './valuation-nav';

const sp = (query: string) => new URLSearchParams(query);
const INDUSTRIES = ['Software (System & Application)', 'Semiconductor'];

describe('parseValuationNav', () => {
	it('has defaults for an empty query', () => {
		expect(parseValuationNav(sp(''))).toEqual({
			symbol: '',
			company: null,
			peers: [],
			multiples: DEFAULT_MULTIPLES,
			region: DEFAULT_REGION,
			industry: null,
			overrides: {}
		});
	});
	it('reads a full query', () => {
		const nav = parseValuationNav(
			sp('symbol=asml.as&peer=besi.as&peer=nvda&m=pe_forward&m=ev_ebitda&region=europe&industry=Semiconductor&source=yahoo'),
			INDUSTRIES
		);
		expect(nav).toEqual({
			symbol: 'ASML.AS',
			company: null,
			peers: ['BESI.AS', 'NVDA'],
			multiples: ['ev_ebitda', 'pe_forward'],
			region: 'europe',
			industry: 'Semiconductor',
			overrides: {},
			source: 'yahoo'
		});
	});
	it('splits typed peers, drops invalid ones, duplicates and the company itself, and caps the list', () => {
		const many = Array.from({ length: 12 }, (_, i) => `P${i}`).join(',');
		const nav = parseValuationNav(sp(`symbol=AAPL&peer=msft, goog&peer=MSFT&peer=aapl&peer=bad!&peer=&peer=${many}`));
		expect(nav.peers.slice(0, 2)).toEqual(['MSFT', 'GOOG']);
		expect(nav.peers).not.toContain('AAPL');
		expect(nav.peers).toHaveLength(MAX_PEERS);
	});
	it('keeps an explicitly empty multiple list and caps the selection at four', () => {
		expect(parseValuationNav(sp('m=')).multiples).toEqual([]);
		expect(parseValuationNav(sp('m=ps&m=pbv&m=ev_ic&m=ev_ebit&m=ev_ebitda&m=nope')).multiples).toEqual([
			'ev_ebitda',
			'ev_ebit',
			'pbv',
			'ev_ic'
		]);
	});
	it('falls back for an unknown region, industry, source and an invalid ticker', () => {
		expect(parseValuationNav(sp('symbol=bad!&region=mars&industry=Nope&source=x'), INDUSTRIES)).toEqual({
			symbol: '',
			company: null,
			peers: [],
			multiples: DEFAULT_MULTIPLES,
			region: DEFAULT_REGION,
			industry: null,
			overrides: {}
		});
	});
});

describe('manual bands', () => {
	it('reads lo.<id> and hi.<id> for selected multiples, with a comma as decimal mark', () => {
		const nav = parseValuationNav(sp('m=ev_ebitda&m=ps&lo.ev_ebitda=6&hi.ev_ebitda=10,5&lo.pbv=1&hi.pbv=2'));
		expect(nav.overrides).toEqual({ ev_ebitda: { low: 6, high: 10.5 } });
	});
	it.each([
		['lo.ps=2', 'only one end'],
		['lo.ps=&hi.ps=3', 'an empty end'],
		['lo.ps=0&hi.ps=3', 'a zero end'],
		['lo.ps=-1&hi.ps=3', 'a negative end'],
		['lo.ps=abc&hi.ps=3', 'text']
	])('ignores a band with %s (%s)', (query) => {
		expect(parseValuationNav(sp(`m=ps&${query}`)).overrides).toEqual({});
	});
});

describe('valuationHref', () => {
	it('round-trips through parseValuationNav', () => {
		const nav = parseValuationNav(sp('symbol=ASML.AS&peer=NVDA&m=ps&lo.ps=1.5&hi.ps=3&region=europe&industry=Semiconductor&source=yahoo'), INDUSTRIES);
		expect(nav.overrides).toEqual({ ps: { low: 1.5, high: 3 } });
		const href = valuationHref(nav);
		expect(href.startsWith('/financials/valuation?')).toBe(true);
		expect(parseValuationNav(new URL(href, 'http://x.test').searchParams, INDUSTRIES)).toEqual(nav);
	});
	it('writes an empty multiple list so it is not read back as the default', () => {
		const nav = parseValuationNav(sp('m='));
		expect(parseValuationNav(new URL(valuationHref(nav), 'http://x.test').searchParams).multiples).toEqual([]);
	});
});

describe('private company in the URL', () => {
	const company: CompanyFigures = {
		name: 'ACCENSS BV',
		currency: 'EUR',
		origin: 'manual',
		netDebt: 1000,
		years: [{ fiscalYear: '2025', kind: 'actual', values: { revenue: 238251, ebitda: 67208, ebit: null, netIncome: null, bookEquity: null, investedCapital: null } }]
	};
	it('reads co and writes it in place of the ticker', () => {
		const nav = parseValuationNav(sp(`co=${encodeCompany(company)}&symbol=AAPL&peer=MSFT`));
		expect(nav.company).toEqual(company);
		const href = valuationHref(nav);
		expect(href).toContain('co=');
		expect(href).not.toContain('symbol=');
		expect(parseValuationNav(new URL(href, 'http://x.test').searchParams).company).toEqual(company);
	});
	it('ignores a broken co', () => {
		expect(parseValuationNav(sp('co=nonsense')).company).toBeNull();
	});
});
