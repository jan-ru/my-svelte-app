import { describe, expect, it } from 'vitest';
import real from './data/companies.json';
import type { CompanyData } from './companies';
import {
	COUNTRY_FILL,
	SECTOR_FILLS,
	countBy,
	crossCell,
	dominantSector,
	formatCount,
	formatPercent,
	formatUsd,
	sectorFill,
	shareOfGlobal,
	topIds
} from './size';

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

describe('countBy', () => {
	it('counts companies per value of a dimension', () => {
		expect(countBy(data, 'country')).toEqual({ Netherlands: 3, Japan: 2 });
		expect(countBy(data, 'industry')).toEqual({ Banks: 3, Steel: 2 });
		expect(countBy(data, 'sector')).toEqual({ Financials: 3, Materials: 2 });
		expect(countBy(data, 'region')).toEqual({ 'Developed Europe': 3, Japan: 2 });
	});
	it('restricts by country, industry and sector, in any combination', () => {
		expect(countBy(data, 'industry', { countries: ['Japan'] })).toEqual({ Banks: 1, Steel: 1 });
		expect(countBy(data, 'country', { industries: ['Banks'] })).toEqual({ Netherlands: 2, Japan: 1 });
		expect(countBy(data, 'country', { sectors: ['Materials'] })).toEqual({ Netherlands: 1, Japan: 1 });
		expect(countBy(data, 'country', { industries: ['Banks'], countries: ['Japan'] })).toEqual({ Japan: 1 });
	});
	it('treats an empty list as no restriction and unknown names as matching nothing', () => {
		expect(countBy(data, 'country', { industries: [] })).toEqual({ Netherlands: 3, Japan: 2 });
		expect(countBy(data, 'country', { industries: ['Nope'] })).toEqual({});
	});
	it('counts every company of the real file exactly once per dimension', () => {
		const all = real as unknown as CompanyData;
		for (const by of ['country', 'industry', 'sector', 'region'] as const) {
			expect(Object.values(countBy(all, by)).reduce((s, n) => s + n, 0)).toBe(all.companies.length);
		}
	});
});

describe('dominantSector', () => {
	it('takes the sector most of an industry belongs to, alphabetical on a tie', () => {
		expect(dominantSector(data)).toEqual({ Banks: 'Financials', Steel: 'Materials' });
		const tie: CompanyData = { ...data, companies: [['A', '', '', 0, 0, 0, 1, 0], ['B', '', '', 0, 0, 0, 0, 0]] };
		expect(dominantSector(tie)).toEqual({ Banks: 'Financials' });
	});
	it('covers all 94 industries of the real file with a sector that has a colour', () => {
		const all = real as unknown as CompanyData;
		const map = dominantSector(all);
		expect(Object.keys(map)).toHaveLength(all.industries.length);
		for (const sector of Object.values(map)) expect(SECTOR_FILLS).toHaveProperty(sector);
	});
});

describe('sector colours', () => {
	const luminance = (hex: string) => {
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const ink = luminance('#1D2D3E');
	it('has a colour for every real sector and a fallback', () => {
		for (const s of (real as unknown as CompanyData).sectors) expect(SECTOR_FILLS).toHaveProperty(s);
		expect(sectorFill('Nonsense')).toMatch(/^#/);
	});
	it('keeps the dark label text readable (WCAG AA, 4.5:1) on every fill', () => {
		for (const fill of [...Object.values(SECTOR_FILLS), COUNTRY_FILL, sectorFill('Nonsense')]) {
			expect((luminance(fill) + 0.05) / (ink + 0.05)).toBeGreaterThanOrEqual(4.5);
		}
	});
	it('uses distinct colours for the sectors', () => {
		expect(new Set(Object.values(SECTOR_FILLS)).size).toBe(Object.keys(SECTOR_FILLS).length);
	});
});

describe('shareOfGlobal', () => {
	const values = { A: 50, B: 30, C: 20 };
	it('gives absolute and percent of the global total, plus the rest of the world', () => {
		const s = shareOfGlobal(values, ['A', 'C'], 100);
		expect(s.items).toEqual([{ id: 'A', value: 50, percent: 50 }, { id: 'C', value: 20, percent: 20 }]);
		expect(s.rest).toEqual({ id: 'rest', value: 30, percent: 30 });
		expect(s.items.reduce((t, i) => t + i.percent, 0) + s.rest!.percent).toBeCloseTo(100, 9);
	});
	it('has no rest when the selection is everything', () => {
		expect(shareOfGlobal(values, ['A', 'B', 'C'], 100).rest).toBeNull();
	});
	it('keeps a rest when the global total is larger than the sum of all items (GDP)', () => {
		const s = shareOfGlobal(values, ['A', 'B', 'C'], 120);
		expect(s.rest?.value).toBe(20);
	});
	it('ignores unknown and duplicate ids and survives a zero total', () => {
		expect(shareOfGlobal(values, ['A', 'A', 'Z'], 100).items).toHaveLength(1);
		const z = shareOfGlobal(values, ['A'], 0);
		expect(z.items[0].percent).toBe(0);
		expect(z.rest).toBeNull();
	});
	it('orders the items largest first', () => {
		expect(shareOfGlobal(values, ['C', 'B', 'A'], 100).items.map((i) => i.id)).toEqual(['A', 'B', 'C']);
	});
});

describe('topIds', () => {
	it('returns the n largest ids', () => {
		expect(topIds({ A: 1, B: 3, C: 2 }, 2)).toEqual(['B', 'C']);
	});
});

describe('crossCell', () => {
	it('gives the count and the shares of the global total, the country and the industry', () => {
		const c = crossCell(data, 'Netherlands', 'Banks')!;
		expect(c.count).toBe(2);
		expect(c.percentOfGlobal).toBeCloseTo(40, 9);
		expect(c.percentOfCountry).toBeCloseTo((2 / 3) * 100, 9);
		expect(c.percentOfIndustry).toBeCloseTo((2 / 3) * 100, 9);
		expect(c.href).toBe('/companies?country=Netherlands&industry=Banks');
	});
	it('is null for an unknown country or industry', () => {
		expect(crossCell(data, 'Atlantis', 'Banks')).toBeNull();
		expect(crossCell(data, 'Japan', 'Nope')).toBeNull();
	});
	it('can be empty for a real pair with no companies', () => {
		const c = crossCell({ ...data, companies: [data.companies[0]] }, 'Japan', 'Steel')!;
		expect(c.count).toBe(0);
		expect(c.percentOfGlobal).toBe(0);
	});
});

describe('formatters', () => {
	it('formats counts, dollars and percentages', () => {
		expect(formatCount(48156)).toBe('48,156');
		expect(formatUsd(118350166039396)).toBe('US$ 118 trillion');
		expect(formatUsd(4.2e12)).toBe('US$ 4.2 trillion');
		expect(formatUsd(3.4e9)).toBe('US$ 3.4 billion');
		expect(formatUsd(2.5e6)).toBe('US$ 2.5 million');
		expect(formatUsd(950)).toBe('US$ 950');
		expect(formatPercent(55.4)).toBe('55%');
		expect(formatPercent(5.04)).toBe('5.0%');
		expect(formatPercent(0.04)).toBe('<0.1%');
		expect(formatPercent(0)).toBe('0%');
	});
});
