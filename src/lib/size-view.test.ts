import { describe, expect, it } from 'vitest';
import type { CompanyData } from './companies';
import type { GdpData } from './gdp';
import { countriesView, industriesView } from './size-view';
import type { SizeNav } from './size-nav';

const data: CompanyData = {
	generated: '2026-10-25',
	industries: ['Banks', 'Steel'],
	countries: ['Netherlands', 'Japan', 'Taiwan'],
	groups: ['Developed Europe', 'Japan'],
	sectors: ['Financials', 'Materials'],
	subGroups: ['EU & Environs', 'Japan'],
	companies: [
		['ABN Amro Bank N.V.', 'ENXTAM:ABN', '6021', 0, 0, 0, 0, 0],
		['ING Groep N.V.', 'ENXTAM:INGA', '6022', 0, 0, 0, 0, 0],
		['Mizuho Financial Group', 'TSE:8411', '6020', 0, 1, 1, 0, 1],
		['Tata Steel Nederland', 'X:TATA', '3312', 1, 0, 0, 1, 0],
		['Nippon Steel', 'TSE:5401', '3312', 1, 1, 1, 1, 1],
		['TSMC', 'TWSE:2330', '3674', 1, 2, 1, 1, 1]
	]
};
const gdp: GdpData = {
	generated: '2026-10-28',
	source: 'World Bank',
	world: { value: 1000, year: 2025 },
	countries: { NLD: { name: 'Netherlands', value: 100, year: 2024 }, JPN: { name: 'Japan', value: 300, year: 2025 } },
	nyu: { Netherlands: 'NLD', Japan: 'JPN' },
	unmatched: ['Taiwan']
};
const nav = (over: Partial<SizeNav> = {}): SizeNav => ({
	measure: 'companies',
	countries: [],
	industries: [],
	sectors: [],
	...over
});

describe('countriesView', () => {
	it('defaults to every country by company count, the top ten against the global total', () => {
		const v = countriesView(data, gdp, nav());
		expect(v.measureLabel).toBe('companies');
		expect(v.total).toBe(6);
		expect(v.tiles.map((t) => [t.id, t.value])).toEqual([
			['Netherlands', 3],
			['Japan', 2],
			['Taiwan', 1]
		]);
		expect(v.shares.items.map((i) => i.id)).toEqual(['Netherlands', 'Japan', 'Taiwan']);
		expect(v.shares.rest).toBeNull();
		expect(v.breakdown).toBeNull();
		expect(v.cross).toBeNull();
		expect(v.gdpNote).toBeNull();
	});
	it('shows only the selected countries against the global total, with a rest of world', () => {
		const v = countriesView(data, gdp, nav({ countries: ['Japan'] }));
		expect(v.shares.items).toHaveLength(1);
		expect(v.shares.items[0]).toMatchObject({ id: 'Japan', value: 2 });
		expect(v.shares.items[0]?.percent).toBeCloseTo((2 / 6) * 100, 9);
		expect(v.shares.rest?.value).toBe(4);
		// a selection also shows its industries
		expect(v.breakdown?.map((t) => [t.id, t.value])).toEqual([
			['Banks', 1],
			['Steel', 1]
		]);
		expect(v.breakdownTotal).toBe(6);
	});
	it('restricts the counts by industry and keeps percentages of the global total', () => {
		const v = countriesView(data, gdp, nav({ industries: ['Banks'] }));
		expect(v.tiles.map((t) => [t.id, t.value])).toEqual([
			['Netherlands', 2],
			['Japan', 1]
		]);
		expect(v.total).toBe(6);
	});
	it('gives the cross cell for one country and one industry', () => {
		const v = countriesView(data, gdp, nav({ countries: ['Netherlands'], industries: ['Banks'] }));
		expect(v.cross?.count).toBe(2);
		expect(v.cross?.href).toBe('/companies?country=Netherlands&industry=Banks');
	});
	it('uses GDP against the World Bank world total and says what it means', () => {
		const v = countriesView(data, gdp, nav({ measure: 'gdp', countries: ['Netherlands'] }));
		expect(v.measureLabel).toBe('GDP');
		expect(v.total).toBe(1000);
		expect(v.tiles.map((t) => t.id)).toEqual(['Japan', 'Netherlands']);
		expect(v.shares.items[0]).toEqual({ id: 'Netherlands', value: 100, percent: 10 });
		expect(v.shares.rest?.value).toBe(900);
		expect(v.gdpNote).toMatch(/2024.*2025/);
		expect(v.gdpNote).toMatch(/World Bank/);
		expect(v.gdpNote).toMatch(/Taiwan/); // countries without GDP are named
		expect(v.breakdown).toBeNull(); // GDP has no industry split
	});
	it('colours the industry breakdown by sector', () => {
		const v = countriesView(data, gdp, nav({ countries: ['Netherlands'] }));
		const banks = v.breakdown!.find((t) => t.id === 'Banks')!;
		const steel = v.breakdown!.find((t) => t.id === 'Steel')!;
		expect(banks.fill).not.toBe(steel.fill);
	});
});

describe('industriesView', () => {
	it('defaults to every industry by company count, coloured by sector, with a legend', () => {
		const v = industriesView(data, nav());
		expect(v.total).toBe(6);
		expect(v.tiles.map((t) => [t.id, t.value])).toEqual([
			['Banks', 3],
			['Steel', 3]
		]);
		expect(v.tiles[0]?.fill).not.toBe(v.tiles[1]?.fill);
		expect(v.legend.map((l) => [l.sector, l.value])).toEqual([
			['Financials', 3],
			['Materials', 3]
		]);
		expect(v.shares.items.map((i) => i.id)).toEqual(['Banks', 'Steel']);
		expect(v.shares.rest).toBeNull();
		expect(v.breakdown).toBeNull();
		expect(v.cross).toBeNull();
	});
	it('drills from a sector to its industries (by the companies own sector)', () => {
		const v = industriesView(data, nav({ sectors: ['Materials'] }));
		expect(v.tiles.map((t) => [t.id, t.value])).toEqual([['Steel', 3]]);
		expect(v.total).toBe(6);
	});
	it('shows the countries of the selected industries, and restricts by country', () => {
		const v = industriesView(data, nav({ industries: ['Steel'] }));
		expect(v.breakdown?.map((t) => [t.id, t.value])).toEqual([
			['Japan', 1],
			['Netherlands', 1],
			['Taiwan', 1]
		]);
		expect(v.shares.items).toEqual([{ id: 'Steel', value: 3, percent: 50 }]);
		expect(v.shares.rest?.value).toBe(3);
		const jp = industriesView(data, nav({ countries: ['Japan'] }));
		expect(jp.tiles.map((t) => [t.id, t.value])).toEqual([
			['Banks', 1],
			['Steel', 1]
		]);
	});
	it('gives the cross cell for one country and one industry', () => {
		const v = industriesView(data, nav({ countries: ['Japan'], industries: ['Banks'] }));
		expect(v.cross?.count).toBe(1);
	});
});
