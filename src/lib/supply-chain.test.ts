import { describe, expect, it } from 'vitest';
import type { SupplyChain, SupplyLink } from './source-data';
import { describeSupplyChain, formatCorrelation, relationship } from './supply-chain';

describe('relationship', () => {
	it('names what the company is to the one asked for', () => {
		expect(relationship({ supplier: true, customer: false })).toBe('Supplier');
		expect(relationship({ supplier: false, customer: true })).toBe('Customer');
		expect(relationship({ supplier: true, customer: true })).toBe('Supplier and customer');
	});
});

describe('formatCorrelation', () => {
	it('shows the sign and two decimals', () => {
		expect(formatCorrelation(0.456)).toBe('+0.46');
		expect(formatCorrelation(-0.74)).toBe('−0.74');
		expect(formatCorrelation(0)).toBe('0.00');
		expect(formatCorrelation(null)).toBe('n/a');
	});
});

describe('describeSupplyChain', () => {
	const link = (symbol: string): SupplyLink => ({
		symbol,
		name: symbol,
		country: null,
		industry: null,
		supplier: true,
		customer: false,
		correlation1y: null,
		correlation3m: null
	});
	const chain = (o: Partial<SupplyChain>): SupplyChain => ({
		total: 2,
		suppliers: 2,
		customers: 0,
		both: 0,
		links: [link('A'), link('B')],
		...o
	});

	it('counts the links, and says how many are shown when some are left out', () => {
		expect(
			describeSupplyChain(chain({ total: 857, suppliers: 653, customers: 573, both: 370, links: [link('A')] }))
		).toBe(
			'Eulerpool lists 857 linked companies: 653 suppliers, 573 customers; 370 are both. Showing the first 1 by name.'
		);
	});
	it('says nothing about a shortlist when all are shown, and uses the singular', () => {
		expect(describeSupplyChain(chain({ total: 1, suppliers: 1, customers: 1, both: 1, links: [link('A')] }))).toBe(
			'Eulerpool lists 1 linked company: 1 supplier, 1 customer; 1 is both.'
		);
		expect(describeSupplyChain(chain({}))).toBe('Eulerpool lists 2 linked companies: 2 suppliers, 0 customers.');
	});
});
