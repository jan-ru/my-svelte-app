import { describe, expect, it } from 'vitest';
import { searchSbi, trace, type Crosswalk } from './crosswalk';

const data: Crosswalk = {
	generated: '2026-10-25',
	companies: 10,
	sbi25: {
		C: { level: 1, section: 'C', nl: 'INDUSTRIE', en: 'MANUFACTURING' },
		'10': { level: 2, section: 'C', nl: 'Voedingsmiddelen', en: 'Manufacture of food products' },
		'1011': { level: 4, section: 'C', nl: 'Slachten', en: 'Processing and preserving of meat' },
		'1012': { level: 4, section: 'C', nl: 'Pluimvee', en: 'Processing of poultry meat' },
		J: { level: 1, section: 'J', nl: 'INFORMATIE', en: 'INFORMATION' },
		'5811': { level: 4, section: 'J', nl: 'Boeken', en: 'Book publishing' }
	},
	sbi25ToNace2: { '1011': ['1010'], '1012': ['1010'], '5811': ['5811'] },
	nace2Titles: {},
	isic4ToIsic31: { '1010': ['1511'], '5811': ['2211', '2212'] },
	isic31Titles: { '1511': 'Meat', '2211': 'Books', '2212': 'Newspapers' },
	isic31ToNaics: { '1511': ['311611'], '2211': ['511130'], '2212': ['511110'] },
	naicsTitles: { '311611': 'Animal slaughtering' },
	naicsToSic: { '311611': ['2011', '2015'], '511130': ['2731'], '511110': ['2711'] },
	sicTitles: { '2011': 'Meat packing plants' },
	damodaran: {
		'2011': [['Food Processing', 3]],
		'2015': [['Food Processing', 1], ['Farming/Agriculture', 1]],
		'2731': [['Publshing & Newspapers', 2]],
		'2711': [['Publshing & Newspapers', 2], ['Entertainment', 1]]
	}
};

describe('searchSbi', () => {
	it('matches by code prefix, with or without a dot', () => {
		expect(searchSbi(data, '10').map((i) => i.code)).toEqual(['10', '1011', '1012']);
		expect(searchSbi(data, '10.1').map((i) => i.code)).toEqual(['1011', '1012']);
	});
	it('matches all words in the English or Dutch title, case-insensitively', () => {
		expect(searchSbi(data, 'POULTRY meat').map((i) => i.code)).toEqual(['1012']);
		expect(searchSbi(data, 'boeken').map((i) => i.code)).toEqual(['5811']);
	});
	it('returns nothing for an empty or unmatched query', () => {
		expect(searchSbi(data, '  ')).toEqual([]);
		expect(searchSbi(data, 'zzz')).toEqual([]);
	});
});

describe('trace', () => {
	it('returns null for an unknown code', () => {
		expect(trace(data, '9999')).toBeNull();
	});
	it('follows one class through every hop and aggregates Damodaran industries', () => {
		const t = trace(data, '1011')!;
		expect(t.nace2.map((i) => i.code)).toEqual(['1010']);
		expect(t.isic31.map((i) => i.code)).toEqual(['1511']);
		expect(t.sic.map((i) => i.code)).toEqual(['2011', '2015']);
		expect(t.damodaran).toEqual([
			{ industry: 'Food Processing', companies: 4, share: 0.8 },
			{ industry: 'Farming/Agriculture', companies: 1, share: 0.2 }
		]);
	});
	it('expands a division to its classes and de-duplicates shared codes', () => {
		const t = trace(data, '10')!;
		expect(t.nace21.map((i) => i.code)).toEqual(['1011', '1012']);
		expect(t.nace2.map((i) => i.code)).toEqual(['1010']);
	});
	it('expands a section letter to its classes', () => {
		const t = trace(data, 'J')!;
		expect(t.nace21.map((i) => i.code)).toEqual(['5811']);
		expect(t.damodaran.map((m) => m.industry)).toEqual(['Publshing & Newspapers', 'Entertainment']);
		expect(t.damodaran.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1);
	});
});
