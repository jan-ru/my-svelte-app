import { describe, expect, it } from 'vitest';
import { formatNewsDate, profileFields } from './company';
import type { Profile } from './server/fmp-info';

const empty: Profile = {
	name: null, exchange: null, sector: null, industry: null, country: null, ceo: null, website: null,
	ipoDate: null, currency: null, description: null, employees: null, price: null, marketCap: null, beta: null
};

describe('profileFields', () => {
	it('lists the fields in display order with formatting', () => {
		const fields = profileFields({
			...empty,
			name: 'Apple Inc.',
			exchange: 'NASDAQ',
			sector: 'Technology',
			industry: 'Consumer Electronics',
			country: 'US',
			ceo: 'Tim Cook',
			employees: 164000,
			website: 'https://www.apple.com/',
			ipoDate: '1980-12-12',
			currency: 'USD',
			price: 189.5,
			marketCap: 2_900_000_000_000,
			beta: 1.2345
		});
		expect(fields.map((f) => f.label)).toEqual([
			'Company', 'Exchange', 'Sector', 'Industry', 'Country', 'CEO', 'Employees', 'Website',
			'IPO date', 'Currency', 'Price', 'Market cap', 'Beta'
		]);
		const by = Object.fromEntries(fields.map((f) => [f.label, f]));
		expect(by.Employees.value).toBe('164,000');
		expect(by.Price.value).toBe('189.50 USD');
		expect(by['Market cap'].value).toBe('2.9 trillion USD');
		expect(by.Beta.value).toBe('1.23');
		expect(by.Website).toEqual({ label: 'Website', value: 'www.apple.com', href: 'https://www.apple.com/' });
	});
	it('skips missing values', () => {
		expect(profileFields({ ...empty, name: 'X' })).toEqual([{ label: 'Company', value: 'X' }]);
		expect(profileFields(empty)).toEqual([]);
	});
	it('scales market cap', () => {
		const cap = (v: number) => profileFields({ ...empty, marketCap: v })[0].value;
		expect(cap(5_500_000_000)).toBe('5.5 billion');
		expect(cap(250_000_000)).toBe('250 million');
		expect(cap(12_345)).toBe('12,345');
	});
});

describe('formatNewsDate', () => {
	it('keeps the date part', () => {
		expect(formatNewsDate('2026-10-25 14:30:00')).toBe('2026-10-25');
		expect(formatNewsDate('2026-10-25T14:30:00.000Z')).toBe('2026-10-25');
	});
	it('passes through unknown formats and null', () => {
		expect(formatNewsDate('yesterday')).toBe('yesterday');
		expect(formatNewsDate(null)).toBeNull();
	});
});
