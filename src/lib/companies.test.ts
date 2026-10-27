import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, fmpSymbol, queryCompanies, type CompanyData } from './companies';

const data: CompanyData = {
	generated: '2026-10-25',
	industries: ['Banks', 'Steel'],
	countries: ['Netherlands', 'Japan'],
	groups: ['Developed Europe', 'Japan'],
	companies: [
		['ABN Amro Bank N.V.', 'ENXTAM:ABN', '6021', 0, 0, 0],
		['ING Groep N.V.', 'ENXTAM:INGA', '6022', 0, 0, 0],
		['Mizuho Financial Group', 'TSE:8411', '6020', 0, 1, 1],
		['Tata Steel Nederland', 'X:TATA', '3312', 1, 0, 0],
		['Nippon Steel', 'TSE:5401', '3312', 1, 1, 1]
	]
};

describe('queryCompanies', () => {
	it('returns every company, in order, when no filter is set', () => {
		const r = queryCompanies(data, {});
		expect(r.total).toBe(5);
		expect(r.rows[0]).toEqual({
			name: 'ABN Amro Bank N.V.',
			ticker: 'ENXTAM:ABN',
			sic: '6021',
			industry: 'Banks',
			country: 'Netherlands',
			region: 'Developed Europe'
		});
	});
	it('filters by industry and by SIC code', () => {
		expect(queryCompanies(data, { industry: 'Steel' }).rows.map((c) => c.name)).toEqual(['Tata Steel Nederland', 'Nippon Steel']);
		expect(queryCompanies(data, { sic: '6020' }).rows.map((c) => c.name)).toEqual(['Mizuho Financial Group']);
	});
	it('matches search words against name or ticker, case-insensitively', () => {
		expect(queryCompanies(data, { q: 'steel NEDERLAND' }).total).toBe(1);
		expect(queryCompanies(data, { q: 'tse:' }).total).toBe(2);
	});
	it('filters by country but keeps the country counts of the other filters', () => {
		const r = queryCompanies(data, { industry: 'Banks', country: 'Japan' });
		expect(r.rows.map((c) => c.name)).toEqual(['Mizuho Financial Group']);
		expect(r.countries).toEqual([['Netherlands', 2], ['Japan', 1]]);
	});
	it('matches nothing for an unknown industry or country', () => {
		expect(queryCompanies(data, { industry: 'Nope' }).total).toBe(0);
		expect(queryCompanies(data, { country: 'Nope' }).total).toBe(0);
	});
	it('pages the results and clamps the page number', () => {
		const many: CompanyData = {
			...data,
			companies: Array.from({ length: PAGE_SIZE + 5 }, (_, i) => [`Co ${String(i).padStart(3, '0')}`, '', '', 0, 0, 0])
		};
		const second = queryCompanies(many, { page: 2 });
		expect(second.pages).toBe(2);
		expect(second.rows).toHaveLength(5);
		expect(queryCompanies(many, { page: 99 }).page).toBe(2);
		expect(queryCompanies(many, { page: -3 }).page).toBe(1);
		expect(queryCompanies(many, { page: Number.NaN }).page).toBe(1);
	});
});

describe('fmpSymbol', () => {
	const us = (ticker: string) => ({ ticker, country: 'United States' });
	it('returns the FMP ticker for US exchange listings', () => {
		expect(fmpSymbol(us('NasdaqGS:FLWS'))).toBe('FLWS');
		expect(fmpSymbol(us('NasdaqGM:ONCH'))).toBe('ONCH');
		expect(fmpSymbol(us('NasdaqCM:ABCD'))).toBe('ABCD');
		expect(fmpSymbol(us('NYSE:IBM'))).toBe('IBM');
		expect(fmpSymbol(us('NYSEAM:XYZ'))).toBe('XYZ');
	});
	it('writes share classes the FMP way (dash, not dot)', () => {
		expect(fmpSymbol(us('NYSE:BRK.B'))).toBe('BRK-B');
		expect(fmpSymbol(us('NasdaqGS:FWON.K'))).toBe('FWON-K');
	});
	it('has no symbol for OTC and for non-US exchanges, even when the country is the United States', () => {
		expect(fmpSymbol(us('OTCPK:CBDW'))).toBeNull();
		expect(fmpSymbol(us('ASX:AHE'))).toBeNull();
		expect(fmpSymbol(us('TSXV:WAM'))).toBeNull();
		expect(fmpSymbol(us('MutualFund:ABCDX'))).toBeNull();
	});
	it('has no symbol outside the United States', () => {
		expect(fmpSymbol({ ticker: 'NYSE:TM', country: 'Japan' })).toBeNull();
	});
	it('has no symbol for malformed tickers', () => {
		for (const ticker of ['', '-', 'NYSE', 'NYSE:', 'NYSE:A B', 'NYSE:A&B']) {
			expect(fmpSymbol(us(ticker)), ticker).toBeNull();
		}
	});
});
