import { describe, expect, it } from 'vitest';
import {
	PAGE_SIZE,
	PREVIEW_ROWS,
	displayName,
	financialsLink,
	fmpSymbol,
	previewOf,
	queryCompanies,
	type CompanyData
} from './companies';

const data: CompanyData = {
	generated: '2026-10-25',
	industries: ['Banks', 'Steel'],
	countries: ['Netherlands', 'Japan'],
	groups: ['Developed Europe', 'Japan'],
	sectors: ['Financials', 'Materials'],
	subGroups: ['EU & Environs', 'Japan'],
	companies: [
		['ABN Amro Bank N.V.', 'ENXTAM:ABN', '6021', 0, 0, 0, 0, 0],
		['ING Groep N.V.', 'ENXTAM:INGA', '6022', 0, 0, 0, 0, 0],
		['Mizuho Financial Group', 'TSE:8411', '6020', 0, 1, 1, 0, 1],
		['Tata Steel Nederland', 'X:TATA', '3312', 1, 0, 0, 1, 0],
		['Nippon Steel', 'TSE:5401', '3312', 1, 1, 1, 1, 1]
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
			region: 'Developed Europe',
			sector: 'Financials'
		});
	});
	it('filters by industry and by SIC code', () => {
		expect(queryCompanies(data, { industry: 'Steel' }).rows.map((c) => c.name)).toEqual([
			'Tata Steel Nederland',
			'Nippon Steel'
		]);
		expect(queryCompanies(data, { sic: '6020' }).rows.map((c) => c.name)).toEqual(['Mizuho Financial Group']);
	});
	it('matches search words against name or ticker, case-insensitively', () => {
		expect(queryCompanies(data, { q: 'steel NEDERLAND' }).total).toBe(1);
		expect(queryCompanies(data, { q: 'tse:' }).total).toBe(2);
	});
	it('filters by country but keeps the country counts of the other filters', () => {
		const r = queryCompanies(data, { industry: 'Banks', country: 'Japan' });
		expect(r.rows.map((c) => c.name)).toEqual(['Mizuho Financial Group']);
		expect(r.countries).toEqual([
			['Netherlands', 2],
			['Japan', 1]
		]);
	});
	it('counts the distinct industries, sectors, regions, sub groups and exchanges among the matches', () => {
		expect(queryCompanies(data, {}).distinct).toEqual({
			industries: 2,
			sectors: 2,
			regions: 2,
			subGroups: 2,
			exchanges: 3
		});
		// the country filter narrows the counts, like the company total
		expect(queryCompanies(data, { country: 'Japan' }).distinct).toEqual({
			industries: 2,
			sectors: 2,
			regions: 1,
			subGroups: 1,
			exchanges: 1
		});
		expect(queryCompanies(data, { industry: 'Nope' }).distinct).toEqual({
			industries: 0,
			sectors: 0,
			regions: 0,
			subGroups: 0,
			exchanges: 0
		});
	});
	it('does not count a ticker without an exchange as one', () => {
		const bare: CompanyData = { ...data, companies: [['No Exchange Ltd', 'NOCODE', '', 0, 0, 0, 0, 0]] };
		expect(queryCompanies(bare, {}).distinct.exchanges).toBe(0);
	});
	it('filters by region and by sector, alone and together with the other filters', () => {
		expect(queryCompanies(data, { region: 'Japan' }).rows.map((c) => c.name)).toEqual([
			'Mizuho Financial Group',
			'Nippon Steel'
		]);
		expect(queryCompanies(data, { sector: 'Materials' }).rows.map((c) => c.name)).toEqual([
			'Tata Steel Nederland',
			'Nippon Steel'
		]);
		expect(queryCompanies(data, { region: 'Japan', sector: 'Materials' }).rows.map((c) => c.name)).toEqual([
			'Nippon Steel'
		]);
		expect(queryCompanies(data, { region: 'Nope' }).total).toBe(0);
		expect(queryCompanies(data, { sector: 'Nope' }).total).toBe(0);
	});
	it('matches nothing for an unknown industry or country', () => {
		expect(queryCompanies(data, { industry: 'Nope' }).total).toBe(0);
		expect(queryCompanies(data, { country: 'Nope' }).total).toBe(0);
	});
	it('pages the results and clamps the page number', () => {
		const many: CompanyData = {
			...data,
			companies: Array.from({ length: PAGE_SIZE + 5 }, (_, i) => [
				`Co ${String(i).padStart(3, '0')}`,
				'',
				'',
				0,
				0,
				0,
				0,
				0
			])
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

describe('financialsLink', () => {
	const row = (ticker: string, country: string) => ({ ticker, country });
	it('links US exchange listings to FMP', () => {
		expect(financialsLink(row('NasdaqGS:AAPL', 'United States'))).toBe('/financials?symbol=AAPL');
		expect(financialsLink(row('NYSE:BRK.B', 'United States'))).toBe('/financials?symbol=BRK-B');
	});
	it('links mappable non-US rows to Yahoo', () => {
		expect(financialsLink(row('ENXTAM:ABN', 'Netherlands'))).toBe('/financials?symbol=ABN.AS&source=yahoo');
		expect(financialsLink(row('TSE:7203', 'Japan'))).toBe('/financials?symbol=7203.T&source=yahoo');
	});
	it('gives US OTC and other unmappable rows no link', () => {
		expect(financialsLink(row('OTCPK:CBDW', 'United States'))).toBeNull();
		expect(financialsLink(row('MARS:XYZ', 'Netherlands'))).toBeNull();
		expect(financialsLink(row('', 'Netherlands'))).toBeNull();
	});
	it('gives no link when the symbol would not pass the financials page (for example an ampersand)', () => {
		expect(financialsLink(row('NSEI:M&M', 'India'))).toBeNull();
	});
	it('keeps a US-style symbol with a request for Yahoo for foreign companies listed on a US exchange', () => {
		expect(financialsLink(row('NYSE:TM', 'Japan'))).toBe('/financials?symbol=TM&source=yahoo');
	});
});

describe('displayName', () => {
	it('drops the ticker NYU appends to the name, only when it matches', () => {
		expect(displayName('ABN Amro Bank N.V. (ENXTAM:ABN)', 'ENXTAM:ABN')).toBe('ABN Amro Bank N.V.');
		expect(displayName('ABN Amro Bank N.V. (ENXTAM:ABN)', 'TSE:1')).toBe('ABN Amro Bank N.V. (ENXTAM:ABN)');
		expect(displayName('Everlert, Inc.', '')).toBe('Everlert, Inc.');
	});
	it('is applied to the rows', () => {
		const d: CompanyData = {
			...data,
			companies: [['ING Groep N.V. (ENXTAM:INGA)', 'ENXTAM:INGA', '6022', 0, 0, 0, 0, 0]]
		};
		expect(queryCompanies(d, {}).rows[0]?.name).toBe('ING Groep N.V.');
	});
});

describe('previewOf', () => {
	it('keeps the first 20 rows as a single page and the total', () => {
		const many: CompanyData = {
			...data,
			companies: Array.from({ length: PAGE_SIZE + 5 }, (_, i) => [
				`Co ${String(i).padStart(3, '0')}`,
				'',
				'',
				0,
				0,
				0,
				0,
				0
			])
		};
		const full = queryCompanies(many, {});
		const preview = previewOf(full);
		expect(PREVIEW_ROWS).toBe(20);
		expect(preview.rows).toHaveLength(20);
		expect(preview.rows[0]?.name).toBe('Co 000');
		expect(preview.total).toBe(PAGE_SIZE + 5);
		expect([preview.page, preview.pages]).toEqual([1, 1]);
	});
});
