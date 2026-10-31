import { describe, expect, it } from 'vitest';
import { DEFAULT_MULTIPLES, DEFAULT_REGION, MAX_PEERS, parseValuationNav, valuationHref } from './valuation-nav';

const sp = (query: string) => new URLSearchParams(query);
const INDUSTRIES = ['Software (System & Application)', 'Semiconductor'];

describe('parseValuationNav', () => {
	it('has defaults for an empty query', () => {
		expect(parseValuationNav(sp(''))).toEqual({
			symbol: '',
			peers: [],
			multiples: DEFAULT_MULTIPLES,
			region: DEFAULT_REGION,
			industry: null
		});
	});
	it('reads a full query', () => {
		const nav = parseValuationNav(
			sp('symbol=asml.as&peer=besi.as&peer=nvda&m=pe_forward&m=ev_ebitda&region=europe&industry=Semiconductor&source=yahoo'),
			INDUSTRIES
		);
		expect(nav).toEqual({
			symbol: 'ASML.AS',
			peers: ['BESI.AS', 'NVDA'],
			multiples: ['ev_ebitda', 'pe_forward'],
			region: 'europe',
			industry: 'Semiconductor',
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
			peers: [],
			multiples: DEFAULT_MULTIPLES,
			region: DEFAULT_REGION,
			industry: null
		});
	});
});

describe('valuationHref', () => {
	it('round-trips through parseValuationNav', () => {
		const nav = parseValuationNav(sp('symbol=ASML.AS&peer=NVDA&m=ps&region=europe&industry=Semiconductor&source=yahoo'), INDUSTRIES);
		const href = valuationHref(nav);
		expect(href.startsWith('/financials/valuation?')).toBe(true);
		expect(parseValuationNav(new URL(href, 'http://x.test').searchParams, INDUSTRIES)).toEqual(nav);
	});
	it('writes an empty multiple list so it is not read back as the default', () => {
		const nav = parseValuationNav(sp('m='));
		expect(parseValuationNav(new URL(valuationHref(nav), 'http://x.test').searchParams).multiples).toEqual([]);
	});
});
